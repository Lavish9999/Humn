begin;

-- Phase 6 keeps follows as a shared backend primitive for web and future mobile.
-- Public reads support public follower/following lists. Mutations remain restricted
-- to the authenticated follower through the existing RLS policies.

create index if not exists follows_creator_created_idx
  on public.follows (creator_id, created_at desc, follower_id);

create index if not exists follows_follower_created_idx
  on public.follows (follower_id, created_at desc, creator_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.follows'::regclass
      and conname = 'follows_no_self_follow'
  ) then
    alter table public.follows
      add constraint follows_no_self_follow
      check (follower_id <> creator_id) not valid;
    alter table public.follows validate constraint follows_no_self_follow;
  end if;
end
$$;

-- Recent public work from followed creators. This is not a separate trust tier:
-- it reuses the same public-discoverability and provenance ranking rules as Discover.
drop function if exists public.get_following_work_feed(integer, integer);
create function public.get_following_work_feed(
  p_limit integer default 24,
  p_offset integer default 0
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
    w.ai_declared,
    w.report_count,
    public.work_feed_rank(w.id, w.status, w.origin_input, w.ai_declared, w.report_count),
    w.created_at,
    w.published_at,
    u.handle::text,
    u.display_name,
    u.avatar_url,
    u.reputation,
    badge.badge_variant,
    badge.badge_label
  from public.follows f
  join public.works w on w.creator_id = f.creator_id
  join public.users u on u.id = w.creator_id
  cross join lateral public.derive_work_badge(w.status, w.proof_count, w.ai_declared) badge
  where auth.uid() is not null
    and f.follower_id = auth.uid()
    and w.removed_at is null
    and w.status <> 'rejected'
    and public.is_default_discoverable_work(
      w.id, w.status, w.proof_count, w.origin_input, w.ai_declared
    )
  order by
    coalesce(w.published_at, w.created_at) desc,
    public.work_feed_rank(w.id, w.status, w.origin_input, w.ai_declared, w.report_count) desc,
    w.id desc
  limit least(greatest(coalesce(p_limit, 24), 1), 60)
  offset least(greatest(coalesce(p_offset, 0), 0), 10000);
$$;

-- Public, paginated creator-network lists. The viewer-following flag allows every
-- surface to render an immediately correct follow button without exposing private data.
drop function if exists public.get_creator_network(text, text, integer, integer);
create function public.get_creator_network(
  p_handle text,
  p_direction text,
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  id uuid,
  handle text,
  display_name text,
  avatar_url text,
  joined_at timestamptz,
  verified_work_count bigint,
  follower_count bigint,
  following_count bigint,
  is_followed_by_viewer boolean,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with target as (
    select u.id
    from public.users u
    where u.handle::text = lower(trim(p_handle))
    limit 1
  ), network as (
    select
      case
        when lower(trim(p_direction)) = 'following' then f.creator_id
        else f.follower_id
      end as user_id,
      f.created_at
    from public.follows f
    join target t on (
      (lower(trim(p_direction)) = 'following' and f.follower_id = t.id)
      or
      (lower(trim(p_direction)) <> 'following' and f.creator_id = t.id)
    )
  ), members as (
    select
      u.id,
      u.handle::text as handle,
      u.display_name,
      u.avatar_url,
      u.created_at as joined_at,
      n.created_at as followed_at
    from network n
    join public.users u on u.id = n.user_id
  )
  select
    m.id,
    m.handle,
    m.display_name,
    m.avatar_url,
    m.joined_at,
    (
      select count(*)
      from public.works w
      where w.creator_id = m.id
        and w.status = 'verified'
        and w.proof_count >= 1
        and not coalesce(w.ai_declared, false)
        and w.removed_at is null
    ) as verified_work_count,
    (select count(*) from public.follows ff where ff.creator_id = m.id) as follower_count,
    (select count(*) from public.follows ff where ff.follower_id = m.id) as following_count,
    case
      when auth.uid() is null then false
      else exists (
        select 1 from public.follows vf
        where vf.follower_id = auth.uid()
          and vf.creator_id = m.id
      )
    end as is_followed_by_viewer,
    count(*) over () as total_count
  from members m
  order by m.followed_at desc, m.handle asc
  limit least(greatest(coalesce(p_limit, 24), 1), 60)
  offset least(greatest(coalesce(p_offset, 0), 0), 10000);
$$;

grant execute on function public.get_following_work_feed(integer, integer) to authenticated;
grant execute on function public.get_creator_network(text, text, integer, integer) to anon, authenticated;

comment on function public.get_following_work_feed(integer, integer) is
  'Recent default-discoverable Works from creators followed by auth.uid(), newest first with provenance rank as a tie-breaker.';
comment on function public.get_creator_network(text, text, integer, integer) is
  'Public paginated followers/following list with positive creator counts and viewer follow state.';

commit;
