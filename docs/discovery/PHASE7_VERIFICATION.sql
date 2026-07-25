-- Run after creating at least one VERIFIED and one AWAITING Work.
-- This is read-only.

-- 1. Show the shared rank and prove tier ordering on current public Works.
select
  w.id,
  w.title,
  w.status,
  w.proof_count,
  w.origin_input,
  w.report_count,
  public.work_feed_rank(w.id, w.status, w.origin_input, w.ai_declared, w.report_count) as shared_rank,
  coalesce(w.published_at, w.created_at) as ranked_at
from public.works w
where w.removed_at is null
  and w.status <> 'rejected'
  and not coalesce(w.ai_declared, false)
order by shared_rank desc, ranked_at desc, w.id desc;

-- 2. Search a real title fragment and inspect the same rank order.
select id, title, status, feed_rank, creator_handle, badge_label
from public.search_work_feed('test', null, null, null, 20);

-- 3. Verify creator matching and live follow state.
select id, handle, display_name, verified_work_count, follower_count, is_followed_by_viewer
from public.search_creators('robert', null, null, null, 20);

-- 4. Confirm no AI-declared or bare unverified Work enters the default query.
select id, title, status, proof_count, ai_declared, feed_rank
from public.get_filtered_work_feed(null, 'all', null, null, null, null, 60)
where ai_declared
   or not public.is_default_discoverable_work(id, status, proof_count, origin_input, ai_declared);
-- Expected: zero rows.

-- 5. Filter by category and VERIFIED tier. Change the category slug if needed.
select id, title, status, category, feed_rank
from public.get_filtered_work_feed(array['photography'], 'verified', null, null, null, null, 60);

-- 6. Moderation role source used by the server nav and route gate.
select id, handle, is_admin, reviewer_level,
       (is_admin or reviewer_level > 0) as can_review
from public.users
order by handle;
