begin;

-- Resolve a valid Humn handle without dropping the user's chosen base. The first
-- available value is used as-is; collisions receive a numeric suffix (_2, _3,
-- ...). This function excludes the current user so profile repairs are idempotent.
create or replace function public.next_available_humn_handle(
  p_base text,
  p_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_base text := lower(trim(coalesce(p_base, '')));
  candidate text;
  suffix_text text;
  suffix_number integer;
begin
  normalized_base := regexp_replace(normalized_base, '[^a-z0-9_]', '', 'g');

  if normalized_base !~ '^[a-z0-9_]{3,30}$' then
    raise exception 'invalid_handle_base';
  end if;

  candidate := left(normalized_base, 30);
  if not exists (
    select 1
    from public.users
    where handle = candidate::citext
      and id <> p_user_id
  ) then
    return candidate;
  end if;

  for suffix_number in 2..9999 loop
    suffix_text := '_' || suffix_number::text;
    candidate := left(normalized_base, 30 - char_length(suffix_text)) || suffix_text;

    if not exists (
      select 1
      from public.users
      where handle = candidate::citext
        and id <> p_user_id
    ) then
      return candidate;
    end if;
  end loop;

  raise exception 'handle_namespace_exhausted';
end;
$$;

alter function public.next_available_humn_handle(text, uuid) owner to postgres;
revoke all on function public.next_available_humn_handle(text, uuid) from public;

-- Keep Auth metadata and public profiles aligned. Form signups explicitly mark
-- signup_source=form and supply handle/display_name. OAuth signups do not supply
-- a chosen handle, so they receive a generated member_XXXXXXXX handle and are
-- flagged for the existing complete-profile flow.
create or replace function public.sync_auth_user_to_humn_users()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  raw_requested_handle text;
  normalized_requested_handle text;
  fallback_handle text;
  resolved_handle text;
  resolved_display_name text;
  signup_source text;
  provided_form_handle boolean;
  handle_adjusted boolean;
  requires_handle_choice boolean;
  choice_reason text;
  metadata_patch jsonb;
begin
  -- The function writes normalized metadata back to auth.users. Ignore the
  -- recursive trigger invocation caused by that one controlled update.
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  signup_source := lower(trim(coalesce(metadata->>'signup_source', '')));

  -- A collision repair preserves the originally requested value until the user
  -- explicitly chooses a new handle. Otherwise prefer `handle`, then the legacy
  -- `username` key used by earlier form clients.
  raw_requested_handle := case
    when coalesce((metadata->>'handle_adjusted')::boolean, false)
      and nullif(trim(metadata->>'requested_handle'), '') is not null
      then metadata->>'requested_handle'
    else coalesce(metadata->>'handle', metadata->>'username', '')
  end;

  normalized_requested_handle := lower(trim(coalesce(raw_requested_handle, '')));
  normalized_requested_handle := regexp_replace(normalized_requested_handle, '[^a-z0-9_]', '', 'g');

  -- Existing form accounts created before this migration may not have a
  -- signup_source key, but they do have the legacy username metadata. OAuth
  -- providers are never treated as having chosen a handle merely because they
  -- expose unrelated provider metadata.
  provided_form_handle := normalized_requested_handle ~ '^[a-z0-9_]{3,30}$'
    and (
      signup_source = 'form'
      or (
        signup_source = ''
        and (metadata ? 'handle' or metadata ? 'username')
        and coalesce(metadata->>'handle_origin', '') <> 'generated'
      )
    );

  fallback_handle := 'member_' || lpad(
    mod(abs(hashtextextended(new.id::text, 0)), 100000000)::text,
    8,
    '0'
  );

  if provided_form_handle then
    resolved_handle := public.next_available_humn_handle(normalized_requested_handle, new.id);
    handle_adjusted := resolved_handle <> normalized_requested_handle;
    requires_handle_choice := handle_adjusted;
    choice_reason := case when handle_adjusted then 'collision' else null end;
  else
    resolved_handle := public.next_available_humn_handle(fallback_handle, new.id);
    handle_adjusted := false;
    requires_handle_choice := true;
    choice_reason := 'generated';
  end if;

  resolved_display_name := coalesce(
    nullif(trim(metadata->>'display_name'), ''),
    nullif(trim(metadata->>'full_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Humn member'
  );

  perform set_config('humn.allow_handle_change', 'on', true);

  insert into public.users(id, handle, display_name, avatar_url, created_at)
  values(
    new.id,
    resolved_handle::citext,
    resolved_display_name,
    nullif(coalesce(metadata->>'avatar_url', metadata->>'picture'), ''),
    coalesce(new.created_at, now())
  )
  on conflict (id) do update set
    handle = case
      when public.users.handle::text ~ '^member_[0-9]{8}(_[0-9]+)?$'
        or coalesce((metadata->>'requires_handle_choice')::boolean, false)
        or coalesce((metadata->>'handle_adjusted')::boolean, false)
        then excluded.handle
      else public.users.handle
    end,
    display_name = excluded.display_name,
    avatar_url = coalesce(excluded.avatar_url, public.users.avatar_url);

  metadata_patch := jsonb_strip_nulls(jsonb_build_object(
    'handle', resolved_handle,
    'username', resolved_handle,
    'resolved_handle', resolved_handle,
    'requested_handle', case when provided_form_handle then normalized_requested_handle else null end,
    'signup_source', case when provided_form_handle then 'form' else 'oauth' end,
    'handle_origin', case
      when provided_form_handle and handle_adjusted then 'form-adjusted'
      when provided_form_handle then 'form'
      else 'generated'
    end,
    'handle_adjusted', handle_adjusted,
    'requires_handle_choice', requires_handle_choice,
    'handle_choice_reason', choice_reason,
    'display_name', resolved_display_name
  ));

  perform set_config('humn.allow_handle_change', 'off', true);

  if metadata <> (metadata || metadata_patch) then
    update auth.users
    set raw_user_meta_data = metadata || metadata_patch
    where id = new.id;
  end if;

  return new;
end;
$$;

alter function public.sync_auth_user_to_humn_users() owner to postgres;

drop trigger if exists humn_auth_user_created on auth.users;
create trigger humn_auth_user_created
after insert or update of raw_user_meta_data on auth.users
for each row execute function public.sync_auth_user_to_humn_users();

-- Repair fallback profiles when the original form handle is recoverable from
-- pre-migration metadata. This includes accounts such as @member_28627509 whose
-- auth metadata still contains the chosen username.
update auth.users auth_user
set raw_user_meta_data = coalesce(auth_user.raw_user_meta_data, '{}'::jsonb)
  || jsonb_build_object(
    'handle', lower(trim(coalesce(
      auth_user.raw_user_meta_data->>'handle',
      auth_user.raw_user_meta_data->>'username'
    ))),
    'username', lower(trim(coalesce(
      auth_user.raw_user_meta_data->>'handle',
      auth_user.raw_user_meta_data->>'username'
    ))),
    'signup_source', 'form',
    'handle_origin', 'form'
  )
from public.users profile
where profile.id = auth_user.id
  and profile.handle::text ~ '^member_[0-9]{8}(_[0-9]+)?$'
  and lower(trim(coalesce(
    auth_user.raw_user_meta_data->>'handle',
    auth_user.raw_user_meta_data->>'username',
    ''
  ))) ~ '^[a-z0-9_]{3,30}$'
  and lower(trim(coalesce(
    auth_user.raw_user_meta_data->>'handle',
    auth_user.raw_user_meta_data->>'username',
    ''
  ))) !~ '^member_[0-9]{8}(_[0-9]+)?$';

-- Any fallback profile that cannot be repaired from chosen form metadata remains
-- valid, but is explicitly flagged for handle choice on the next authenticated
-- visit. This is the expected OAuth path.
update auth.users auth_user
set raw_user_meta_data = coalesce(auth_user.raw_user_meta_data, '{}'::jsonb)
  || jsonb_build_object(
    'handle', profile.handle::text,
    'username', profile.handle::text,
    'resolved_handle', profile.handle::text,
    'signup_source', 'oauth',
    'handle_origin', 'generated',
    'handle_adjusted', false,
    'requires_handle_choice', true,
    'handle_choice_reason', 'generated'
  )
from public.users profile
where profile.id = auth_user.id
  and profile.handle::text ~ '^member_[0-9]{8}(_[0-9]+)?$';

-- Extend the existing defensive profile-completion RPC so it can also replace a
-- generated or collision-adjusted handle. Ordinary established accounts still
-- cannot mutate handles through this function.
create or replace function public.complete_humn_profile(
  p_handle text,
  p_display_name text
)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  normalized_handle text := lower(trim(coalesce(p_handle, '')));
  normalized_display_name text := trim(coalesce(p_display_name, ''));
  metadata jsonb;
  result_row public.users;
  profile_exists boolean;
  may_choose_handle boolean;
begin
  if caller_id is null then
    raise exception 'authentication_required';
  end if;

  if normalized_handle !~ '^[a-z0-9_]{3,30}$' then
    raise exception 'invalid_handle';
  end if;

  if char_length(normalized_display_name) < 2 or char_length(normalized_display_name) > 80 then
    raise exception 'invalid_display_name';
  end if;

  select coalesce(raw_user_meta_data, '{}'::jsonb)
  into metadata
  from auth.users
  where id = caller_id;

  select * into result_row from public.users where id = caller_id;
  profile_exists := found;

  may_choose_handle := not profile_exists
    or coalesce((metadata->>'requires_handle_choice')::boolean, false)
    or coalesce((metadata->>'handle_adjusted')::boolean, false);

  if not may_choose_handle then
    raise exception 'handle_change_not_allowed';
  end if;

  if exists (
    select 1
    from public.users
    where handle = normalized_handle::citext
      and id <> caller_id
  ) then
    raise exception 'handle_taken';
  end if;

  perform set_config('humn.allow_handle_change', 'on', true);

  insert into public.users(id, handle, display_name)
  values(caller_id, normalized_handle::citext, normalized_display_name)
  on conflict (id) do update set
    handle = excluded.handle,
    display_name = excluded.display_name
  returning * into result_row;

  perform set_config('humn.allow_handle_change', 'off', true);

  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object(
      'handle', normalized_handle,
      'username', normalized_handle,
      'resolved_handle', normalized_handle,
      'requested_handle', normalized_handle,
      'display_name', normalized_display_name,
      'signup_source', 'form',
      'handle_origin', 'chosen',
      'handle_adjusted', false,
      'requires_handle_choice', false
    )
    - 'handle_choice_reason'
  where id = caller_id;

  return result_row;
end;
$$;

revoke all on function public.complete_humn_profile(text, text) from public;
grant execute on function public.complete_humn_profile(text, text) to authenticated;

commit;
