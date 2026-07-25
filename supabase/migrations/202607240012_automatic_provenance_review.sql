begin;

-- Chunk 4: provenance evidence and human review. No AI classifier is used.
-- Missing C2PA or EXIF is neutral. The only automatic AI-origin statement is a
-- C2PA manifest whose own digitalSourceType explicitly declares synthetic media.

alter table public.users
  add column if not exists is_admin boolean not null default false,
  add column if not exists reviewer_level smallint not null default 0 check (reviewer_level between 0 and 3),
  add column if not exists tenure_awarded_months integer not null default 0 check (tenure_awarded_months >= 0);

alter table public.works
  add column if not exists ai_declared boolean not null default false,
  add column if not exists report_count integer not null default 0 check (report_count >= 0),
  add column if not exists verification_requested_at timestamptz,
  add column if not exists review_note text,
  add column if not exists removed_at timestamptz;

create index if not exists works_review_ranking_idx
  on public.works (removed_at, status, ai_declared, report_count, published_at desc);

create or replace function public.set_reviewer_level()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.reviewer_level := case
    when new.is_admin then 3
    when new.reputation >= 5000 then 3
    when new.reputation >= 1500 then 2
    when new.reputation >= 500 then 1
    else 0
  end;
  return new;
end;
$$;

drop trigger if exists humn_users_reviewer_level on public.users;
create trigger humn_users_reviewer_level
before insert or update of reputation, is_admin on public.users
for each row execute function public.set_reviewer_level();

-- Bootstrap the existing founder account. Change through trusted SQL only.
update public.users
set is_admin = true
where handle = 'robertd44';

-- Re-run the derived-level trigger for existing rows.
update public.users set reputation = reputation;

create or replace function public.refresh_my_tenure_reputation()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_months integer;
  v_previous integer;
  v_reputation integer;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select least(60, greatest(0, floor(extract(epoch from (now() - created_at)) / 2592000)::integer)),
         tenure_awarded_months
  into v_months, v_previous
  from public.users
  where id = v_user
  for update;

  if not found then
    raise exception 'Profile required' using errcode = 'P0002';
  end if;

  if v_months > v_previous then
    update public.users
    set reputation = reputation + (v_months - v_previous),
        tenure_awarded_months = v_months
    where id = v_user
    returning reputation into v_reputation;
  else
    select reputation into v_reputation from public.users where id = v_user;
  end if;

  return v_reputation;
end;
$$;

revoke all on function public.refresh_my_tenure_reputation() from public, anon;
grant execute on function public.refresh_my_tenure_reputation() to authenticated;

create or replace function public.is_humn_reviewer(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select u.is_admin or u.reviewer_level > 0
    from public.users u
    where u.id = p_user_id
  ), false);
$$;

revoke all on function public.is_humn_reviewer(uuid) from public, anon;
grant execute on function public.is_humn_reviewer(uuid) to authenticated;

do $$ begin
  create type public.humn_review_trigger as enum ('reported_threshold', 'verification_request');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.humn_review_state as enum ('open', 'resolved');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.humn_moderation_action as enum ('approve', 'reject', 'remove');
exception when duplicate_object then null; end $$;

create table if not exists public.provenance_signals (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works(id) on delete cascade,
  signal_name text not null check (signal_name in ('c2pa', 'exif_consistency', 'duplicate_hash', 'origin_input')),
  value jsonb not null default '{}'::jsonb,
  weight integer not null default 0 check (weight between -200 and 200),
  created_at timestamptz not null default now(),
  unique (work_id, signal_name)
);

create table if not exists public.review_requests (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works(id) on delete cascade,
  trigger_type public.humn_review_trigger not null,
  requested_by uuid references public.users(id) on delete set null,
  state public.humn_review_state not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create unique index if not exists review_requests_one_open_trigger_idx
  on public.review_requests (work_id, trigger_type)
  where state = 'open';
create index if not exists review_requests_open_created_idx
  on public.review_requests (state, created_at desc);

-- Preserve the pre-Chunk-4 case-based moderation audit table.
-- Chunk 4 requires a separate Work-based moderation_actions schema.
do $$
declare
  v_archive_name text;
begin
  if to_regclass('public.moderation_actions') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'moderation_actions'
         and column_name = 'case_id'
     )
     and not exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'moderation_actions'
         and column_name = 'work_id'
     )
  then
    create schema if not exists foundation_legacy;

    if to_regclass('foundation_legacy.moderation_actions') is null then
      alter table public.moderation_actions
        set schema foundation_legacy;
    else
      v_archive_name :=
        'moderation_actions_pre_chunk4_' ||
        to_char(clock_timestamp(), 'YYYYMMDDHH24MISS');

      execute format(
        'alter table public.moderation_actions rename to %I',
        v_archive_name
      );

      execute format(
        'alter table public.%I set schema foundation_legacy',
        v_archive_name
      );
    end if;
  end if;
end
$$;

create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works(id) on delete cascade,
  reviewer_id uuid not null references public.users(id) on delete restrict,
  action public.humn_moderation_action not null,
  reason text not null check (char_length(trim(reason)) between 3 and 2000),
  previous_status public.humn_work_status not null,
  next_status public.humn_work_status not null,
  created_at timestamptz not null default now()
);

create index if not exists provenance_signals_work_idx on public.provenance_signals (work_id, signal_name);
create index if not exists moderation_actions_work_created_idx on public.moderation_actions (work_id, created_at desc);

alter table public.provenance_signals enable row level security;
alter table public.review_requests enable row level security;
alter table public.moderation_actions enable row level security;

drop policy if exists reports_reviewer_read on public.reports;
create policy reports_reviewer_read
on public.reports for select to authenticated
using (public.is_humn_reviewer((select auth.uid())));

-- Signals are display evidence for publicly readable work. Clients cannot write them.
drop policy if exists provenance_signals_visible_work_read on public.provenance_signals;
create policy provenance_signals_visible_work_read
on public.provenance_signals for select to anon, authenticated
using (
  exists (
    select 1 from public.works w
    where w.id = provenance_signals.work_id
      and w.removed_at is null
      and (w.status <> 'rejected' or w.creator_id = (select auth.uid()))
  )
);

-- Creators may see their own requests. Reviewers see the queue. No direct writes.
drop policy if exists review_requests_creator_or_reviewer_read on public.review_requests;
create policy review_requests_creator_or_reviewer_read
on public.review_requests for select to authenticated
using (
  requested_by = (select auth.uid())
  or exists (
    select 1 from public.works w
    where w.id = review_requests.work_id and w.creator_id = (select auth.uid())
  )
  or public.is_humn_reviewer((select auth.uid()))
);

drop policy if exists moderation_actions_creator_or_reviewer_read on public.moderation_actions;
create policy moderation_actions_creator_or_reviewer_read
on public.moderation_actions for select to authenticated
using (
  public.is_humn_reviewer((select auth.uid()))
  or exists (
    select 1 from public.works w
    where w.id = moderation_actions.work_id and w.creator_id = (select auth.uid())
  )
);

revoke all on public.provenance_signals, public.review_requests, public.moderation_actions from anon, authenticated;
grant select on public.provenance_signals to anon, authenticated;
grant select on public.review_requests, public.moderation_actions to authenticated;

-- Existing records predate automatic C2PA parsing. Backfill only what can be
-- known from stored data and mark C2PA as not evaluated rather than inventing a
-- missing-manifest result.
insert into public.provenance_signals (work_id, signal_name, value, weight)
select
  w.id,
  'origin_input',
  jsonb_build_object(
    'origin_input', w.origin_input,
    'note', case when w.origin_input = 'captured_in_app'
      then 'The asset was recorded through the Humn capture origin path.'
      else 'The asset was uploaded from the creator device. Upload alone remains DECLARED.' end
  ),
  case when w.origin_input = 'captured_in_app' then 50 else 0 end
from public.works w
on conflict (work_id, signal_name) do nothing;

insert into public.provenance_signals (work_id, signal_name, value, weight)
select
  w.id,
  'exif_consistency',
  jsonb_build_object(
    'state', case when fe.capture_device is not null or fe.lens is not null or fe.iso is not null or fe.shutter is not null or fe.captured_at is not null then 'present' else 'none' end,
    'present', fe.capture_device is not null or fe.lens is not null or fe.iso is not null or fe.shutter is not null or fe.captured_at is not null,
    'capture_timestamp_present', fe.captured_at is not null,
    'note', case when fe.capture_device is not null or fe.lens is not null or fe.iso is not null or fe.shutter is not null or fe.captured_at is not null
      then 'Camera metadata was recorded from the stored file evidence.'
      else 'No usable EXIF fields were stored. This is neutral and is not evidence against the creator.' end
  ),
  case
    when ((fe.capture_device is not null)::integer + (fe.lens is not null)::integer + (fe.iso is not null)::integer + (fe.shutter is not null)::integer + (fe.captured_at is not null)::integer) >= 3 then 8
    when fe.capture_device is not null or fe.lens is not null or fe.iso is not null or fe.shutter is not null or fe.captured_at is not null then 4
    else 0
  end
from public.works w
left join public.file_evidence fe on fe.work_id = w.id
on conflict (work_id, signal_name) do nothing;

insert into public.provenance_signals (work_id, signal_name, value, weight)
select
  w.id,
  'c2pa',
  jsonb_build_object(
    'state', 'legacy_not_evaluated',
    'issuer', null,
    'camera_capture_asserted', false,
    'ai_generation_asserted', false,
    'digital_source_types', '[]'::jsonb,
    'validation_status', '[]'::jsonb,
    'note', 'This Work predates automatic Content Credentials parsing. No inference is made.'
  ),
  0
from public.works w
on conflict (work_id, signal_name) do nothing;

insert into public.provenance_signals (work_id, signal_name, value, weight)
select
  w.id,
  'duplicate_hash',
  jsonb_build_object(
    'duplicate', duplicate.work_id is not null,
    'matching_work_id', duplicate.work_id
  ),
  case when duplicate.work_id is null then 0 else -25 end
from public.works w
left join public.file_evidence fe on fe.work_id = w.id
left join lateral (
  select other.work_id
  from public.file_evidence other
  where fe.original_hash is not null
    and other.original_hash = fe.original_hash
    and other.work_id <> w.id
    and other.uploaded_at <= fe.uploaded_at
  order by other.uploaded_at, other.work_id
  limit 1
) duplicate on true
on conflict (work_id, signal_name) do nothing;

-- Existing report data may contain duplicates from seed/admin work. Keep the oldest.
with ranked as (
  select id, row_number() over (partition by work_id, reporter_id order by created_at, id) as rn
  from public.reports
)
delete from public.reports r
using ranked x
where r.id = x.id and x.rn > 1;

create unique index if not exists reports_one_per_user_work_idx
  on public.reports (work_id, reporter_id);

create or replace function public.sync_work_report_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_work_id uuid := case when tg_op = 'DELETE' then old.work_id else new.work_id end;
  v_count integer;
begin
  select count(*)::integer into v_count
  from public.reports r
  where r.work_id = v_work_id and r.status = 'open';

  update public.works
  set report_count = v_count
  where id = v_work_id;

  if v_count >= 3 then
    insert into public.review_requests (work_id, trigger_type, requested_by)
    values (v_work_id, 'reported_threshold', null)
    on conflict (work_id, trigger_type) where state = 'open' do nothing;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists humn_report_count_sync on public.reports;
create trigger humn_report_count_sync
after insert or update of status or delete on public.reports
for each row execute function public.sync_work_report_count();

-- Backfill report counts and queue entries.
update public.works w
set report_count = (
  select count(*)::integer from public.reports r
  where r.work_id = w.id and r.status = 'open'
);

insert into public.review_requests (work_id, trigger_type)
select id, 'reported_threshold'
from public.works
where report_count >= 3 and removed_at is null
on conflict (work_id, trigger_type) where state = 'open' do nothing;

-- A shared badge function. AI-declared is a C2PA-origin statement, not a detector verdict.
create or replace function public.derive_work_badge(
  p_status public.humn_work_status,
  p_proof_count integer,
  p_ai_declared boolean
)
returns table (badge_variant text, badge_label text)
language sql
immutable
parallel safe
as $$
  select
    case
      when coalesce(p_ai_declared, false) then 'declared'
      when p_status = 'verified' and greatest(coalesce(p_proof_count, 0), 0) >= 1 then 'verified'
      when p_status = 'awaiting' then 'awaiting'
      else 'declared'
    end,
    case
      when coalesce(p_ai_declared, false) then 'AI-GENERATED · C2PA DECLARED'
      when p_status = 'verified' and greatest(coalesce(p_proof_count, 0), 0) >= 1 then
        'VERIFIED · ' || greatest(coalesce(p_proof_count, 0), 0)::text || ' ' ||
        case when greatest(coalesce(p_proof_count, 0), 0) = 1 then 'PROOF' else 'PROOFS' end
      when p_status = 'awaiting' then 'AWAITING REVIEW'
      else 'DECLARED HUMAN-MADE'
    end;
$$;

create or replace function public.derive_work_badge(
  p_status public.humn_work_status,
  p_proof_count integer
)
returns table (badge_variant text, badge_label text)
language sql
immutable
parallel safe
as $$
  select * from public.derive_work_badge(p_status, p_proof_count, false);
$$;

grant execute on function public.derive_work_badge(public.humn_work_status, integer, boolean) to anon, authenticated;

create or replace function public.work_feed_rank(
  p_work_id uuid,
  p_status public.humn_work_status,
  p_origin_input public.humn_origin_input,
  p_ai_declared boolean,
  p_report_count integer
)
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select
    case
      when p_status = 'verified' then 100
      when p_status = 'awaiting' then 20
      else 0
    end
    + case when p_origin_input = 'captured_in_app' then 50 else 0 end
    + coalesce((select sum(ps.weight)::integer from public.provenance_signals ps where ps.work_id = p_work_id), 0)
    - case when coalesce(p_ai_declared, false) then 120 else 0 end
    - least(coalesce(p_report_count, 0), 10) * 20;
$$;

grant execute on function public.work_feed_rank(uuid, public.humn_work_status, public.humn_origin_input, boolean, integer) to anon, authenticated;

-- Retire the Chunk 3 client-callable creation path. All new Work creation now
-- passes through the trusted server pipeline so provenance signals cannot be skipped.
revoke all on function public.create_origin_work(
  uuid, text, text, text, text, text, text, public.humn_origin_input,
  text, text, integer, text, text, text, text, timestamptz, timestamptz
) from public, anon, authenticated;

-- The browser may edit only ordinary creator copy. Origin/status/ranking fields and
-- forensic evidence are server-controlled so a creator cannot self-verify or
-- rewrite recorded provenance through PostgREST.
revoke insert, update on table public.works from authenticated;
grant update (title, description, category) on table public.works to authenticated;
revoke insert, update, delete on table public.file_evidence from authenticated;
revoke insert, update, delete on table public.technical_signals from authenticated;

-- Atomically creates the work, evidence and automatic provenance signals. The
-- function sets DECLARED for every common upload; only explicit C2PA AI origin
-- sets ai_declared. No upload path can set VERIFIED.
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
    p_image_url, p_thumb_url, p_origin_input, 'declared', 0,
    coalesce(p_ai_declared, false), now(), now()
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

revoke all on function public.create_origin_work_with_provenance(
  uuid, uuid, text, text, text, text, text, text, public.humn_origin_input,
  text, text, integer, text, text, text, text, timestamptz, timestamptz, jsonb, boolean
) from public, anon, authenticated;
grant execute on function public.create_origin_work_with_provenance(
  uuid, uuid, text, text, text, text, text, text, public.humn_origin_input,
  text, text, integer, text, text, text, text, timestamptz, timestamptz, jsonb, boolean
) to service_role;

create or replace function public.request_work_verification(p_work_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_work public.works%rowtype;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;

  select * into v_work from public.works where id = p_work_id for update;
  if not found or v_work.creator_id <> v_user then raise exception 'Work not found' using errcode = 'P0002'; end if;
  if v_work.removed_at is not null then raise exception 'Removed work cannot be submitted'; end if;
  if v_work.ai_declared then raise exception 'C2PA-declared AI work is not eligible for the human-made verified tier'; end if;
  if v_work.proof_count < 1 then raise exception 'Add at least one proof entry before requesting verification'; end if;

  update public.works
  set status = 'awaiting', verification_requested_at = now(), review_note = null
  where id = p_work_id;

  insert into public.review_requests (work_id, trigger_type, requested_by)
  values (p_work_id, 'verification_request', v_user)
  on conflict (work_id, trigger_type) where state = 'open' do nothing;
end;
$$;

revoke all on function public.request_work_verification(uuid) from public, anon;
grant execute on function public.request_work_verification(uuid) to authenticated;

create or replace function public.moderate_work(
  p_work_id uuid,
  p_action public.humn_moderation_action,
  p_reason text
)
returns public.humn_work_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reviewer uuid := auth.uid();
  v_work public.works%rowtype;
  v_next public.humn_work_status;
begin
  if v_reviewer is null or not public.is_humn_reviewer(v_reviewer) then
    raise exception 'Reviewer access required' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'A review reason is required';
  end if;

  perform public.refresh_my_tenure_reputation();
  select * into v_work from public.works where id = p_work_id for update;
  if not found then raise exception 'Work not found' using errcode = 'P0002'; end if;

  if p_action = 'approve' then
    if v_work.proof_count < 1 then raise exception 'Verified approval requires at least one proof entry'; end if;
    if v_work.ai_declared then raise exception 'C2PA-declared AI work cannot enter the human-made verified tier'; end if;
    v_next := 'verified';
    update public.works set status = v_next, review_note = null, removed_at = null where id = p_work_id;
    update public.users set reputation = reputation + 25 where id = v_work.creator_id;
    update public.reports set status = 'dismissed' where work_id = p_work_id and status = 'open';
  elsif p_action = 'reject' then
    v_next := 'declared';
    update public.works set status = v_next, review_note = trim(p_reason) where id = p_work_id;
    update public.users u
    set reputation = reputation + 5
    where exists (
      select 1 from public.reports r
      where r.work_id = p_work_id and r.reporter_id = u.id and r.status = 'open'
    );
    update public.reports set status = 'reviewed' where work_id = p_work_id and status = 'open';
  else
    v_next := 'rejected';
    update public.works set status = v_next, removed_at = now(), review_note = trim(p_reason) where id = p_work_id;
    update public.users u
    set reputation = reputation + 5
    where exists (
      select 1 from public.reports r
      where r.work_id = p_work_id and r.reporter_id = u.id and r.status = 'open'
    );
    update public.reports set status = 'reviewed' where work_id = p_work_id and status = 'open';
  end if;

  update public.review_requests
  set state = 'resolved', resolved_at = now()
  where work_id = p_work_id and state = 'open';

  insert into public.moderation_actions (
    work_id, reviewer_id, action, reason, previous_status, next_status
  ) values (
    p_work_id, v_reviewer, p_action, trim(p_reason), v_work.status, v_next
  );

  return v_next;
end;
$$;

revoke all on function public.moderate_work(uuid, public.humn_moderation_action, text) from public, anon;
grant execute on function public.moderate_work(uuid, public.humn_moderation_action, text) to authenticated;

-- Ranked feed. Missing provenance remains neutral. Reported work sinks mechanically.
drop function if exists public.get_work_feed(timestamptz, uuid, integer);
create or replace function public.get_work_feed(
  p_cursor_rank integer default null,
  p_cursor_published_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 24
)
returns table (
  id uuid,
  creator_id uuid,
  title text,
  description text,
  category text,
  aspect_ratio text,
  image_url text,
  thumb_url text,
  origin_input public.humn_origin_input,
  status public.humn_work_status,
  proof_count integer,
  ai_declared boolean,
  report_count integer,
  feed_rank integer,
  created_at timestamptz,
  published_at timestamptz,
  creator_handle text,
  creator_display_name text,
  creator_avatar_url text,
  creator_reputation integer,
  badge_variant text,
  badge_label text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with ranked as (
    select w.*, public.work_feed_rank(w.id, w.status, w.origin_input, w.ai_declared, w.report_count) as rank_score
    from public.works w
    where w.removed_at is null and w.status <> 'rejected'
  )
  select
    w.id, w.creator_id, w.title, w.description, w.category, w.aspect_ratio,
    w.image_url, w.thumb_url, w.origin_input, w.status, w.proof_count,
    w.ai_declared, w.report_count, w.rank_score,
    w.created_at, w.published_at,
    u.handle::text, u.display_name, u.avatar_url, u.reputation,
    badge.badge_variant, badge.badge_label
  from ranked w
  join public.users u on u.id = w.creator_id
  cross join lateral public.derive_work_badge(w.status, w.proof_count, w.ai_declared) badge
  where p_cursor_rank is null
     or (w.rank_score, coalesce(w.published_at, w.created_at), w.id) <
        (p_cursor_rank, p_cursor_published_at, coalesce(p_cursor_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
  order by w.rank_score desc, coalesce(w.published_at, w.created_at) desc, w.id desc
  limit least(greatest(coalesce(p_limit, 24), 1), 60);
$$;

drop function if exists public.search_work_feed(text, integer);
create or replace function public.search_work_feed(p_query text, p_limit integer default 40)
returns table (
  id uuid,
  creator_id uuid,
  title text,
  description text,
  category text,
  aspect_ratio text,
  image_url text,
  thumb_url text,
  origin_input public.humn_origin_input,
  status public.humn_work_status,
  proof_count integer,
  ai_declared boolean,
  report_count integer,
  feed_rank integer,
  created_at timestamptz,
  published_at timestamptz,
  creator_handle text,
  creator_display_name text,
  creator_avatar_url text,
  creator_reputation integer,
  badge_variant text,
  badge_label text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    w.id, w.creator_id, w.title, w.description, w.category, w.aspect_ratio,
    w.image_url, w.thumb_url, w.origin_input, w.status, w.proof_count,
    w.ai_declared, w.report_count,
    public.work_feed_rank(w.id, w.status, w.origin_input, w.ai_declared, w.report_count),
    w.created_at, w.published_at,
    u.handle::text, u.display_name, u.avatar_url, u.reputation,
    badge.badge_variant, badge.badge_label
  from public.works w
  join public.users u on u.id = w.creator_id
  cross join lateral public.derive_work_badge(w.status, w.proof_count, w.ai_declared) badge
  where w.removed_at is null and w.status <> 'rejected'
    and (
      w.search_document @@ websearch_to_tsquery('english', nullif(trim(p_query), ''))
      or w.title ilike '%' || trim(p_query) || '%'
      or w.description ilike '%' || trim(p_query) || '%'
      or w.category ilike '%' || trim(p_query) || '%'
      or u.handle::text ilike '%' || trim(p_query) || '%'
    )
  order by
    public.work_feed_rank(w.id, w.status, w.origin_input, w.ai_declared, w.report_count) desc,
    ts_rank(w.search_document, websearch_to_tsquery('english', nullif(trim(p_query), ''))) desc,
    coalesce(w.published_at, w.created_at) desc,
    w.id desc
  limit least(greatest(coalesce(p_limit, 40), 1), 60);
$$;

create or replace function public.get_work_detail(p_work_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'id', w.id,
    'creator_id', w.creator_id,
    'title', w.title,
    'description', w.description,
    'category', w.category,
    'aspect_ratio', w.aspect_ratio,
    'image_url', w.image_url,
    'thumb_url', w.thumb_url,
    'origin_input', w.origin_input,
    'status', w.status,
    'proof_count', w.proof_count,
    'ai_declared', w.ai_declared,
    'report_count', w.report_count,
    'review_note', w.review_note,
    'feed_rank', public.work_feed_rank(w.id, w.status, w.origin_input, w.ai_declared, w.report_count),
    'created_at', w.created_at,
    'published_at', w.published_at,
    'creator', jsonb_build_object(
      'id', u.id,
      'handle', u.handle::text,
      'display_name', u.display_name,
      'avatar_url', u.avatar_url,
      'reputation', u.reputation
    ),
    'badge', (select to_jsonb(b) from public.derive_work_badge(w.status, w.proof_count, w.ai_declared) b),
    'proof_entries', coalesce((
      select jsonb_agg(to_jsonb(pe) order by pe.seq)
      from public.proof_entries pe where pe.work_id = w.id
    ), '[]'::jsonb),
    'file_evidence', (select to_jsonb(fe) from public.file_evidence fe where fe.work_id = w.id),
    'technical_signals', coalesce((
      select jsonb_agg(to_jsonb(ts) order by ts.id)
      from public.technical_signals ts where ts.work_id = w.id
    ), '[]'::jsonb),
    'provenance_signals', coalesce((
      select jsonb_agg(to_jsonb(ps) order by ps.created_at, ps.signal_name)
      from public.provenance_signals ps where ps.work_id = w.id
    ), '[]'::jsonb),
    'moderation_actions', case when w.creator_id = auth.uid() or public.is_humn_reviewer(auth.uid()) then coalesce((
      select jsonb_agg(to_jsonb(ma) order by ma.created_at desc)
      from public.moderation_actions ma where ma.work_id = w.id
    ), '[]'::jsonb) else '[]'::jsonb end
  )
  from public.works w
  join public.users u on u.id = w.creator_id
  where w.id = p_work_id
    and w.removed_at is null
    and (w.status <> 'rejected' or w.creator_id = auth.uid() or public.is_humn_reviewer(auth.uid()));
$$;


create or replace function public.get_collection_summaries(p_owner_id uuid)
returns table (
  id uuid,
  owner_id uuid,
  name text,
  privacy public.humn_collection_privacy,
  created_at timestamptz,
  updated_at timestamptz,
  work_count bigint,
  preview_works jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.id, c.owner_id, c.name, c.privacy, c.created_at, c.updated_at,
    count(ci.work_id) as work_count,
    coalesce((
      select jsonb_agg(preview order by added_at desc)
      from (
        select jsonb_build_object(
          'id', w.id,
          'title', w.title,
          'aspect_ratio', w.aspect_ratio,
          'image_url', w.image_url,
          'thumb_url', w.thumb_url,
          'creator_handle', u.handle::text,
          'proof_count', w.proof_count,
          'status', w.status,
          'ai_declared', w.ai_declared,
          'report_count', w.report_count,
          'feed_rank', public.work_feed_rank(w.id, w.status, w.origin_input, w.ai_declared, w.report_count),
          'badge', (select to_jsonb(b) from public.derive_work_badge(w.status, w.proof_count, w.ai_declared) b),
          'added_at', ci2.added_at
        ) as preview, ci2.added_at
        from public.collection_items ci2
        join public.works w on w.id = ci2.work_id
        join public.users u on u.id = w.creator_id
        where ci2.collection_id = c.id and w.removed_at is null and w.status <> 'rejected'
        order by ci2.added_at desc
        limit 4
      ) preview_rows
    ), '[]'::jsonb) as preview_works
  from public.collections c
  left join public.collection_items ci on ci.collection_id = c.id
  where c.owner_id = p_owner_id
  group by c.id
  order by c.updated_at desc;
$$;

create or replace function public.get_moderation_queue(p_limit integer default 50)
returns table (
  work_id uuid,
  title text,
  creator_handle text,
  image_url text,
  status public.humn_work_status,
  proof_count integer,
  report_count integer,
  ai_declared boolean,
  triggers text[],
  requested_at timestamptz,
  badge_variant text,
  badge_label text
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
    w.id, w.title, u.handle::text, w.image_url, w.status, w.proof_count,
    w.report_count, w.ai_declared,
    array_agg(distinct rr.trigger_type::text order by rr.trigger_type::text),
    max(rr.created_at),
    badge.badge_variant, badge.badge_label
  from public.review_requests rr
  join public.works w on w.id = rr.work_id
  join public.users u on u.id = w.creator_id
  cross join lateral public.derive_work_badge(w.status, w.proof_count, w.ai_declared) badge
  where rr.state = 'open' and w.removed_at is null
  group by w.id, u.handle, badge.badge_variant, badge.badge_label
  order by max(rr.created_at) desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
end;
$$;

grant execute on function public.get_work_feed(integer, timestamptz, uuid, integer) to anon, authenticated;
grant execute on function public.search_work_feed(text, integer) to anon, authenticated;
grant execute on function public.get_work_detail(uuid) to anon, authenticated;

revoke all on function public.get_moderation_queue(integer) from public, anon;
grant execute on function public.get_moderation_queue(integer) to authenticated;

-- Proof-stage derivatives. Originals remain covered by the private originals bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proof-display', 'proof-display', true, 15728640, array['image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists proof_display_public_read on storage.objects;
drop policy if exists proof_display_owner_insert on storage.objects;
drop policy if exists proof_display_owner_update on storage.objects;
drop policy if exists proof_display_owner_delete on storage.objects;

create policy proof_display_public_read
on storage.objects for select to anon, authenticated
using (bucket_id = 'proof-display');

create policy proof_display_owner_insert
on storage.objects for insert to authenticated
with check (bucket_id = 'proof-display' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy proof_display_owner_update
on storage.objects for update to authenticated
using (bucket_id = 'proof-display' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'proof-display' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy proof_display_owner_delete
on storage.objects for delete to authenticated
using (bucket_id = 'proof-display' and (storage.foldername(name))[1] = (select auth.uid())::text);

comment on table public.provenance_signals is
'Recorded provenance evidence and mechanical ranking inputs. Missing C2PA or EXIF is neutral, never adverse.';
comment on column public.works.ai_declared is
'True only when embedded C2PA data itself declares a synthetic or generative source type.';
comment on function public.work_feed_rank(uuid, public.humn_work_status, public.humn_origin_input, boolean, integer) is
'Mechanical provenance ranking. This is not an AI detector or a human-likelihood score.';

commit;
