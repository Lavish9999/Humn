begin;

-- Phase 7: one mechanical provenance rank for every public discovery surface.
-- This does not classify pixels or alter trust tiers. It only guarantees that a
-- clean VERIFIED Work ranks above AWAITING, which ranks above strong provenance.
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
      when coalesce(p_ai_declared, false) then -100000
      when p_status = 'verified' then 20000
      when p_status = 'awaiting' then 10000
      when public.work_has_strong_provenance(p_work_id, p_origin_input) then 5000
      else 0
    end
    + case when p_origin_input = 'captured_in_app' then 250 else 0 end
    + least(
        500,
        greatest(
          -500,
          coalesce((
            select sum(ps.weight)::integer
            from public.provenance_signals ps
            where ps.work_id = p_work_id
          ), 0)
        )
      )
    - least(greatest(coalesce(p_report_count, 0), 0), 10) * 500;
$$;

grant execute on function public.work_feed_rank(
  uuid, public.humn_work_status, public.humn_origin_input, boolean, integer
) to anon, authenticated;

comment on function public.work_feed_rank(
  uuid, public.humn_work_status, public.humn_origin_input, boolean, integer
) is
'Single provenance-ranking source for Discover, Following, Search, creator showcases, and Collections. No appearance classifier or AI-likelihood score is used.';

create or replace function public.humn_category_display_name(p_slug text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case p_slug
    when 'tattoos' then 'Tattoos'
    when 'hairstyles' then 'Hairstyles'
    when 'outfits' then 'Outfits'
    when 'home-interiors' then 'Home Interiors'
    when 'food-recipes' then 'Food & Recipes'
    when 'traditional-art' then 'Traditional Art'
    when 'digital-art' then 'Digital Art'
    when 'photography' then 'Photography'
    when 'crafts-diy' then 'Crafts & DIY'
    when 'furniture-woodworking' then 'Furniture & Woodworking'
    when 'weddings-events' then 'Weddings & Events'
    when 'beauty-makeup' then 'Beauty & Makeup'
    when 'landscaping-gardens' then 'Landscaping & Gardens'
    else p_slug
  end;
$$;

grant execute on function public.humn_category_display_name(text) to anon, authenticated;

create or replace function public.work_matches_discover_filters(
  p_work_id uuid,
  p_category text,
  p_status public.humn_work_status,
  p_proof_count integer,
  p_origin_input public.humn_origin_input,
  p_ai_declared boolean,
  p_categories text[],
  p_tier_mode text,
  p_origins public.humn_origin_input[]
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select
    not coalesce(p_ai_declared, false)
    and (p_categories is null or cardinality(p_categories) = 0 or p_category = any(p_categories))
    and (p_origins is null or cardinality(p_origins) = 0 or p_origin_input = any(p_origins))
    and case lower(coalesce(nullif(trim(p_tier_mode), ''), 'all'))
      when 'verified' then
        p_status = 'verified' and greatest(coalesce(p_proof_count, 0), 0) >= 1
      when 'reviewed' then
        p_status in ('verified', 'awaiting') and greatest(coalesce(p_proof_count, 0), 0) >= 1
      when 'provenance' then
        (p_status = 'verified' and greatest(coalesce(p_proof_count, 0), 0) >= 1)
        or public.work_has_strong_provenance(p_work_id, p_origin_input)
      else
        public.is_default_discoverable_work(
          p_work_id, p_status, p_proof_count, p_origin_input, p_ai_declared
        )
    end;
$$;

grant execute on function public.work_matches_discover_filters(
  uuid, text, public.humn_work_status, integer, public.humn_origin_input,
  boolean, text[], text, public.humn_origin_input[]
) to anon, authenticated;

-- Cursor-based, filterable default Discover feed.
drop function if exists public.get_filtered_work_feed(
  text[], text, public.humn_origin_input[], integer, timestamptz, uuid, integer
);
create function public.get_filtered_work_feed(
  p_categories text[] default null,
  p_tier_mode text default 'all',
  p_origins public.humn_origin_input[] default null,
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
      public.work_feed_rank(
        w.id, w.status, w.origin_input, w.ai_declared, w.report_count
      ) as rank_score
    from public.works w
    where w.removed_at is null
      and w.status <> 'rejected'
      and public.work_matches_discover_filters(
        w.id,
        w.category,
        w.status,
        w.proof_count,
        w.origin_input,
        w.ai_declared,
        p_categories,
        p_tier_mode,
        p_origins
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
        (
          p_cursor_rank,
          coalesce(p_cursor_published_at, 'infinity'::timestamptz),
          coalesce(p_cursor_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)
        )
  order by w.rank_score desc, coalesce(w.published_at, w.created_at) desc, w.id desc
  limit least(greatest(coalesce(p_limit, 24), 1), 60);
$$;

-- Explicit unverified/new area. It remains separate from default discovery.
drop function if exists public.get_filtered_unverified_work_feed(
  text[], public.humn_origin_input[], integer, timestamptz, uuid, integer
);
create function public.get_filtered_unverified_work_feed(
  p_categories text[] default null,
  p_origins public.humn_origin_input[] default null,
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
      public.work_feed_rank(
        w.id, w.status, w.origin_input, w.ai_declared, w.report_count
      ) as rank_score
    from public.works w
    where w.removed_at is null
      and w.status <> 'rejected'
      and not coalesce(w.ai_declared, false)
      and not public.is_default_discoverable_work(
        w.id, w.status, w.proof_count, w.origin_input, w.ai_declared
      )
      and (p_categories is null or cardinality(p_categories) = 0 or w.category = any(p_categories))
      and (p_origins is null or cardinality(p_origins) = 0 or w.origin_input = any(p_origins))
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
        (
          p_cursor_rank,
          coalesce(p_cursor_published_at, 'infinity'::timestamptz),
          coalesce(p_cursor_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)
        )
  order by w.rank_score desc, coalesce(w.published_at, w.created_at) desc, w.id desc
  limit least(greatest(coalesce(p_limit, 24), 1), 60);
$$;

-- Cursor-based Following feed using the exact same rank and filters as Discover.
drop function if exists public.get_following_work_feed(integer, integer);
drop function if exists public.get_following_work_feed(
  text[], text, public.humn_origin_input[], integer, timestamptz, uuid, integer
);
create function public.get_following_work_feed(
  p_categories text[] default null,
  p_tier_mode text default 'all',
  p_origins public.humn_origin_input[] default null,
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
      public.work_feed_rank(
        w.id, w.status, w.origin_input, w.ai_declared, w.report_count
      ) as rank_score
    from public.follows f
    join public.works w on w.creator_id = f.creator_id
    where auth.uid() is not null
      and f.follower_id = auth.uid()
      and w.removed_at is null
      and w.status <> 'rejected'
      and public.work_matches_discover_filters(
        w.id,
        w.category,
        w.status,
        w.proof_count,
        w.origin_input,
        w.ai_declared,
        p_categories,
        p_tier_mode,
        p_origins
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
        (
          p_cursor_rank,
          coalesce(p_cursor_published_at, 'infinity'::timestamptz),
          coalesce(p_cursor_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)
        )
  order by w.rank_score desc, coalesce(w.published_at, w.created_at) desc, w.id desc
  limit least(greatest(coalesce(p_limit, 24), 1), 60);
$$;

-- Work search matches title, description, canonical category label, and creator identity.
drop function if exists public.search_work_feed(text, integer, boolean);
drop function if exists public.search_work_feed(text, integer, timestamptz, uuid, integer);
create function public.search_work_feed(
  p_query text,
  p_cursor_rank integer default null,
  p_cursor_published_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 20
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
      u.handle::text as creator_handle,
      u.display_name as creator_display_name,
      u.avatar_url as creator_avatar_url,
      u.reputation as creator_reputation,
      public.work_feed_rank(
        w.id, w.status, w.origin_input, w.ai_declared, w.report_count
      ) as rank_score
    from public.works w
    join public.users u on u.id = w.creator_id
    where w.removed_at is null
      and w.status <> 'rejected'
      and public.is_default_discoverable_work(
        w.id, w.status, w.proof_count, w.origin_input, w.ai_declared
      )
      and not coalesce(w.ai_declared, false)
      and (
        w.search_document @@ websearch_to_tsquery('english', trim(p_query))
        or w.title ilike '%' || trim(p_query) || '%'
        or coalesce(w.description, '') ilike '%' || trim(p_query) || '%'
        or w.category ilike '%' || trim(p_query) || '%'
        or public.humn_category_display_name(w.category) ilike '%' || trim(p_query) || '%'
        or u.handle::text ilike '%' || trim(p_query) || '%'
        or u.display_name ilike '%' || trim(p_query) || '%'
      )
  )
  select
    w.id, w.creator_id, w.title, w.description, w.category, w.aspect_ratio,
    w.image_url, w.thumb_url, w.origin_input, w.status, w.proof_count,
    w.ai_declared, w.report_count, w.rank_score,
    w.created_at, w.published_at,
    w.creator_handle, w.creator_display_name, w.creator_avatar_url, w.creator_reputation,
    badge.badge_variant, badge.badge_label
  from ranked w
  cross join lateral public.derive_work_badge(w.status, w.proof_count, w.ai_declared) badge
  where p_cursor_rank is null
     or (w.rank_score, coalesce(w.published_at, w.created_at), w.id) <
        (
          p_cursor_rank,
          coalesce(p_cursor_published_at, 'infinity'::timestamptz),
          coalesce(p_cursor_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)
        )
  order by w.rank_score desc, coalesce(w.published_at, w.created_at) desc, w.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 60);
$$;

-- Compact creator results use only positive public counts.
drop function if exists public.search_creators(text, bigint, text, uuid, integer);
create function public.search_creators(
  p_query text,
  p_cursor_verified_count bigint default null,
  p_cursor_handle text default null,
  p_cursor_id uuid default null,
  p_limit integer default 8
)
returns table (
  id uuid,
  handle text,
  display_name text,
  avatar_url text,
  joined_at timestamptz,
  verified_work_count bigint,
  follower_count bigint,
  is_followed_by_viewer boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  with matched as (
    select
      u.id,
      u.handle::text as handle,
      u.display_name,
      u.avatar_url,
      u.created_at as joined_at,
      (
        select count(*)
        from public.works w
        where w.creator_id = u.id
          and w.status = 'verified'
          and w.proof_count >= 1
          and not coalesce(w.ai_declared, false)
          and w.removed_at is null
      )::bigint as verified_work_count,
      (select count(*) from public.follows f where f.creator_id = u.id)::bigint as follower_count
    from public.users u
    where u.handle::text ilike '%' || trim(p_query) || '%'
       or u.display_name ilike '%' || trim(p_query) || '%'
  )
  select
    m.id,
    m.handle,
    m.display_name,
    m.avatar_url,
    m.joined_at,
    m.verified_work_count,
    m.follower_count,
    case
      when auth.uid() is null then false
      else exists (
        select 1
        from public.follows f
        where f.follower_id = auth.uid()
          and f.creator_id = m.id
      )
    end
  from matched m
  where p_cursor_verified_count is null
     or m.verified_work_count < p_cursor_verified_count
     or (
       m.verified_work_count = p_cursor_verified_count
       and (m.handle, m.id) >
         (coalesce(p_cursor_handle, ''), coalesce(p_cursor_id, '00000000-0000-0000-0000-000000000000'::uuid))
     )
  order by m.verified_work_count desc, m.handle asc, m.id asc
  limit least(greatest(coalesce(p_limit, 8), 1), 40);
$$;

-- Capability data keeps unavailable origin filters out of the UI.
drop function if exists public.get_discover_filter_capabilities();
create function public.get_discover_filter_capabilities()
returns table (has_captured_in_app boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.works w
    where w.origin_input = 'captured_in_app'
      and w.removed_at is null
      and w.status <> 'rejected'
      and not coalesce(w.ai_declared, false)
  );
$$;

-- Creator showcases use the same rank, then newest as the only tie-breaker.
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
    w.id, w.creator_id, w.title, w.description, w.category, w.aspect_ratio,
    w.image_url, w.thumb_url, w.origin_input, w.status, w.proof_count,
    coalesce(w.ai_declared, false), coalesce(w.report_count, 0),
    public.work_feed_rank(w.id, w.status, w.origin_input, w.ai_declared, w.report_count),
    w.created_at, w.published_at,
    u.handle::text, u.display_name, u.avatar_url, u.reputation,
    badge.badge_variant, badge.badge_label
  from public.users u
  join public.works w on w.creator_id = u.id
  cross join lateral public.derive_work_badge(w.status, w.proof_count, w.ai_declared) badge
  where lower(u.handle::text) = lower(trim(p_handle))
    and w.removed_at is null
    and not coalesce(w.ai_declared, false)
    and w.proof_count >= 1
    and w.status in ('verified', 'awaiting')
  order by
    public.work_feed_rank(w.id, w.status, w.origin_input, w.ai_declared, w.report_count) desc,
    coalesce(w.published_at, w.created_at) desc,
    w.id desc
  limit least(greatest(coalesce(p_limit, 60), 1), 100);
$$;

-- Collection detail keeps every saved Work visible to the collection's authorized
-- viewer, but orders all of them through the same provenance rank.
create or replace function public.get_collection_detail(p_collection_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'id', c.id,
    'owner_id', c.owner_id,
    'name', c.name,
    'privacy', c.privacy,
    'created_at', c.created_at,
    'updated_at', c.updated_at,
    'owner', jsonb_build_object(
      'id', owner.id,
      'handle', owner.handle,
      'display_name', owner.display_name,
      'avatar_url', owner.avatar_url
    ),
    'work_count', (
      select count(*)::integer
      from public.collection_items count_item
      join public.works count_work on count_work.id = count_item.work_id
      where count_item.collection_id = c.id
        and count_work.removed_at is null
        and count_work.status <> 'rejected'
        and not coalesce(count_work.ai_declared, false)
    ),
    'works', coalesce((
      select jsonb_agg(
        ranked.work
        order by ranked.feed_rank desc, ranked.published_at desc, ranked.work_id desc
      )
      from (
        select
          w.id as work_id,
          coalesce(w.published_at, w.created_at) as published_at,
          public.work_feed_rank(
            w.id, w.status, w.origin_input, w.ai_declared, w.report_count
          ) as feed_rank,
          jsonb_build_object(
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
            'feed_rank', public.work_feed_rank(
              w.id, w.status, w.origin_input, w.ai_declared, w.report_count
            ),
            'created_at', w.created_at,
            'published_at', w.published_at,
            'creator_handle', creator.handle::text,
            'creator_display_name', creator.display_name,
            'creator_avatar_url', creator.avatar_url,
            'creator_reputation', creator.reputation,
            'badge_variant', badge.badge_variant,
            'badge_label', badge.badge_label,
            'added_at', ci.added_at
          ) as work
        from public.collection_items ci
        join public.works w on w.id = ci.work_id
        join public.users creator on creator.id = w.creator_id
        cross join lateral public.derive_work_badge(
          w.status, w.proof_count, w.ai_declared
        ) badge
        where ci.collection_id = c.id
          and w.removed_at is null
          and w.status <> 'rejected'
          and not coalesce(w.ai_declared, false)
      ) ranked
    ), '[]'::jsonb)
  )
  from public.collections c
  join public.users owner on owner.id = c.owner_id
  where c.id = p_collection_id;
$$;

create index if not exists works_title_trgm_idx
  on public.works using gin (title gin_trgm_ops);
create index if not exists works_description_trgm_idx
  on public.works using gin (description gin_trgm_ops);
create index if not exists users_handle_text_trgm_idx
  on public.users using gin ((handle::text) gin_trgm_ops);
create index if not exists users_display_name_trgm_idx
  on public.users using gin (display_name gin_trgm_ops);

revoke all on function public.get_filtered_work_feed(
  text[], text, public.humn_origin_input[], integer, timestamptz, uuid, integer
) from public;
revoke all on function public.get_filtered_unverified_work_feed(
  text[], public.humn_origin_input[], integer, timestamptz, uuid, integer
) from public;
revoke all on function public.get_following_work_feed(
  text[], text, public.humn_origin_input[], integer, timestamptz, uuid, integer
) from public;
revoke all on function public.search_work_feed(text, integer, timestamptz, uuid, integer) from public;
revoke all on function public.search_creators(text, bigint, text, uuid, integer) from public;
revoke all on function public.get_discover_filter_capabilities() from public;

grant execute on function public.get_filtered_work_feed(
  text[], text, public.humn_origin_input[], integer, timestamptz, uuid, integer
) to anon, authenticated;
grant execute on function public.get_filtered_unverified_work_feed(
  text[], public.humn_origin_input[], integer, timestamptz, uuid, integer
) to anon, authenticated;
grant execute on function public.get_following_work_feed(
  text[], text, public.humn_origin_input[], integer, timestamptz, uuid, integer
) to authenticated;
grant execute on function public.search_work_feed(text, integer, timestamptz, uuid, integer)
  to anon, authenticated;
grant execute on function public.search_creators(text, bigint, text, uuid, integer)
  to anon, authenticated;
grant execute on function public.get_discover_filter_capabilities()
  to anon, authenticated;

notify pgrst, 'reload schema';

commit;
