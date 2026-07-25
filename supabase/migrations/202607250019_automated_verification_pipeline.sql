begin;

-- Automated verification is deliberately separate from provenance collection.
-- C2PA, EXIF, duplicate hashes and origin_input remain integrity/provenance inputs.
-- Only service_role may claim a run or assign an automated VERIFIED/REJECTED result.

create table if not exists public.verification_pipeline_config (
  singleton boolean primary key default true check (singleton),
  pipeline_version text not null,
  primary_provider text not null,
  secondary_provider text not null,
  ai_reject_threshold numeric(5,4) not null check (ai_reject_threshold between 0 and 1),
  ai_clear_threshold numeric(5,4) not null check (ai_clear_threshold between 0 and 1),
  min_confidence numeric(5,4) not null check (min_confidence between 0 and 1),
  deepfake_reject_threshold numeric(5,4) not null check (deepfake_reject_threshold between 0 and 1),
  recapture_escalate_threshold numeric(5,4) not null check (recapture_escalate_threshold between 0 and 1),
  local_screen_escalate_threshold numeric(5,4) not null check (local_screen_escalate_threshold between 0 and 1),
  optional_region_escalate_threshold numeric(5,4) not null check (optional_region_escalate_threshold between 0 and 1),
  provider_timeout_ms integer not null check (provider_timeout_ms between 1000 and 60000),
  rate_limit_per_hour integer not null check (rate_limit_per_hour between 1 and 100),
  max_attempts integer not null check (max_attempts between 1 and 10),
  optional_provider_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  check (ai_clear_threshold < ai_reject_threshold)
);

insert into public.verification_pipeline_config (
  singleton,
  pipeline_version,
  primary_provider,
  secondary_provider,
  ai_reject_threshold,
  ai_clear_threshold,
  min_confidence,
  deepfake_reject_threshold,
  recapture_escalate_threshold,
  local_screen_escalate_threshold,
  optional_region_escalate_threshold,
  provider_timeout_ms,
  rate_limit_per_hour,
  max_attempts,
  optional_provider_enabled
) values (
  true,
  '2026-07-25.1',
  'sightengine',
  'hive',
  0.9000,
  0.1000,
  0.8000,
  0.9000,
  0.5000,
  0.6000,
  0.5000,
  15000,
  5,
  3,
  false
)
on conflict (singleton) do nothing;

create table if not exists public.verification_pipeline_runs (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works(id) on delete cascade,
  creator_id uuid not null references public.users(id) on delete cascade,
  requested_by uuid references public.users(id) on delete set null,
  state text not null default 'queued' check (state in ('queued', 'running', 'completed')),
  decision text check (decision is null or decision in ('verified', 'rejected', 'escalate')),
  reason_code text,
  reason text,
  pipeline_version text,
  thresholds jsonb not null default '{}'::jsonb,
  screen_heuristics jsonb not null default '{}'::jsonb,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  evidence_digest text check (evidence_digest is null or evidence_digest ~ '^[a-f0-9]{64}$'),
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index if not exists verification_runs_one_active_work_idx
  on public.verification_pipeline_runs (work_id)
  where state in ('queued', 'running');
create index if not exists verification_runs_queue_idx
  on public.verification_pipeline_runs (state, queued_at, id);
create index if not exists verification_runs_creator_time_idx
  on public.verification_pipeline_runs (creator_id, queued_at desc);

create table if not exists public.verification_detector_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.verification_pipeline_runs(id) on delete cascade,
  work_id uuid not null references public.works(id) on delete cascade,
  provider text not null,
  provider_role text not null check (provider_role in ('primary', 'secondary', 'optional', 'local')),
  detector_kind text not null default 'ai_image',
  status text not null check (status in ('ok', 'unavailable', 'error', 'timeout')),
  model_version text,
  ai_score numeric(7,6) check (ai_score is null or ai_score between 0 and 1),
  authentic_score numeric(7,6) check (authentic_score is null or authentic_score between 0 and 1),
  confidence numeric(7,6) check (confidence is null or confidence between 0 and 1),
  recapture_score numeric(7,6) check (recapture_score is null or recapture_score between 0 and 1),
  deepfake_score numeric(7,6) check (deepfake_score is null or deepfake_score between 0 and 1),
  partial_ai_score numeric(7,6) check (partial_ai_score is null or partial_ai_score between 0 and 1),
  content_flags jsonb not null default '{}'::jsonb,
  raw_response jsonb not null default '{}'::jsonb,
  error_code text,
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  created_at timestamptz not null default now(),
  unique (run_id, provider)
);

create index if not exists verification_detector_results_work_idx
  on public.verification_detector_results (work_id, created_at desc);

create table if not exists public.verification_audit_events (
  id bigint generated always as identity primary key,
  run_id uuid references public.verification_pipeline_runs(id) on delete cascade,
  work_id uuid not null references public.works(id) on delete cascade,
  creator_id uuid not null references public.users(id) on delete cascade,
  actor_type text not null check (actor_type in ('creator', 'pipeline', 'reviewer', 'system')),
  actor_id uuid references public.users(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists verification_audit_work_created_idx
  on public.verification_audit_events (work_id, created_at desc);

alter table public.verification_pipeline_config enable row level security;
alter table public.verification_pipeline_runs enable row level security;
alter table public.verification_detector_results enable row level security;
alter table public.verification_audit_events enable row level security;

revoke all on public.verification_pipeline_config,
  public.verification_pipeline_runs,
  public.verification_detector_results,
  public.verification_audit_events
from public, anon, authenticated;

-- Creators can see run-level status and audit events for their own Work. Raw vendor
-- responses stay server/reviewer-only; public/creator UI receives a sanitized RPC.
create policy verification_runs_owner_or_reviewer_read
on public.verification_pipeline_runs for select to authenticated
using (
  creator_id = (select auth.uid())
  or public.is_humn_reviewer((select auth.uid()))
);

create policy verification_results_reviewer_read
on public.verification_detector_results for select to authenticated
using (public.is_humn_reviewer((select auth.uid())));

create policy verification_audit_owner_or_reviewer_read
on public.verification_audit_events for select to authenticated
using (
  creator_id = (select auth.uid())
  or public.is_humn_reviewer((select auth.uid()))
);

grant select on public.verification_pipeline_runs, public.verification_audit_events to authenticated;
grant select on public.verification_detector_results to authenticated;

create or replace function public.request_work_verification(p_work_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_work public.works%rowtype;
  v_config public.verification_pipeline_config%rowtype;
  v_recent integer;
  v_run_id uuid;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_config
  from public.verification_pipeline_config
  where singleton = true;

  if not found then
    raise exception 'Verification pipeline configuration is unavailable';
  end if;

  select * into v_work
  from public.works
  where id = p_work_id
  for update;

  if not found or v_work.creator_id <> v_user then
    raise exception 'Work not found' using errcode = 'P0002';
  end if;
  if v_work.removed_at is not null then
    raise exception 'Removed work cannot be submitted';
  end if;
  if v_work.status <> 'declared' then
    raise exception 'Only a self-declared Work can enter automated review';
  end if;
  if v_work.ai_declared then
    raise exception 'C2PA-declared AI work is not eligible for automated clearance';
  end if;
  if v_work.proof_count < 1 then
    raise exception 'Add at least one proof entry before requesting verification';
  end if;

  select count(*)::integer into v_recent
  from public.verification_pipeline_runs vr
  where vr.creator_id = v_user
    and vr.queued_at >= now() - interval '1 hour';

  if v_recent >= v_config.rate_limit_per_hour then
    raise exception 'Automated review rate limit reached. Try again later.' using errcode = 'P0001';
  end if;

  update public.works
  set status = 'awaiting',
      verification_requested_at = now(),
      review_note = null
  where id = p_work_id;

  insert into public.review_requests (work_id, trigger_type, requested_by)
  values (p_work_id, 'verification_request', v_user)
  on conflict (work_id, trigger_type) where state = 'open' do nothing;

  insert into public.verification_pipeline_runs (
    work_id, creator_id, requested_by, state, pipeline_version
  ) values (
    p_work_id, v_user, v_user, 'queued', v_config.pipeline_version
  )
  returning id into v_run_id;

  insert into public.verification_audit_events (
    run_id, work_id, creator_id, actor_type, actor_id, event_type, metadata
  ) values (
    v_run_id,
    p_work_id,
    v_user,
    'creator',
    v_user,
    'verification_queued',
    jsonb_build_object(
      'pipeline_version', v_config.pipeline_version,
      'rate_limit_per_hour', v_config.rate_limit_per_hour
    )
  );

  return v_run_id;
end;
$$;

revoke all on function public.request_work_verification(uuid) from public, anon;
grant execute on function public.request_work_verification(uuid) to authenticated;

create or replace function public.claim_verification_run(p_work_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.verification_pipeline_runs%rowtype;
  v_config public.verification_pipeline_config%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Trusted server access required' using errcode = '42501';
  end if;

  select * into v_config
  from public.verification_pipeline_config
  where singleton = true;

  select vr.* into v_run
  from public.verification_pipeline_runs vr
  where vr.state = 'queued'
    and (p_work_id is null or vr.work_id = p_work_id)
    and vr.attempt_count < v_config.max_attempts
  order by vr.queued_at, vr.id
  for update skip locked
  limit 1;

  if not found then
    return null;
  end if;

  update public.verification_pipeline_runs
  set state = 'running',
      attempt_count = attempt_count + 1,
      started_at = now(),
      updated_at = now(),
      pipeline_version = v_config.pipeline_version
  where id = v_run.id
  returning * into v_run;

  insert into public.verification_audit_events (
    run_id, work_id, creator_id, actor_type, event_type, metadata
  ) values (
    v_run.id,
    v_run.work_id,
    v_run.creator_id,
    'pipeline',
    'verification_started',
    jsonb_build_object('attempt', v_run.attempt_count, 'pipeline_version', v_config.pipeline_version)
  );

  return jsonb_build_object(
    'run_id', v_run.id,
    'work_id', v_run.work_id,
    'creator_id', v_run.creator_id,
    'attempt_count', v_run.attempt_count,
    'pipeline_version', v_config.pipeline_version,
    'config', to_jsonb(v_config) - 'singleton' - 'updated_at'
  );
end;
$$;

revoke all on function public.claim_verification_run(uuid) from public, anon, authenticated;
grant execute on function public.claim_verification_run(uuid) to service_role;

create or replace function public.complete_verification_run(
  p_run_id uuid,
  p_decision text,
  p_reason_code text,
  p_reason text,
  p_pipeline_version text,
  p_thresholds jsonb,
  p_results jsonb,
  p_screen_heuristics jsonb default '{}'::jsonb
)
returns public.humn_work_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.verification_pipeline_runs%rowtype;
  v_work public.works%rowtype;
  v_config public.verification_pipeline_config%rowtype;
  v_result jsonb;
  v_next public.humn_work_status;
  v_required_clear integer;
  v_required_errors integer;
  v_strong_ai integer;
  v_recapture integer;
  v_partial integer;
  v_duplicate boolean;
  v_screen_score numeric;
  v_digest text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Trusted server access required' using errcode = '42501';
  end if;
  if p_decision not in ('verified', 'rejected', 'escalate') then
    raise exception 'Invalid automated decision';
  end if;
  if jsonb_typeof(coalesce(p_results, '[]'::jsonb)) <> 'array' then
    raise exception 'Detector results must be an array';
  end if;

  select * into v_config
  from public.verification_pipeline_config
  where singleton = true;

  select * into v_run
  from public.verification_pipeline_runs
  where id = p_run_id
  for update;

  if not found or v_run.state <> 'running' then
    raise exception 'Verification run is not claimable' using errcode = 'P0002';
  end if;

  select * into v_work
  from public.works
  where id = v_run.work_id
  for update;

  if not found or v_work.status <> 'awaiting' then
    raise exception 'Work is not awaiting automated review';
  end if;

  select count(*)::integer into v_required_clear
  from jsonb_array_elements(p_results) r
  where r->>'role' in ('primary', 'secondary')
    and r->>'status' = 'ok'
    and nullif(r->>'aiScore', '')::numeric <= v_config.ai_clear_threshold
    and nullif(r->>'confidence', '')::numeric >= v_config.min_confidence;

  select count(*)::integer into v_required_errors
  from jsonb_array_elements(p_results) r
  where r->>'role' in ('primary', 'secondary')
    and r->>'status' <> 'ok';

  select count(*)::integer into v_strong_ai
  from jsonb_array_elements(p_results) r
  where r->>'role' in ('primary', 'secondary')
    and r->>'status' = 'ok'
    and (
      coalesce(nullif(r->>'aiScore', '')::numeric, 0) >= v_config.ai_reject_threshold
      or coalesce(nullif(r->>'deepfakeScore', '')::numeric, 0) >= v_config.deepfake_reject_threshold
    );

  select count(*)::integer into v_recapture
  from jsonb_array_elements(p_results) r
  where r->>'status' = 'ok'
    and coalesce(nullif(r->>'recaptureScore', '')::numeric, 0) >= v_config.recapture_escalate_threshold;

  select count(*)::integer into v_partial
  from jsonb_array_elements(p_results) r
  where r->>'role' = 'optional'
    and r->>'status' = 'ok'
    and coalesce(nullif(r->>'partialAiScore', '')::numeric, 0) >= v_config.optional_region_escalate_threshold;

  select coalesce((ps.value->>'duplicate')::boolean, false) into v_duplicate
  from public.provenance_signals ps
  where ps.work_id = v_work.id and ps.signal_name = 'duplicate_hash';
  v_duplicate := coalesce(v_duplicate, false);
  v_screen_score := coalesce(nullif(p_screen_heuristics->>'score', '')::numeric, 0);

  -- The database independently enforces the conservative agreement rule. A bug
  -- in application code cannot award VERIFIED without two clear required results.
  if p_decision = 'verified' then
    if v_work.ai_declared
       or v_duplicate
       or v_required_clear <> 2
       or v_required_errors <> 0
       or v_strong_ai <> 0
       or v_recapture <> 0
       or v_partial <> 0
       or v_screen_score >= v_config.local_screen_escalate_threshold
    then
      raise exception 'Automated VERIFIED requirements were not satisfied' using errcode = '42501';
    end if;
    v_next := 'verified';
  elsif p_decision = 'rejected' then
    if not v_work.ai_declared and v_strong_ai = 0 then
      raise exception 'Automated REJECTED requires an explicit strong synthetic signal' using errcode = '42501';
    end if;
    v_next := 'rejected';
  else
    v_next := 'awaiting';
  end if;

  for v_result in select value from jsonb_array_elements(p_results) loop
    insert into public.verification_detector_results (
      run_id,
      work_id,
      provider,
      provider_role,
      detector_kind,
      status,
      model_version,
      ai_score,
      authentic_score,
      confidence,
      recapture_score,
      deepfake_score,
      partial_ai_score,
      content_flags,
      raw_response,
      error_code,
      latency_ms
    ) values (
      p_run_id,
      v_work.id,
      coalesce(nullif(v_result->>'provider', ''), 'unknown'),
      coalesce(nullif(v_result->>'role', ''), 'optional'),
      coalesce(nullif(v_result->>'detectorKind', ''), 'ai_image'),
      coalesce(nullif(v_result->>'status', ''), 'error'),
      nullif(v_result->>'modelVersion', ''),
      nullif(v_result->>'aiScore', '')::numeric,
      nullif(v_result->>'authenticScore', '')::numeric,
      nullif(v_result->>'confidence', '')::numeric,
      nullif(v_result->>'recaptureScore', '')::numeric,
      nullif(v_result->>'deepfakeScore', '')::numeric,
      nullif(v_result->>'partialAiScore', '')::numeric,
      coalesce(v_result->'contentFlags', '{}'::jsonb),
      coalesce(v_result->'rawResponse', '{}'::jsonb),
      nullif(v_result->>'errorCode', ''),
      nullif(v_result->>'latencyMs', '')::integer
    )
    on conflict (run_id, provider) do update set
      status = excluded.status,
      model_version = excluded.model_version,
      ai_score = excluded.ai_score,
      authentic_score = excluded.authentic_score,
      confidence = excluded.confidence,
      recapture_score = excluded.recapture_score,
      deepfake_score = excluded.deepfake_score,
      partial_ai_score = excluded.partial_ai_score,
      content_flags = excluded.content_flags,
      raw_response = excluded.raw_response,
      error_code = excluded.error_code,
      latency_ms = excluded.latency_ms,
      created_at = now();
  end loop;

  v_digest := encode(
    extensions.digest(
      convert_to(
        coalesce(p_pipeline_version, '') || '|' ||
        coalesce(p_decision, '') || '|' ||
        coalesce(p_thresholds, '{}'::jsonb)::text || '|' ||
        coalesce(p_results, '[]'::jsonb)::text || '|' ||
        coalesce(p_screen_heuristics, '{}'::jsonb)::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  update public.verification_pipeline_runs
  set state = 'completed',
      decision = p_decision,
      reason_code = nullif(trim(coalesce(p_reason_code, '')), ''),
      reason = nullif(trim(coalesce(p_reason, '')), ''),
      pipeline_version = coalesce(nullif(trim(p_pipeline_version), ''), v_config.pipeline_version),
      thresholds = coalesce(p_thresholds, '{}'::jsonb),
      screen_heuristics = coalesce(p_screen_heuristics, '{}'::jsonb),
      evidence_digest = v_digest,
      completed_at = now(),
      updated_at = now()
  where id = p_run_id;

  if p_decision = 'verified' then
    update public.works
    set status = 'verified', review_note = null, removed_at = null
    where id = v_work.id;
  elsif p_decision = 'rejected' then
    update public.works
    set status = 'rejected',
        review_note = coalesce(nullif(trim(p_reason), ''), 'Strong automated synthetic-content signal.'),
        removed_at = null
    where id = v_work.id;
  else
    update public.works
    set status = 'awaiting',
        review_note = coalesce(nullif(trim(p_reason), ''), 'Automated detectors could not reach a safe agreement. Human escalation is required.')
    where id = v_work.id;
  end if;

  if p_decision in ('verified', 'rejected') then
    update public.review_requests
    set state = 'resolved', resolved_at = now()
    where work_id = v_work.id and state = 'open';
  end if;

  insert into public.verification_audit_events (
    run_id, work_id, creator_id, actor_type, event_type, metadata
  ) values (
    p_run_id,
    v_work.id,
    v_run.creator_id,
    'pipeline',
    'verification_completed',
    jsonb_build_object(
      'decision', p_decision,
      'reason_code', p_reason_code,
      'pipeline_version', p_pipeline_version,
      'evidence_digest', v_digest,
      'required_clear_count', v_required_clear,
      'required_error_count', v_required_errors,
      'strong_ai_count', v_strong_ai,
      'recapture_count', v_recapture,
      'partial_ai_count', v_partial,
      'duplicate_hash', v_duplicate,
      'local_screen_score', v_screen_score
    )
  );

  return v_next;
end;
$$;

revoke all on function public.complete_verification_run(uuid,text,text,text,text,jsonb,jsonb,jsonb)
from public, anon, authenticated;
grant execute on function public.complete_verification_run(uuid,text,text,text,text,jsonb,jsonb,jsonb)
to service_role;

create or replace function public.resolve_escalated_verification(
  p_work_id uuid,
  p_action text,
  p_reason text
)
returns public.humn_work_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reviewer uuid := auth.uid();
  v_work public.works%rowtype;
  v_latest public.verification_pipeline_runs%rowtype;
  v_new_run uuid;
begin
  if v_reviewer is null or not public.is_humn_reviewer(v_reviewer) then
    raise exception 'Reviewer access required' using errcode = '42501';
  end if;
  if p_action not in ('resubmit', 'retry') then
    raise exception 'Escalated review may only request resubmission or retry';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'A review reason is required';
  end if;

  select * into v_work from public.works where id = p_work_id for update;
  if not found then raise exception 'Work not found' using errcode = 'P0002'; end if;

  select * into v_latest
  from public.verification_pipeline_runs
  where work_id = p_work_id and state = 'completed'
  order by completed_at desc nulls last, id desc
  limit 1;

  if not found or v_latest.decision <> 'escalate' or v_work.status <> 'awaiting' then
    raise exception 'Only an escalated automated review can be resolved here';
  end if;

  if p_action = 'resubmit' then
    update public.works
    set status = 'declared', review_note = trim(p_reason)
    where id = p_work_id;

    update public.review_requests
    set state = 'resolved', resolved_at = now()
    where work_id = p_work_id and state = 'open';

    insert into public.verification_audit_events (
      run_id, work_id, creator_id, actor_type, actor_id, event_type, metadata
    ) values (
      v_latest.id, p_work_id, v_work.creator_id, 'reviewer', v_reviewer,
      'escalation_resubmission_requested', jsonb_build_object('reason', trim(p_reason))
    );

    return 'declared';
  end if;

  insert into public.verification_pipeline_runs (
    work_id, creator_id, requested_by, state, pipeline_version
  )
  select p_work_id, v_work.creator_id, v_reviewer, 'queued', pipeline_version
  from public.verification_pipeline_config where singleton = true
  returning id into v_new_run;

  update public.works
  set status = 'awaiting', review_note = 'Escalated case queued for a fresh automated pass.'
  where id = p_work_id;

  insert into public.verification_audit_events (
    run_id, work_id, creator_id, actor_type, actor_id, event_type, metadata
  ) values (
    v_new_run, p_work_id, v_work.creator_id, 'reviewer', v_reviewer,
    'escalation_retry_queued', jsonb_build_object('reason', trim(p_reason), 'previous_run_id', v_latest.id)
  );

  return 'awaiting';
end;
$$;

revoke all on function public.resolve_escalated_verification(uuid,text,text) from public, anon;
grant execute on function public.resolve_escalated_verification(uuid,text,text) to authenticated;

-- Human reviewers can no longer award VERIFIED. Existing moderation rejection/removal
-- remains available for ordinary policy moderation, but the automated badge is pipeline-only.
create or replace function public.moderate_work(
  p_work_id uuid,
  p_action public.humn_moderation_action,
  p_reason text
)
returns public.humn_work_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reviewer uuid := auth.uid();
  v_work public.works%rowtype;
  v_next public.humn_work_status;
begin
  if v_reviewer is null or not public.is_humn_reviewer(v_reviewer) then
    raise exception 'Reviewer access required' using errcode = '42501';
  end if;
  if p_action = 'approve' then
    raise exception 'VERIFIED is awarded only by the automated detector pipeline' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'A review reason is required';
  end if;

  select * into v_work from public.works where id = p_work_id for update;
  if not found then raise exception 'Work not found' using errcode = 'P0002'; end if;

  if p_action = 'reject' then
    v_next := 'declared';
    update public.works set status = v_next, review_note = trim(p_reason) where id = p_work_id;
  else
    v_next := 'rejected';
    update public.works set status = v_next, removed_at = now(), review_note = trim(p_reason) where id = p_work_id;
  end if;

  update public.review_requests
  set state = 'resolved', resolved_at = now()
  where work_id = p_work_id and state = 'open';

  insert into public.moderation_actions (
    work_id, reviewer_id, action, reason, previous_status, next_status
  ) values (
    p_work_id, v_reviewer, p_action, trim(p_reason), v_work.status, v_next
  );

  return v_next;
end;
$$;

revoke all on function public.moderate_work(uuid,public.humn_moderation_action,text) from public, anon;
grant execute on function public.moderate_work(uuid,public.humn_moderation_action,text) to authenticated;

create or replace function public.get_work_verification_summary(p_work_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_work public.works%rowtype;
  v_run public.verification_pipeline_runs%rowtype;
begin
  select * into v_work from public.works where id = p_work_id;
  if not found then return null; end if;

  if v_work.removed_at is not null
     or (
       v_work.status = 'rejected'
       and v_work.creator_id <> auth.uid()
       and not public.is_humn_reviewer(auth.uid())
     )
  then
    return null;
  end if;

  select * into v_run
  from public.verification_pipeline_runs
  where work_id = p_work_id
  order by queued_at desc, id desc
  limit 1;

  if not found then return null; end if;

  return jsonb_build_object(
    'run_id', v_run.id,
    'state', v_run.state,
    'decision', v_run.decision,
    'reason_code', v_run.reason_code,
    'reason', case
      when v_work.creator_id = auth.uid() or public.is_humn_reviewer(auth.uid()) then v_run.reason
      else null
    end,
    'pipeline_version', v_run.pipeline_version,
    'queued_at', v_run.queued_at,
    'started_at', v_run.started_at,
    'completed_at', v_run.completed_at,
    'evidence_digest', v_run.evidence_digest,
    'screen_rephotograph', jsonb_build_object(
      'suspected', coalesce((v_run.screen_heuristics->>'suspected')::boolean, false),
      'coverage', 'partial_v1'
    ),
    'detectors', coalesce((
      select jsonb_agg(jsonb_build_object(
        'provider', dr.provider,
        'role', dr.provider_role,
        'status', dr.status,
        'model_version', dr.model_version,
        'ai_score', dr.ai_score,
        'authentic_score', dr.authentic_score,
        'confidence', dr.confidence,
        'recapture_score', dr.recapture_score,
        'deepfake_score', dr.deepfake_score,
        'partial_ai_score', dr.partial_ai_score,
        'latency_ms', dr.latency_ms,
        'error_code', dr.error_code
      ) order by dr.provider_role, dr.provider)
      from public.verification_detector_results dr
      where dr.run_id = v_run.id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_work_verification_summary(uuid) from public;
grant execute on function public.get_work_verification_summary(uuid) to anon, authenticated;

-- The human queue now receives verification requests only after an automated
-- escalation. Report-threshold moderation remains visible independently.
create or replace function public.get_moderation_queue(p_limit integer default 50)
returns table (
  work_id uuid,
  title text,
  creator_handle text,
  image_url text,
  status public.humn_work_status,
  proof_count integer,
  report_count integer,
  ai_declared boolean,
  triggers text[],
  requested_at timestamptz,
  badge_variant text,
  badge_label text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_humn_reviewer(auth.uid()) then
    raise exception 'Reviewer access required' using errcode = '42501';
  end if;

  return query
  select
    w.id,
    w.title,
    u.handle::text,
    w.image_url,
    w.status,
    w.proof_count,
    w.report_count,
    w.ai_declared,
    array_agg(distinct rr.trigger_type::text order by rr.trigger_type::text),
    max(rr.created_at),
    badge.badge_variant,
    badge.badge_label
  from public.review_requests rr
  join public.works w on w.id = rr.work_id
  join public.users u on u.id = w.creator_id
  cross join lateral public.derive_work_badge(w.status, w.proof_count, w.ai_declared) badge
  left join lateral (
    select vr.decision
    from public.verification_pipeline_runs vr
    where vr.work_id = w.id and vr.state = 'completed'
    order by vr.completed_at desc nulls last, vr.id desc
    limit 1
  ) latest on true
  where rr.state = 'open'
    and w.removed_at is null
    and (
      rr.trigger_type = 'reported_threshold'
      or latest.decision = 'escalate'
    )
  group by w.id, u.handle, badge.badge_variant, badge.badge_label
  order by max(rr.created_at) desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
end;
$$;

revoke all on function public.get_moderation_queue(integer) from public, anon;
grant execute on function public.get_moderation_queue(integer) to authenticated;

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
      when p_status = 'verified' then 'verified'
      when p_status = 'awaiting' then 'awaiting'
      else 'unverified'
    end,
    case
      when p_status = 'verified' then 'VERIFIED · AUTOMATED CLEAR'
      when p_status = 'awaiting' then 'AWAITING AUTOMATED REVIEW'
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

grant execute on function public.derive_work_badge(public.humn_work_status,integer,boolean) to anon, authenticated;
grant execute on function public.derive_work_badge(public.humn_work_status,integer) to anon, authenticated;

comment on table public.verification_pipeline_runs is
  'Tamper-resistant automated verification run ledger. Only service_role can claim or complete runs.';
comment on table public.verification_detector_results is
  'Per-provider normalized scores and raw responses. Vendor outputs are signals, never conclusive verdicts.';
comment on column public.verification_pipeline_runs.evidence_digest is
  'SHA-256 digest of pipeline version, decision, threshold snapshot, normalized/raw detector results and local screen heuristics.';
comment on function public.complete_verification_run(uuid,text,text,text,text,jsonb,jsonb,jsonb) is
  'Service-role-only automated decision boundary. VERIFIED requires two independent clear results and clean provenance.';

commit;
