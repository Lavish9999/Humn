-- Replace the handle and optional collection name after completing the UI checks.

select
  c.id as collection_id,
  c.name,
  c.privacy,
  c.updated_at,
  ci.work_id,
  ci.added_at,
  w.title,
  badge.badge_label
from public.collections c
join public.users owner on owner.id = c.owner_id
left join public.collection_items ci on ci.collection_id = c.id
left join public.works w on w.id = ci.work_id
left join lateral public.derive_work_badge(w.status, w.proof_count, w.ai_declared) badge on true
where owner.handle = 'robertd44'
order by c.updated_at desc, ci.added_at desc nulls last;

-- Confirm names are unique per owner, ignoring case.
select owner_id, lower(name), count(*)
from public.collections
group by owner_id, lower(name)
having count(*) > 1;

-- Confirm no Work was deleted when a Collection or Collection item was deleted.
select id, title, status, removed_at
from public.works
where id = 'REPLACE_WITH_REMOVED_ITEM_WORK_ID';
