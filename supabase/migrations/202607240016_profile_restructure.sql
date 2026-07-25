begin;

-- Public creator showcases expose only reviewed or review-pending work.
-- Unverified/self-declared work remains private to the creator's account workflow
-- and is never mixed into the public showcase.
create or replace function public.get_creator_public_works(
  p_handle text,
  p_limit integer default 60
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
    w.id,
    w.creator_id,
    w.title,
    w.description,
    w.category,
    w.aspect_ratio,
    w.image_url,
    w.thumb_url,
    w.origin_input,
    w.status,
    w.proof_count,
    coalesce(w.ai_declared, false),
    coalesce(w.report_count, 0),
    public.work_feed_rank(
      w.id,
      w.status,
      w.origin_input,
      w.ai_declared,
      w.report_count
    ),
    w.created_at,
    w.published_at,
    u.handle::text,
    u.display_name,
    u.avatar_url,
    u.reputation,
    badge.badge_variant,
    badge.badge_label
  from public.users u
  join public.works w on w.creator_id = u.id
  cross join lateral public.derive_work_badge(
    w.status,
    w.proof_count,
    w.ai_declared
  ) badge
  where lower(u.handle::text) = lower(trim(p_handle))
    and w.removed_at is null
    and not coalesce(w.ai_declared, false)
    and w.proof_count >= 1
    and w.status in ('verified', 'awaiting')
  order by
    case when w.status = 'verified' then 0 else 1 end,
    public.work_feed_rank(
      w.id,
      w.status,
      w.origin_input,
      w.ai_declared,
      w.report_count
    ) desc,
    coalesce(w.published_at, w.created_at) desc,
    w.id desc
  limit least(greatest(coalesce(p_limit, 60), 1), 100);
$$;

revoke all on function public.get_creator_public_works(text, integer) from public;
grant execute on function public.get_creator_public_works(text, integer) to anon, authenticated;

comment on function public.get_creator_public_works(text, integer) is
'Public creator showcase ordered by provenance tier. It excludes rejected, removed, AI-declared, and unverified/self-declared work.';

notify pgrst, 'reload schema';

commit;
