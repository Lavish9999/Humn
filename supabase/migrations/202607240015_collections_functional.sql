-- Phase 5: fully functional Collections.
-- Presentation remains unchanged; this migration adds integrity and server-query support only.

create unique index if not exists collections_owner_name_ci_unique
  on public.collections (owner_id, lower(name));

create or replace function public.create_collection_with_optional_work(
  p_name text,
  p_privacy public.humn_collection_privacy default 'private',
  p_work_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_collection public.collections;
begin
  if v_owner is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if char_length(trim(coalesce(p_name, ''))) < 1
     or char_length(trim(p_name)) > 100 then
    raise exception 'Collection name must be between 1 and 100 characters'
      using errcode = '22023';
  end if;

  insert into public.collections (owner_id, name, privacy)
  values (v_owner, trim(p_name), p_privacy)
  returning * into v_collection;

  if p_work_id is not null then
    if not exists (select 1 from public.works where id = p_work_id) then
      raise exception 'Work not found' using errcode = 'P0002';
    end if;

    insert into public.collection_items (collection_id, work_id)
    values (v_collection.id, p_work_id)
    on conflict (collection_id, work_id) do nothing;
  end if;

  return to_jsonb(v_collection);
end;
$$;

revoke all on function public.create_collection_with_optional_work(text, public.humn_collection_privacy, uuid)
  from public, anon, authenticated;
grant execute on function public.create_collection_with_optional_work(text, public.humn_collection_privacy, uuid)
  to authenticated;

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
    ),
    'works', coalesce((
      select jsonb_agg(ranked.work order by ranked.feed_rank desc, ranked.added_at desc)
      from (
        select
          public.work_feed_rank(
            w.id,
            w.status,
            w.origin_input,
            w.ai_declared,
            w.report_count
          ) as feed_rank,
          ci.added_at,
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
              w.id,
              w.status,
              w.origin_input,
              w.ai_declared,
              w.report_count
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
          w.status,
          w.proof_count,
          w.ai_declared
        ) badge
        where ci.collection_id = c.id
          and w.removed_at is null
          and w.status <> 'rejected'
      ) ranked
    ), '[]'::jsonb)
  )
  from public.collections c
  join public.users owner on owner.id = c.owner_id
  where c.id = p_collection_id;
$$;

revoke all on function public.get_collection_detail(uuid) from public;
grant execute on function public.get_collection_detail(uuid) to anon, authenticated;

comment on function public.get_collection_detail(uuid) is
  'RLS-enforced collection detail with provenance-ranked saved works. Private collections resolve only for their owner.';
