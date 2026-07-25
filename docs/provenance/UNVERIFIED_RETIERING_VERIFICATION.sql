-- Latest creator Works, badge, default-feed eligibility and rank.
select
  w.id,
  w.title,
  w.status,
  w.proof_count,
  w.origin_input,
  w.ai_declared,
  b.badge_variant,
  b.badge_label,
  public.is_default_discoverable_work(
    w.id, w.status, w.proof_count, w.origin_input, w.ai_declared
  ) as appears_in_default_discover,
  public.work_feed_rank(
    w.id, w.status, w.origin_input, w.ai_declared, w.report_count
  ) as feed_rank
from public.works w
join public.users u on u.id = w.creator_id
cross join lateral public.derive_work_badge(w.status, w.proof_count, w.ai_declared) b
where u.handle = 'robertd44'
order by w.created_at desc;

-- Explicit unverified/new area.
select id, title, badge_label, feed_rank
from public.get_unverified_work_feed(null, null, null, 60);

-- Default Discover must not contain unverified badges.
select id, title, badge_label, feed_rank
from public.get_work_feed(null, null, null, 60)
where badge_variant = 'unverified';
