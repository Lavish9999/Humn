begin;

-- Chunk 4 accountability addition.
-- Strikes are issued only from confident evidence:
--   1) the asset's own C2PA manifest explicitly declares trained-algorithmic or
--      synthetic origin, or
--   2) a human reviewer upholds a clear ownership/proof violation.
-- Missing C2PA, missing EXIF, low provenance weight, reports alone, and visual
-- suspicion are neutral and can never create a strike.

do $$ begin
  create type public.humn_strike_source as enum ('c2pa_ai', 'review_upheld');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.humn_appeal_status as enum ('none', 'pending', 'upheld', 'denied');
exception when duplicate_object then null; end $$;

alter table public.users
  add column if not exists posting_cooldown_until timestamptz,
  add column if not exists suspended_at timestamptz;

create table if not exists public.strikes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  work_id uuid references public.works(id) on delete set null,
  reason text not null check (char_length(trim(reason)) between 3 and 2000),
  source public.humn_strike_source not null,
  evidence_hash text,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '6 months'),
  appeal_status public.humn_appeal_status not null default 'none',
  appeal_reason text,
  appealed_at timestamptz,
  appeal_reviewed_at timestamptz,
  appeal_reviewed_by uuid references public.users(id) on delete set null,
  appeal_resolution_reason text
);

create index if not exists strikes_user_created_idx
  on public.strikes (user_id, created_at desc);
create index if not exists strikes_pending_appeal_idx
  on public.strikes (appeal_status, appealed_at desc)
  where appeal_status = 'pending';
create index if not exists strikes_ai_attempt_collapse_idx
  on public.strikes (user_id, source, evidence_hash, created_at desc)
  where source = 'c2pa_ai' and evidence_hash is not null;

alter table public.strikes enable row level security;

drop policy if exists strikes_owner_or_reviewer_read on public.strikes;
create policy strikes_owner_or_reviewer_read
on public.strikes for select to authenticated
using (
  user_id = (select auth.uid())
  or public.is_humn_reviewer((select auth.uid()))
);

revoke all on public.strikes from anon, authenticated;
grant select on public.strikes to authenticated;

-- Extend the existing audit table so strike actions and appeals share the same
-- immutable moderation ledger as Work review actions. Existing Work rows remain
-- valid; new strike rows leave Work-specific fields null.
alter table public.moderation_actions
  add column if not exists subject_type text not null default 'work'
    check (subject_type in ('work', 'strike')),
  add column if not exists actor_id uuid references public.users(id) on delete set null,
  add column if not exists target_user_id uuid references public.users(id) on delete set null,
  add column if not exists strike_id uuid references public.strikes(id) on delete set null,
  add column if not exists strike_action text
    check (strike_action in (
      'automatic_issue', 'review_issue', 'appeal_submitted',
      'appeal_upheld', 'appeal_denied', 'manual_overturn'
    ));

alter table public.moderation_actions
  alter column work_id drop not null,
  alter column reviewer_id drop not null,
  alter column action drop not null,
  alter column previous_status drop not null,
  alter column next_status drop not null;

create index if not exists moderation_actions_strike_created_idx
  on public.moderation_actions (strike_id, created_at desc)
  where strike_id is not null;
create index if not exists moderation_actions_target_user_created_idx
  on public.moderation_actions (target_user_id, created_at desc)
  where target_user_id is not null;

create or replace function public.active_strike_count(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.strikes s
  where s.user_id = p_user_id
    and s.expires_at > now()
    and s.appeal_status <> 'upheld';
$$;

revoke all on function public.active_strike_count(uuid) from public, anon, authenticated;

create or replace function public.refresh_user_strike_state(p_user_id uuid)
returns table (
  active_count integer,
  strike_level integer,
  posting_cooldown_until timestamptz,
  suspended_at timestamptz,
  can_post boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_second_strike_at timestamptz;
  v_cooldown timestamptz;
  v_suspended timestamptz;
begin
  select public.active_strike_count(p_user_id) into v_count;

  if v_count >= 3 then
    update public.users
    set suspended_at = coalesce(users.suspended_at, now()),
        posting_cooldown_until = null
    where id = p_user_id
    returning users.suspended_at into v_suspended;
    v_cooldown := null;
  elsif v_count = 2 then
    select created_at into v_second_strike_at
    from public.strikes
    where user_id = p_user_id
      and expires_at > now()
      and appeal_status <> 'upheld'
    order by created_at desc
    offset 0 limit 1;

    v_cooldown := v_second_strike_at + interval '7 days';
    update public.users
    set suspended_at = null,
        posting_cooldown_until = v_cooldown
    where id = p_user_id;
    v_suspended := null;
  else
    update public.users
    set suspended_at = null,
        posting_cooldown_until = null
    where id = p_user_id;
    v_cooldown := null;
    v_suspended := null;
  end if;

  return query
  select
    v_count,
    least(v_count, 3),
    v_cooldown,
    v_suspended,
    v_suspended is null and (v_cooldown is null or v_cooldown <= now());
end;
$$;

revoke all on function public.refresh_user_strike_state(uuid) from public, anon, authenticated;

create or replace function public.get_user_strike_state(p_user_id uuid default auth.uid())
returns table (
  active_count integer,
  strike_level integer,
  posting_cooldown_until timestamptz,
  suspended_at timestamptz,
  can_post boolean,
  status_label text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role text := coalesce(auth.role(), '');
  v_state record;
begin
  if p_user_id is null then
    raise exception 'User required' using errcode = '22023';
  end if;

  if v_role <> 'service_role'
     and v_actor is distinct from p_user_id
     and not public.is_humn_reviewer(v_actor) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into v_state from public.refresh_user_strike_state(p_user_id);

  return query
  select
    v_state.active_count,
    v_state.strike_level,
    v_state.posting_cooldown_until,
    v_state.suspended_at,
    v_state.can_post,
    case
      when v_state.suspended_at is not null then 'ACCOUNT SUSPENDED · APPEAL AVAILABLE'
      when v_state.posting_cooldown_until is not null and v_state.posting_cooldown_until > now()
        then '7-DAY POSTING COOLDOWN'
      when v_state.active_count = 1 then 'EDUCATIONAL WARNING'
      else 'NO ACTIVE RESTRICTION'
    end;
end;
$$;

revoke all on function public.get_user_strike_state(uuid) from public, anon;
grant execute on function public.get_user_strike_state(uuid) to authenticated, service_role;

-- Called only by the trusted upload route after the file's own C2PA credential
-- explicitly asserts synthetic/trained-algorithmic origin. Identical attempts by
-- the same user and hash inside 15 minutes collapse into one strike.
create or replace function public.record_ai_upload_strike(
  p_user_id uuid,
  p_original_hash text,
  p_reason text,
  p_evidence jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.strikes%rowtype;
  v_strike public.strikes%rowtype;
  v_state record;
  v_expiry timestamptz := now() + interval '6 months';
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Trusted server access required' using errcode = '42501';
  end if;
  if p_user_id is null or not exists (select 1 from public.users where id = p_user_id) then
    raise exception 'Profile required' using errcode = 'P0002';
  end if;
  if nullif(trim(coalesce(p_original_hash, '')), '') is null then
    raise exception 'Original hash required' using errcode = '22023';
  end if;

  select * into v_existing
  from public.strikes
  where user_id = p_user_id
    and source = 'c2pa_ai'
    and evidence_hash = p_original_hash
    and created_at >= now() - interval '15 minutes'
    and appeal_status <> 'upheld'
  order by created_at desc
  limit 1;

  if found then
    select * into v_state from public.refresh_user_strike_state(p_user_id);
    return jsonb_build_object(
      'strike_id', v_existing.id,
      'collapsed', true,
      'active_count', v_state.active_count,
      'strike_level', v_state.strike_level,
      'posting_cooldown_until', v_state.posting_cooldown_until,
      'suspended_at', v_state.suspended_at,
      'can_post', v_state.can_post
    );
  end if;

  insert into public.strikes (
    user_id, reason, source, evidence_hash, evidence, expires_at
  ) values (
    p_user_id,
    trim(p_reason),
    'c2pa_ai',
    p_original_hash,
    coalesce(p_evidence, '{}'::jsonb),
    v_expiry
  ) returning * into v_strike;

  -- Six months of clean behavior is measured from the newest strike.
  update public.strikes
  set expires_at = v_expiry
  where user_id = p_user_id
    and expires_at > now()
    and appeal_status <> 'upheld';

  select * into v_state from public.refresh_user_strike_state(p_user_id);

  insert into public.moderation_actions (
    subject_type, actor_id, target_user_id, strike_id, strike_action, reason
  ) values (
    'strike', null, p_user_id, v_strike.id, 'automatic_issue', trim(p_reason)
  );

  return jsonb_build_object(
    'strike_id', v_strike.id,
    'collapsed', false,
    'active_count', v_state.active_count,
    'strike_level', v_state.strike_level,
    'posting_cooldown_until', v_state.posting_cooldown_until,
    'suspended_at', v_state.suspended_at,
    'can_post', v_state.can_post
  );
end;
$$;

revoke all on function public.record_ai_upload_strike(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.record_ai_upload_strike(uuid, text, text, jsonb) to service_role;

-- Human reviewers may issue a strike only as an explicit upheld-review action.
-- Reports alone and report thresholds never call this function.
create or replace function public.issue_review_strike(
  p_work_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_work public.works%rowtype;
  v_strike public.strikes%rowtype;
  v_state record;
  v_expiry timestamptz := now() + interval '6 months';
begin
  if v_actor is null or not public.is_humn_reviewer(v_actor) then
    raise exception 'Reviewer access required' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'A clear violation reason is required';
  end if;

  select * into v_work from public.works where id = p_work_id for update;
  if not found then raise exception 'Work not found' using errcode = 'P0002'; end if;

  insert into public.strikes (
    user_id, work_id, reason, source, evidence, expires_at
  ) values (
    v_work.creator_id,
    p_work_id,
    trim(p_reason),
    'review_upheld',
    jsonb_build_object('work_id', p_work_id, 'reviewer_id', v_actor),
    v_expiry
  ) returning * into v_strike;

  update public.strikes
  set expires_at = v_expiry
  where user_id = v_work.creator_id
    and expires_at > now()
    and appeal_status <> 'upheld';

  update public.reports
  set status = 'reviewed'
  where work_id = p_work_id and status = 'open';

  select * into v_state from public.refresh_user_strike_state(v_work.creator_id);

  insert into public.moderation_actions (
    subject_type, actor_id, reviewer_id, target_user_id, work_id,
    strike_id, strike_action, reason
  ) values (
    'strike', v_actor, v_actor, v_work.creator_id, p_work_id,
    v_strike.id, 'review_issue', trim(p_reason)
  );

  return jsonb_build_object(
    'strike_id', v_strike.id,
    'active_count', v_state.active_count,
    'strike_level', v_state.strike_level,
    'posting_cooldown_until', v_state.posting_cooldown_until,
    'suspended_at', v_state.suspended_at,
    'can_post', v_state.can_post
  );
end;
$$;

revoke all on function public.issue_review_strike(uuid, text) from public, anon;
grant execute on function public.issue_review_strike(uuid, text) to authenticated;

create or replace function public.submit_strike_appeal(
  p_strike_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_strike public.strikes%rowtype;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p_reason, ''))) < 10 then
    raise exception 'Appeal reason must be at least 10 characters';
  end if;

  select * into v_strike from public.strikes where id = p_strike_id for update;
  if not found or v_strike.user_id <> v_actor then
    raise exception 'Strike not found' using errcode = 'P0002';
  end if;
  if v_strike.appeal_status = 'upheld' then raise exception 'This strike is already overturned'; end if;
  if v_strike.appeal_status = 'pending' then raise exception 'An appeal is already pending'; end if;
  if v_strike.appeal_status = 'denied' then raise exception 'This strike appeal has already been resolved'; end if;

  update public.strikes
  set appeal_status = 'pending',
      appeal_reason = trim(p_reason),
      appealed_at = now(),
      appeal_reviewed_at = null,
      appeal_reviewed_by = null,
      appeal_resolution_reason = null
  where id = p_strike_id;

  insert into public.moderation_actions (
    subject_type, actor_id, target_user_id, strike_id, strike_action, reason
  ) values (
    'strike', v_actor, v_actor, p_strike_id, 'appeal_submitted', trim(p_reason)
  );
end;
$$;

revoke all on function public.submit_strike_appeal(uuid, text) from public, anon;
grant execute on function public.submit_strike_appeal(uuid, text) to authenticated;

create or replace function public.resolve_strike_appeal(
  p_strike_id uuid,
  p_resolution text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_strike public.strikes%rowtype;
  v_state record;
  v_action text;
begin
  if v_actor is null or not public.is_humn_reviewer(v_actor) then
    raise exception 'Reviewer access required' using errcode = '42501';
  end if;
  if p_resolution not in ('uphold', 'deny', 'overturn') then
    raise exception 'Choose uphold, deny, or overturn';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'A resolution reason is required';
  end if;

  select * into v_strike from public.strikes where id = p_strike_id for update;
  if not found then raise exception 'Strike not found' using errcode = 'P0002'; end if;

  if p_resolution in ('uphold', 'overturn') then
    update public.strikes
    set appeal_status = 'upheld',
        appeal_reviewed_at = now(),
        appeal_reviewed_by = v_actor,
        appeal_resolution_reason = trim(p_reason),
        expires_at = least(expires_at, now())
    where id = p_strike_id;
    v_action := case when p_resolution = 'overturn' then 'manual_overturn' else 'appeal_upheld' end;
  else
    update public.strikes
    set appeal_status = 'denied',
        appeal_reviewed_at = now(),
        appeal_reviewed_by = v_actor,
        appeal_resolution_reason = trim(p_reason)
    where id = p_strike_id;
    v_action := 'appeal_denied';
  end if;

  select * into v_state from public.refresh_user_strike_state(v_strike.user_id);

  insert into public.moderation_actions (
    subject_type, actor_id, reviewer_id, target_user_id,
    strike_id, strike_action, reason
  ) values (
    'strike', v_actor, v_actor, v_strike.user_id,
    p_strike_id, v_action, trim(p_reason)
  );

  return jsonb_build_object(
    'strike_id', p_strike_id,
    'appeal_status', case when p_resolution in ('uphold', 'overturn') then 'upheld' else 'denied' end,
    'active_count', v_state.active_count,
    'strike_level', v_state.strike_level,
    'posting_cooldown_until', v_state.posting_cooldown_until,
    'suspended_at', v_state.suspended_at,
    'can_post', v_state.can_post
  );
end;
$$;

revoke all on function public.resolve_strike_appeal(uuid, text, text) from public, anon;
grant execute on function public.resolve_strike_appeal(uuid, text, text) to authenticated;

-- Defense in depth: even a trusted-server bug cannot create a public Work from an
-- asset whose own C2PA credential declares AI origin, and posting restrictions are
-- enforced at the database boundary as well as in the route handler.
create or replace function public.assert_user_can_post(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state record;
begin
  select * into v_state from public.refresh_user_strike_state(p_user_id);
  if v_state.suspended_at is not null then
    raise exception 'Account posting is suspended pending appeal' using errcode = '42501';
  end if;
  if v_state.posting_cooldown_until is not null and v_state.posting_cooldown_until > now() then
    raise exception 'Posting is paused until %', v_state.posting_cooldown_until using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.assert_user_can_post(uuid) from public, anon, authenticated;

create or replace function public.create_origin_work_with_provenance(
  p_work_id uuid,
  p_creator_id uuid,
  p_title text,
  p_description text,
  p_category text,
  p_aspect_ratio text,
  p_image_url text,
  p_thumb_url text,
  p_origin_input public.humn_origin_input,
  p_capture_device text default null,
  p_lens text default null,
  p_iso integer default null,
  p_shutter text default null,
  p_dimensions text default null,
  p_file_format text default null,
  p_original_hash text default null,
  p_captured_at timestamptz default null,
  p_uploaded_at timestamptz default now(),
  p_signals jsonb default '[]'::jsonb,
  p_ai_declared boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_creator_id uuid := p_creator_id;
  v_signal jsonb;
  v_duplicate_work uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Trusted server access required' using errcode = '42501';
  end if;
  if v_creator_id is null then
    raise exception 'Creator required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.users u where u.id = v_creator_id) then
    raise exception 'Profile required' using errcode = 'P0002';
  end if;
  perform public.assert_user_can_post(v_creator_id);
  if coalesce(p_ai_declared, false) then
    raise exception 'The file own embedded Content Credentials declare AI-generated origin; it cannot be published as a Humn Work' using errcode = '22023';
  end if;

  if p_original_hash is not null then
    select fe.work_id into v_duplicate_work
    from public.file_evidence fe
    where fe.original_hash = p_original_hash and fe.work_id <> p_work_id
    order by fe.uploaded_at asc nulls last
    limit 1;
  end if;

  insert into public.works (
    id, creator_id, title, description, category, aspect_ratio, image_url,
    thumb_url, origin_input, status, proof_count, ai_declared, created_at, published_at
  ) values (
    p_work_id, v_creator_id, p_title, p_description, p_category, p_aspect_ratio,
    p_image_url, p_thumb_url, p_origin_input, 'declared', 0, false, now(), now()
  );

  insert into public.file_evidence (
    work_id, capture_device, lens, iso, shutter, dimensions, file_format,
    original_hash, captured_at, uploaded_at
  ) values (
    p_work_id, p_capture_device, p_lens, p_iso, p_shutter, p_dimensions,
    p_file_format, p_original_hash, p_captured_at, coalesce(p_uploaded_at, now())
  );

  for v_signal in select value from jsonb_array_elements(coalesce(p_signals, '[]'::jsonb)) loop
    insert into public.provenance_signals (work_id, signal_name, value, weight)
    values (
      p_work_id,
      v_signal->>'signal_name',
      coalesce(v_signal->'value', '{}'::jsonb),
      coalesce((v_signal->>'weight')::integer, 0)
    )
    on conflict (work_id, signal_name) do update
    set value = excluded.value, weight = excluded.weight, created_at = now();
  end loop;

  insert into public.provenance_signals (work_id, signal_name, value, weight)
  values (
    p_work_id,
    'duplicate_hash',
    jsonb_build_object(
      'duplicate', v_duplicate_work is not null,
      'matching_work_id', v_duplicate_work
    ),
    case when v_duplicate_work is null then 0 else -25 end
  )
  on conflict (work_id, signal_name) do update
  set value = excluded.value, weight = excluded.weight, created_at = now();

  return p_work_id;
end;
$$;

-- Pending appeals enter the same human queue, but reports still never create a
-- strike without an explicit reviewer action.
create or replace function public.get_pending_strike_appeals(p_limit integer default 50)
returns table (
  strike_id uuid,
  user_id uuid,
  handle text,
  source public.humn_strike_source,
  reason text,
  appeal_reason text,
  created_at timestamptz,
  appealed_at timestamptz,
  active_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_humn_reviewer(auth.uid()) then
    raise exception 'Reviewer access required' using errcode = '42501';
  end if;

  return query
  select
    s.id,
    s.user_id,
    u.handle,
    s.source,
    s.reason,
    s.appeal_reason,
    s.created_at,
    s.appealed_at,
    public.active_strike_count(s.user_id)
  from public.strikes s
  join public.users u on u.id = s.user_id
  where s.appeal_status = 'pending'
  order by s.appealed_at desc nulls last, s.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 100));
end;
$$;

revoke all on function public.get_pending_strike_appeals(integer) from public, anon;
grant execute on function public.get_pending_strike_appeals(integer) to authenticated;

-- Bring existing user state in sync if this migration is applied after manual
-- test strikes or repaired rows.
do $$
declare
  v_user record;
begin
  for v_user in select distinct user_id from public.strikes loop
    perform public.refresh_user_strike_state(v_user.user_id);
  end loop;
end;
$$;

commit;
