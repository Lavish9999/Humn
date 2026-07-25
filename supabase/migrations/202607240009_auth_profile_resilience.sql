begin;

-- Keep Auth sessions and public profile rows in lockstep. This trigger is
-- deliberately defensive: a handle collision must never abort Auth signup and
-- leave an authenticated user without a public.users row.
create or replace function public.sync_auth_user_to_humn_users()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_handle text;
  fallback_handle text;
  resolved_display_name text;
begin
  requested_handle := lower(trim(coalesce(
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'handle',
    ''
  )));
  requested_handle := regexp_replace(requested_handle, '[^a-z0-9_]', '', 'g');
  fallback_handle := 'member_' || substr(replace(new.id::text, '-', ''), 1, 12);

  if char_length(requested_handle) < 3 or char_length(requested_handle) > 30 then
    requested_handle := fallback_handle;
  end if;

  if exists (
    select 1 from public.users
    where handle = requested_handle::citext
      and id <> new.id
  ) then
    requested_handle := left(requested_handle, 21) || '_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;

  resolved_display_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Humn member'
  );

  begin
    insert into public.users(id, handle, display_name, avatar_url, created_at)
    values(
      new.id,
      requested_handle::citext,
      resolved_display_name,
      nullif(new.raw_user_meta_data->>'avatar_url', ''),
      coalesce(new.created_at, now())
    )
    on conflict (id) do update set
      display_name = excluded.display_name,
      avatar_url = coalesce(excluded.avatar_url, public.users.avatar_url);
  exception when unique_violation then
    -- A concurrent signup may claim the requested handle after the availability
    -- check. Fall back to a UUID-derived handle rather than orphaning the user.
    insert into public.users(id, handle, display_name, avatar_url, created_at)
    values(
      new.id,
      fallback_handle::citext,
      resolved_display_name,
      nullif(new.raw_user_meta_data->>'avatar_url', ''),
      coalesce(new.created_at, now())
    )
    on conflict (id) do update set
      display_name = excluded.display_name,
      avatar_url = coalesce(excluded.avatar_url, public.users.avatar_url);
  end;

  return new;
end;
$$;

alter function public.sync_auth_user_to_humn_users() owner to postgres;

drop trigger if exists humn_auth_user_created on auth.users;
create trigger humn_auth_user_created
after insert or update of raw_user_meta_data on auth.users
for each row execute function public.sync_auth_user_to_humn_users();

-- Re-fire the repaired trigger for every pre-existing Auth account that has no
-- public profile. This repairs the previously orphaned account without changing
-- profiles that already exist.
update auth.users auth_user
set raw_user_meta_data = coalesce(auth_user.raw_user_meta_data, '{}'::jsonb)
where not exists (
  select 1 from public.users profile where profile.id = auth_user.id
);

-- Defensive recovery path used only when a valid session somehow exists without
-- a profile row. It can create the caller's missing profile, but it cannot change
-- an existing handle.
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
  result_row public.users;
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

  select * into result_row from public.users where id = caller_id;
  if found then
    return result_row;
  end if;

  if exists (select 1 from public.users where handle = normalized_handle::citext) then
    raise exception 'handle_taken';
  end if;

  insert into public.users(id, handle, display_name)
  values(caller_id, normalized_handle::citext, normalized_display_name)
  returning * into result_row;

  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
    'username', normalized_handle,
    'display_name', normalized_display_name
  )
  where id = caller_id;

  return result_row;
end;
$$;

revoke all on function public.complete_humn_profile(text, text) from public;
grant execute on function public.complete_humn_profile(text, text) to authenticated;

commit;
