begin;

create schema if not exists foundation_legacy;

drop view if exists public.discover_works;
drop function if exists public.search_works(text, integer);

do $$
begin
  if to_regclass('public.works') is not null and to_regclass('foundation_legacy.works') is null then
    execute 'alter table public.works set schema foundation_legacy';
  end if;
  if to_regclass('public.collections') is not null and to_regclass('foundation_legacy.collections') is null then
    execute 'alter table public.collections set schema foundation_legacy';
  end if;
  if to_regclass('public.collection_items') is not null and to_regclass('foundation_legacy.collection_items') is null then
    execute 'alter table public.collection_items set schema foundation_legacy';
  end if;
  if to_regclass('public.follows') is not null and to_regclass('foundation_legacy.follows') is null then
    execute 'alter table public.follows set schema foundation_legacy';
  end if;
  if to_regclass('public.reports') is not null and to_regclass('foundation_legacy.reports') is null then
    execute 'alter table public.reports set schema foundation_legacy';
  end if;
end $$;

do $$ begin
  create type public.humn_origin_input as enum ('captured_in_app','uploaded');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.humn_work_status as enum ('declared','awaiting','verified','rejected');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.humn_collection_privacy as enum ('private','public');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.humn_report_status as enum ('open','reviewed','dismissed');
exception when duplicate_object then null; end $$;

create table if not exists public.users (
  id uuid primary key,
  handle citext not null unique check (handle::text ~ '^[a-z0-9._-]{3,40}$'),
  display_name text not null,
  avatar_url text,
  reputation integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.works (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '' check (char_length(description) <= 5000),
  category text not null,
  aspect_ratio text not null check (aspect_ratio in ('2:3','1:1','4:5','3:2','9:16')),
  image_url text not null,
  thumb_url text,
  origin_input public.humn_origin_input not null,
  status public.humn_work_status not null default 'declared',
  proof_count integer not null default 0 check (proof_count >= 0),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  search_document tsvector generated always as (
    to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(category,''))
  ) stored,
  constraint verified_requires_proof check (status <> 'verified' or proof_count >= 1)
);

create table public.proof_entries (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works(id) on delete cascade,
  seq integer not null check (seq >= 1),
  captured_at timestamptz not null,
  title text not null,
  body text not null default '',
  thumb_url text,
  created_at timestamptz not null default now(),
  unique (work_id, seq)
);

create table public.file_evidence (
  work_id uuid primary key references public.works(id) on delete cascade,
  capture_device text,
  lens text,
  iso integer,
  shutter text,
  dimensions text,
  file_format text,
  original_hash text,
  captured_at timestamptz,
  uploaded_at timestamptz
);

create table public.technical_signals (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works(id) on delete cascade,
  name text not null,
  sentence text not null,
  hedge text not null,
  confidence integer not null check (confidence between 0 and 5)
);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  privacy public.humn_collection_privacy not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.collection_items (
  collection_id uuid not null references public.collections(id) on delete cascade,
  work_id uuid not null references public.works(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (collection_id, work_id)
);

create table public.follows (
  follower_id uuid not null references public.users(id) on delete cascade,
  creator_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, creator_id),
  check (follower_id <> creator_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works(id) on delete cascade,
  reporter_id uuid not null references public.users(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  status public.humn_report_status not null default 'open'
);

create index works_published_cursor_idx on public.works (published_at desc, id desc) where status <> 'rejected';
create index works_creator_idx on public.works (creator_id, published_at desc);
create index works_category_idx on public.works (category, published_at desc);
create index works_search_idx on public.works using gin (search_document);
create index proof_entries_work_seq_idx on public.proof_entries (work_id, seq);
create index technical_signals_work_idx on public.technical_signals (work_id);
create index collections_owner_updated_idx on public.collections (owner_id, updated_at desc);
create index collection_items_work_idx on public.collection_items (work_id);
create index reports_status_idx on public.reports (status, created_at desc);

create or replace function public.sync_work_proof_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_work_id uuid;
  total integer;
begin
  target_work_id := coalesce(new.work_id, old.work_id);
  select count(*)::integer into total from public.proof_entries where work_id = target_work_id;
  update public.works
  set proof_count = total,
      status = case when total = 0 and status = 'verified' then 'declared'::public.humn_work_status else status end
  where id = target_work_id;
  if tg_op = 'UPDATE' and old.work_id is distinct from new.work_id then
    select count(*)::integer into total from public.proof_entries where work_id = old.work_id;
    update public.works
    set proof_count = total,
        status = case when total = 0 and status = 'verified' then 'declared'::public.humn_work_status else status end
    where id = old.work_id;
  end if;
  return coalesce(new, old);
end $$;

create trigger humn_proof_count_sync
after insert or update or delete on public.proof_entries
for each row execute function public.sync_work_proof_count();

create or replace function public.touch_collection_from_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.collections set updated_at = now() where id = coalesce(new.collection_id, old.collection_id);
  return coalesce(new, old);
end $$;

create trigger humn_collection_item_touch
after insert or delete on public.collection_items
for each row execute function public.touch_collection_from_item();

create trigger humn_collections_updated before update on public.collections
for each row execute function public.set_updated_at();

create or replace function public.sync_auth_user_to_humn_users()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_handle text;
begin
  requested_handle := lower(coalesce(new.raw_user_meta_data->>'username', new.raw_user_meta_data->>'handle', 'user_' || substr(new.id::text,1,8)));
  insert into public.users(id, handle, display_name, avatar_url)
  values(
    new.id,
    regexp_replace(requested_handle, '[^a-z0-9._-]', '', 'g'),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1), 'Humn member'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    avatar_url = coalesce(excluded.avatar_url, public.users.avatar_url);
  return new;
end $$;

drop trigger if exists humn_auth_user_created on auth.users;
create trigger humn_auth_user_created
after insert or update of raw_user_meta_data on auth.users
for each row execute function public.sync_auth_user_to_humn_users();

insert into public.users(id, handle, display_name, avatar_url, created_at)
select
  au.id,
  ('member_' || substr(au.id::text,1,8))::citext,
  coalesce(au.raw_user_meta_data->>'display_name', split_part(au.email,'@',1), 'Humn member'),
  au.raw_user_meta_data->>'avatar_url',
  au.created_at
from auth.users au
on conflict (id) do nothing;

create or replace function public.derive_work_badge(
  p_status public.humn_work_status,
  p_proof_count integer
)
returns table (badge_variant text, badge_label text)
language sql
immutable
parallel safe
as $$
  select
    case
      when p_status = 'verified' and greatest(coalesce(p_proof_count,0),0) >= 1 then 'verified'
      when p_status = 'awaiting' then 'awaiting'
      else 'declared'
    end,
    case
      when p_status = 'verified' and greatest(coalesce(p_proof_count,0),0) >= 1 then
        'VERIFIED · ' || greatest(coalesce(p_proof_count,0),0)::text || ' ' ||
        case when greatest(coalesce(p_proof_count,0),0) = 1 then 'PROOF' else 'PROOFS' end
      when p_status = 'awaiting' then 'AWAITING REVIEW'
      else 'DECLARED HUMAN-MADE'
    end;
$$;

create or replace function public.get_work_feed(
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
set search_path = public
as $$
  select
    w.id, w.creator_id, w.title, w.description, w.category, w.aspect_ratio,
    w.image_url, w.thumb_url, w.origin_input, w.status, w.proof_count,
    w.created_at, w.published_at,
    u.handle::text, u.display_name, u.avatar_url, u.reputation,
    badge.badge_variant, badge.badge_label
  from public.works w
  join public.users u on u.id = w.creator_id
  cross join lateral public.derive_work_badge(w.status, w.proof_count) badge
  where w.status <> 'rejected'
    and (
      p_cursor_published_at is null
      or (coalesce(w.published_at,w.created_at), w.id) <
         (p_cursor_published_at, coalesce(p_cursor_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
    )
  order by coalesce(w.published_at,w.created_at) desc, w.id desc
  limit least(greatest(coalesce(p_limit,24),1),60);
$$;

create or replace function public.search_work_feed(
  p_query text,
  p_limit integer default 40
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
set search_path = public
as $$
  select
    w.id, w.creator_id, w.title, w.description, w.category, w.aspect_ratio,
    w.image_url, w.thumb_url, w.origin_input, w.status, w.proof_count,
    w.created_at, w.published_at,
    u.handle::text, u.display_name, u.avatar_url, u.reputation,
    badge.badge_variant, badge.badge_label
  from public.works w
  join public.users u on u.id = w.creator_id
  cross join lateral public.derive_work_badge(w.status, w.proof_count) badge
  where w.status <> 'rejected'
    and (
      w.search_document @@ websearch_to_tsquery('english', nullif(trim(p_query),''))
      or w.title ilike '%' || trim(p_query) || '%'
      or w.description ilike '%' || trim(p_query) || '%'
      or w.category ilike '%' || trim(p_query) || '%'
      or u.handle::text ilike '%' || trim(p_query) || '%'
    )
  order by ts_rank(w.search_document, websearch_to_tsquery('english', nullif(trim(p_query),''))) desc,
           coalesce(w.published_at,w.created_at) desc,
           w.id desc
  limit least(greatest(coalesce(p_limit,40),1),60);
$$;

create or replace function public.get_work_detail(p_work_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
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
    'created_at', w.created_at,
    'published_at', w.published_at,
    'creator', jsonb_build_object(
      'id', u.id,
      'handle', u.handle::text,
      'display_name', u.display_name,
      'avatar_url', u.avatar_url,
      'reputation', u.reputation
    ),
    'badge', (select to_jsonb(b) from public.derive_work_badge(w.status,w.proof_count) b),
    'proof_entries', coalesce((
      select jsonb_agg(to_jsonb(pe) order by pe.seq)
      from public.proof_entries pe where pe.work_id = w.id
    ), '[]'::jsonb),
    'file_evidence', (
      select to_jsonb(fe) from public.file_evidence fe where fe.work_id = w.id
    ),
    'technical_signals', coalesce((
      select jsonb_agg(to_jsonb(ts) order by ts.id)
      from public.technical_signals ts where ts.work_id = w.id
    ), '[]'::jsonb)
  )
  from public.works w
  join public.users u on u.id = w.creator_id
  where w.id = p_work_id and w.status <> 'rejected';
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
set search_path = public
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
          'badge', (select to_jsonb(b) from public.derive_work_badge(w.status,w.proof_count) b),
          'added_at', ci2.added_at
        ) as preview, ci2.added_at
        from public.collection_items ci2
        join public.works w on w.id = ci2.work_id
        join public.users u on u.id = w.creator_id
        where ci2.collection_id = c.id
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

alter table public.users enable row level security;
alter table public.works enable row level security;
alter table public.proof_entries enable row level security;
alter table public.file_evidence enable row level security;
alter table public.technical_signals enable row level security;
alter table public.collections enable row level security;
alter table public.collection_items enable row level security;
alter table public.follows enable row level security;
alter table public.reports enable row level security;

create policy users_public_read on public.users for select using (true);
create policy users_self_insert on public.users for insert to authenticated with check ((select auth.uid()) = id);
create policy users_self_update on public.users for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy works_public_read on public.works for select using (true);
create policy works_creator_insert on public.works for insert to authenticated with check ((select auth.uid()) = creator_id);
create policy works_creator_update on public.works for update to authenticated using ((select auth.uid()) = creator_id) with check ((select auth.uid()) = creator_id);
create policy works_creator_delete on public.works for delete to authenticated using ((select auth.uid()) = creator_id);

create policy proof_entries_public_read on public.proof_entries for select using (true);
create policy proof_entries_creator_write on public.proof_entries for all to authenticated
using (exists(select 1 from public.works w where w.id = work_id and w.creator_id = (select auth.uid())))
with check (exists(select 1 from public.works w where w.id = work_id and w.creator_id = (select auth.uid())));

create policy file_evidence_public_read on public.file_evidence for select using (true);
create policy file_evidence_creator_write on public.file_evidence for all to authenticated
using (exists(select 1 from public.works w where w.id = work_id and w.creator_id = (select auth.uid())))
with check (exists(select 1 from public.works w where w.id = work_id and w.creator_id = (select auth.uid())));

create policy technical_signals_public_read on public.technical_signals for select using (true);
create policy technical_signals_creator_write on public.technical_signals for all to authenticated
using (exists(select 1 from public.works w where w.id = work_id and w.creator_id = (select auth.uid())))
with check (exists(select 1 from public.works w where w.id = work_id and w.creator_id = (select auth.uid())));

create policy collections_read on public.collections for select
using (privacy = 'public' or owner_id = (select auth.uid()));
create policy collections_owner_insert on public.collections for insert to authenticated
with check (owner_id = (select auth.uid()));
create policy collections_owner_update on public.collections for update to authenticated
using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy collections_owner_delete on public.collections for delete to authenticated
using (owner_id = (select auth.uid()));

create policy collection_items_read on public.collection_items for select
using (exists(select 1 from public.collections c where c.id = collection_id and (c.privacy = 'public' or c.owner_id = (select auth.uid()))));
create policy collection_items_owner_write on public.collection_items for all to authenticated
using (exists(select 1 from public.collections c where c.id = collection_id and c.owner_id = (select auth.uid())))
with check (exists(select 1 from public.collections c where c.id = collection_id and c.owner_id = (select auth.uid())));

create policy follows_public_read on public.follows for select using (true);
create policy follows_self_write on public.follows for all to authenticated
using (follower_id = (select auth.uid())) with check (follower_id = (select auth.uid()));

create policy reports_reporter_read on public.reports for select to authenticated
using (reporter_id = (select auth.uid()));
create policy reports_reporter_insert on public.reports for insert to authenticated
with check (reporter_id = (select auth.uid()));

revoke all on public.users, public.works, public.proof_entries, public.file_evidence,
  public.technical_signals, public.collections, public.collection_items, public.follows, public.reports from anon, authenticated;
grant select on public.users, public.works, public.proof_entries, public.file_evidence,
  public.technical_signals to anon, authenticated;
grant select on public.collections, public.collection_items, public.follows to anon, authenticated;
grant insert, update, delete on public.users, public.works, public.proof_entries, public.file_evidence,
  public.technical_signals, public.collections, public.collection_items, public.follows to authenticated;
grant select, insert on public.reports to authenticated;
grant execute on function public.derive_work_badge(public.humn_work_status,integer) to anon, authenticated;
grant execute on function public.get_work_feed(timestamptz,uuid,integer) to anon, authenticated;
grant execute on function public.search_work_feed(text,integer) to anon, authenticated;
grant execute on function public.get_work_detail(uuid) to anon, authenticated;
grant execute on function public.get_collection_summaries(uuid) to authenticated;

commit;
