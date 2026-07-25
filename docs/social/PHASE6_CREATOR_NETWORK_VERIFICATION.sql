-- Latest follow rows with both handles.
select
  f.follower_id,
  follower.handle as follower_handle,
  f.creator_id,
  creator.handle as creator_handle,
  f.created_at
from public.follows f
join public.users follower on follower.id = f.follower_id
join public.users creator on creator.id = f.creator_id
order by f.created_at desc
limit 50;

-- Counts shown on public profiles.
select
  u.id,
  u.handle,
  (select count(*) from public.follows f where f.creator_id = u.id) as follower_count,
  (select count(*) from public.follows f where f.follower_id = u.id) as following_count,
  (
    select count(*)
    from public.works w
    where w.creator_id = u.id
      and w.status = 'verified'
      and w.proof_count >= 1
      and not coalesce(w.ai_declared, false)
      and w.removed_at is null
  ) as verified_work_count
from public.users u
order by u.handle;

-- Self-follow must always be zero.
select count(*) as self_follow_rows
from public.follows
where follower_id = creator_id;
