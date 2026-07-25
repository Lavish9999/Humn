-- Replace the handle only if testing with another account.
with target as (
  select id, handle, posting_cooldown_until, suspended_at
  from public.users
  where handle = 'robertd44'
)
select
  s.id as strike_id,
  t.handle,
  s.source,
  s.reason,
  s.evidence_hash,
  s.created_at,
  s.expires_at,
  s.appeal_status,
  t.posting_cooldown_until,
  t.suspended_at,
  public.active_strike_count(t.id) as active_count
from target t
left join public.strikes s on s.user_id = t.id
order by s.created_at desc nulls last;

-- Automatic C2PA rejections must have a strike but no public Work/file evidence
-- with the same SHA-256 hash.
select
  s.id as strike_id,
  s.evidence_hash,
  fe.work_id,
  w.status,
  w.origin_input
from public.strikes s
left join public.file_evidence fe on fe.original_hash = s.evidence_hash
left join public.works w on w.id = fe.work_id
where s.source = 'c2pa_ai'
order by s.created_at desc;

-- Normal no-metadata uploads must not create a strike. Inspect recent published
-- Works beside any strike created at the same time.
select
  w.id as work_id,
  w.title,
  w.status,
  w.origin_input,
  fe.original_hash,
  ps.value as c2pa_signal,
  s.id as strike_id
from public.works w
join public.users u on u.id = w.creator_id
left join public.file_evidence fe on fe.work_id = w.id
left join public.provenance_signals ps on ps.work_id = w.id and ps.signal_name = 'c2pa'
left join public.strikes s on s.user_id = w.creator_id
  and s.evidence_hash = fe.original_hash
where u.handle = 'robertd44'
order by w.created_at desc
limit 10;
