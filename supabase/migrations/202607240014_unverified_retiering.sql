begin;

-- Humn's unverified state is a statement about missing review/provenance, not a
-- verdict about the image. Missing C2PA or EXIF remains neutral at all times.

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
      when coalesce(p_ai_declared, false) then 'unverified'
      when p_status = 'verified' and greatest(coalesce(p_proof_count, 0), 0) >= 1 then 'verified'
      when p_status = 'awaiting' and greatest(coalesce(p_proof_count, 0), 0) >= 1 then 'awaiting'
      else 'unverified'
    end,
    case
      when coalesce(p_ai_declared, false) then 'UNVERIFIED · SELF-DECLARED'
      when p_status = 'verified' and greatest(coalesce(p_proof_count, 0), 0) >= 1 then
        'VERIFIED · ' || greatest(coalesce(p_proof_count, 0), 0)::text || ' ' ||
        case when greatest(coalesce(p_proof_count, 0), 0) = 1 then 'PROOF' else 'PROOFS' end
      when p_status = 'awaiting' and greatest(coalesce(p_proof_count, 0), 0) >= 1 then 'AWAITING REVIEW'
      else 'UNVERIFIED · SELF-DECLARED'
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
grant execute on function public.derive_work_badge(public.humn_work_status, integer) to anon, authenticated;

create or replace function public.work_has_strong_provenance(
  p_work_id uuid,
  p_origin_input public.humn_origin_input
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select
    p_origin_input = 'captured_in_app'
    or exists (
      select 1
      from public.provenance_signals ps
      where ps.work_id = p_work_id
        and ps.signal_name = 'c2pa'
        and ps.value @> '{"camera_capture_asserted": true}'::jsonb
    );
$$;

grant execute on function public.work_has_strong_provenance(uuid, public.humn_origin_input) to anon, authenticated;

create or replace function public.is_default_discoverable_work(
  p_work_id uuid,
  p_status public.humn_work_status,
  p_proof_count integer,
  p_origin_input public.humn_origin_input,
  p_ai_declared boolean
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select
    not coalesce(p_ai_declared, false)
    and (
      (p_status = 'verified' and greatest(coalesce(p_proof_count, 0), 0) >= 1)
      or (p_status = 'awaiting' and greatest(coalesce(p_proof_count, 0), 0) >= 1)
      or public.work_has_strong_provenance(p_work_id, p_origin_input)
    );
$$;

grant execute on function public.is_default_discoverable_work(
  uuid, public.humn_work_status, integer, public.humn_origin_input, boolean
) to anon, authenticated;

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
      when coalesce(p_ai_declared, false) then -1000
      when p_status = 'verified' then 120
      when p_status = 'awaiting' then 70
      when public.work_has_strong_provenance(p_work_id, p_origin_input) then 25
      else -200
    end
    + case when p_origin_input = 'captured_in_app' then 25 else 0 end
    + coalesce((
        select sum(ps.weight)::integer
        from public.provenance_signals ps
        where ps.work_id = p_work_id
      ), 0)
    - least(coalesce(p_report_count, 0), 10) * 20;
$$;

grant execute on function public.work_feed_rank(
  uuid, public.humn_work_status, public.humn_origin_input, boolean, integer
) to anon, authenticated;

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
    select
      w.*,
      public.work_feed_rank(w.id, w.status, w.origin_input, w.ai_declared, w.report_count) as rank_score
    from public.works w
    where w.removed_at is null
      and w.status <> 'rejected'
      and public.is_default_discoverable_work(
        w.id, w.status, w.proof_count, w.origin_input, w.ai_declared
      )
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

create or replace function public.get_unverified_work_feed(
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
    select
      w.*,
      public.work_feed_rank(w.id, w.status, w.origin_input, w.ai_declared, w.report_count) as rank_score
    from public.works w
    where w.removed_at is null
      and w.status <> 'rejected'
      and not coalesce(w.ai_declared, false)
      and not public.is_default_discoverable_work(
        w.id, w.status, w.proof_count, w.origin_input, w.ai_declared
      )
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
drop function if exists public.search_work_feed(text, integer, boolean);

create function public.search_work_feed(
  p_query text,
  p_limit integer default 40,
  p_include_unverified boolean default false
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
  where w.removed_at is null
    and w.status <> 'rejected'
    and not coalesce(w.ai_declared, false)
    and (
      p_include_unverified
      or public.is_default_discoverable_work(
        w.id, w.status, w.proof_count, w.origin_input, w.ai_declared
      )
    )
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

create or replace function public.get_my_unverified_works(p_limit integer default 12)
returns table (
  id uuid,
  title text,
  proof_count integer,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select w.id, w.title, w.proof_count, w.created_at
  from public.works w
  where w.creator_id = auth.uid()
    and w.removed_at is null
    and w.status <> 'rejected'
    and not coalesce(w.ai_declared, false)
    and not public.is_default_discoverable_work(
      w.id, w.status, w.proof_count, w.origin_input, w.ai_declared
    )
  order by w.created_at desc
  limit least(greatest(coalesce(p_limit, 12), 1), 50);
$$;

grant execute on function public.get_work_feed(integer, timestamptz, uuid, integer) to anon, authenticated;
grant execute on function public.get_unverified_work_feed(integer, timestamptz, uuid, integer) to anon, authenticated;
grant execute on function public.search_work_feed(text, integer, boolean) to anon, authenticated;
revoke all on function public.get_my_unverified_works(integer) from public, anon;
grant execute on function public.get_my_unverified_works(integer) to authenticated;

comment on function public.get_work_feed(integer, timestamptz, uuid, integer) is
'Default trusted feed: verified, awaiting with proof, or strong capture provenance. Bare uploads are excluded without accusation.';
comment on function public.get_unverified_work_feed(integer, timestamptz, uuid, integer) is
'Explicitly labeled unverified/new feed. Absence of provenance is neutral and is never treated as evidence of AI origin.';
comment on function public.work_feed_rank(uuid, public.humn_work_status, public.humn_origin_input, boolean, integer) is
'Mechanical provenance ranking only. Bare uploads rank below reviewed or strong-provenance work; this is not an AI detector.';

notify pgrst, 'reload schema';

commit;
