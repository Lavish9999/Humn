begin;

-- Sightengine Recapture is not provisioned and is no longer a required input.
-- Remove the historical trigger that required a primary recapture score before
-- a completed run could receive VERIFIED. The recapture columns/config remain
-- dormant so the optional signal can be re-enabled later behind the existing
-- server-only environment flag without becoming a required clearance input.
drop trigger if exists humn_verified_requires_recapture_signal
on public.verification_pipeline_runs;
drop function if exists public.enforce_verified_recapture_signal();

alter table public.verification_pipeline_runs
  drop constraint if exists verification_pipeline_runs_decision_check;
alter table public.verification_pipeline_runs
  add constraint verification_pipeline_runs_decision_check
  check (decision is null or decision in ('verified', 'rejected', 'self_declared', 'escalate'));

update public.verification_pipeline_config
set pipeline_version = '2026-07-26.1',
    updated_at = now()
where singleton = true;

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
  v_optional_recapture integer;
  v_partial integer;
  v_duplicate boolean;
  v_c2pa_ai boolean;
  v_screen_score numeric;
  v_digest text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Trusted server access required' using errcode = '42501';
  end if;
  if p_decision not in ('verified', 'rejected', 'self_declared') then
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

  -- VERIFIED requires exactly two complete, high-confidence required-provider
  -- results. A missing AI, deepfake or confidence score cannot count as clear.
  select count(*)::integer into v_required_clear
  from jsonb_array_elements(p_results) r
  where r->>'role' in ('primary', 'secondary')
    and r->>'status' = 'ok'
    and nullif(r->>'aiScore', '') is not null
    and nullif(r->>'aiScore', '')::numeric <= v_config.ai_clear_threshold
    and nullif(r->>'confidence', '') is not null
    and nullif(r->>'confidence', '')::numeric >= v_config.min_confidence
    and nullif(r->>'deepfakeScore', '') is not null
    and nullif(r->>'deepfakeScore', '')::numeric < v_config.deepfake_reject_threshold;

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

  -- Dormant optional signal only. No score is required. When the existing env
  -- flag is disabled this count is zero; if provisioned later, a high score can
  -- conservatively block VERIFIED without making absence a failure.
  select count(*)::integer into v_optional_recapture
  from jsonb_array_elements(p_results) r
  where r->>'status' = 'ok'
    and nullif(r->>'recaptureScore', '') is not null
    and nullif(r->>'recaptureScore', '')::numeric >= v_config.recapture_escalate_threshold;

  select count(*)::integer into v_partial
  from jsonb_array_elements(p_results) r
  where r->>'role' = 'optional'
    and r->>'status' = 'ok'
    and coalesce(nullif(r->>'partialAiScore', '')::numeric, 0) >= v_config.optional_region_escalate_threshold;

  select coalesce((ps.value->>'duplicate')::boolean, false) into v_duplicate
  from public.provenance_signals ps
  where ps.work_id = v_work.id and ps.signal_name = 'duplicate_hash';
  v_duplicate := coalesce(v_duplicate, false);

  select coalesce((ps.value->>'ai_generation_asserted')::boolean, false) into v_c2pa_ai
  from public.provenance_signals ps
  where ps.work_id = v_work.id and ps.signal_name = 'c2pa';
  v_c2pa_ai := coalesce(v_c2pa_ai, false);

  v_screen_score := coalesce(nullif(p_screen_heuristics->>'score', '')::numeric, 0);

  -- Postgres independently enforces the conservative agreement rule. Removing
  -- the Recapture requirement does not permit detector-only auto-passing unless
  -- both required providers positively clear and every other guard is clean.
  if p_decision = 'verified' then
    if v_work.ai_declared
       or v_c2pa_ai
       or v_duplicate
       or v_required_clear <> 2
       or v_required_errors <> 0
       or v_strong_ai <> 0
       or v_optional_recapture <> 0
       or v_partial <> 0
       or v_screen_score >= v_config.local_screen_escalate_threshold
    then
      raise exception 'Automated VERIFIED requirements were not satisfied' using errcode = '42501';
    end if;
    v_next := 'verified';
  elsif p_decision = 'rejected' then
    if not v_work.ai_declared and not v_c2pa_ai and v_strong_ai = 0 then
      raise exception 'Automated REJECTED requires an explicit strong synthetic signal' using errcode = '42501';
    end if;
    v_next := 'rejected';
  else
    v_next := 'declared';
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
    set status = 'verified',
        review_note = null,
        verification_requested_at = null,
        removed_at = null
    where id = v_work.id;
  elsif p_decision = 'rejected' then
    update public.works
    set status = 'rejected',
        review_note = coalesce(nullif(trim(p_reason), ''), 'Strong automated synthetic-content signal.'),
        verification_requested_at = null,
        removed_at = null
    where id = v_work.id;
  else
    update public.works
    set status = 'declared',
        review_note = coalesce(
          nullif(trim(p_reason), ''),
          'Automated detectors could not confidently clear this Work. It remains SELF-DECLARED.'
        ),
        verification_requested_at = null,
        removed_at = null
    where id = v_work.id;
  end if;

  -- Every completed automated run is terminal. No completed uncertainty result
  -- leaves an open reviewer queue with nobody assigned to resolve it.
  update public.review_requests
  set state = 'resolved', resolved_at = now()
  where work_id = v_work.id and state = 'open';

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
      'optional_recapture_count', v_optional_recapture,
      'partial_ai_count', v_partial,
      'duplicate_hash', v_duplicate,
      'c2pa_explicit_ai', v_c2pa_ai,
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

create or replace function public.claim_verification_run(p_work_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.verification_pipeline_runs%rowtype;
  v_config public.verification_pipeline_config%rowtype;
  v_stale public.verification_pipeline_runs%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Trusted server access required' using errcode = '42501';
  end if;

  select * into v_config
  from public.verification_pipeline_config
  where singleton = true;

  if not found then
    raise exception 'Verification pipeline configuration is unavailable';
  end if;

  for v_stale in
    select vr.*
    from public.verification_pipeline_runs vr
    where vr.state = 'running'
      and vr.updated_at < now() - interval '3 minutes'
    for update skip locked
  loop
    if v_stale.attempt_count < v_config.max_attempts then
      update public.verification_pipeline_runs
      set state = 'queued',
          started_at = null,
          updated_at = now(),
          reason_code = 'STALE_ATTEMPT_REQUEUED',
          reason = 'A stale automated attempt was safely requeued.'
      where id = v_stale.id;

      insert into public.verification_audit_events (
        run_id, work_id, creator_id, actor_type, event_type, metadata
      ) values (
        v_stale.id,
        v_stale.work_id,
        v_stale.creator_id,
        'system',
        'stale_attempt_requeued',
        jsonb_build_object(
          'attempt_count', v_stale.attempt_count,
          'max_attempts', v_config.max_attempts
        )
      );
    else
      update public.verification_pipeline_runs
      set state = 'completed',
          decision = 'self_declared',
          reason_code = 'MAX_ATTEMPTS_EXHAUSTED',
          reason = 'Automated review could not complete after the configured retry limit. The Work remains SELF-DECLARED and was not defaulted to VERIFIED.',
          completed_at = now(),
          updated_at = now()
      where id = v_stale.id;

      update public.works
      set status = 'declared',
          review_note = 'Automated review could not complete after repeated attempts. The Work remains SELF-DECLARED.',
          verification_requested_at = null
      where id = v_stale.work_id;

      update public.review_requests
      set state = 'resolved', resolved_at = now()
      where work_id = v_stale.work_id and state = 'open';

      insert into public.verification_audit_events (
        run_id, work_id, creator_id, actor_type, event_type, metadata
      ) values (
        v_stale.id,
        v_stale.work_id,
        v_stale.creator_id,
        'system',
        'max_attempts_self_declared',
        jsonb_build_object(
          'attempt_count', v_stale.attempt_count,
          'max_attempts', v_config.max_attempts
        )
      );
    end if;
  end loop;

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
      pipeline_version = v_config.pipeline_version,
      reason_code = null,
      reason = null
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
    jsonb_build_object(
      'attempt', v_run.attempt_count,
      'pipeline_version', v_config.pipeline_version
    )
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

comment on function public.claim_verification_run(uuid) is
  'Service-role-only queue claim with stale-attempt recovery. Retry exhaustion returns the Work to SELF-DECLARED, never VERIFIED or indefinite AWAITING.';
comment on function public.complete_verification_run(uuid,text,text,text,text,jsonb,jsonb,jsonb) is
  'Service-role-only terminal completion: VERIFIED, REJECTED or SELF-DECLARED. Recapture is optional and never required for clearance.';

-- Release legacy completed escalations that were previously stranded in
-- AWAITING with no assigned human reviewer. Completed run evidence stays
-- immutable; only the public Work state and open request are normalized.
with stranded as (
  select distinct on (vr.work_id)
    vr.id as run_id,
    vr.work_id,
    vr.creator_id,
    vr.reason
  from public.verification_pipeline_runs vr
  where vr.state = 'completed'
    and vr.decision = 'escalate'
    and not exists (
      select 1
      from public.verification_pipeline_runs active
      where active.work_id = vr.work_id
        and active.state in ('queued', 'running')
    )
  order by vr.work_id, vr.completed_at desc nulls last, vr.id desc
), released as (
  update public.works w
  set status = 'declared',
      review_note = coalesce(
        nullif(trim(stranded.reason), ''),
        'Automated detectors could not confidently clear this Work. It remains SELF-DECLARED.'
      ),
      verification_requested_at = null
  from stranded
  where w.id = stranded.work_id
    and w.status = 'awaiting'
  returning stranded.run_id, w.id as work_id, w.creator_id
)
insert into public.verification_audit_events (
  run_id, work_id, creator_id, actor_type, event_type, metadata
)
select
  released.run_id,
  released.work_id,
  released.creator_id,
  'system',
  'legacy_escalation_released_to_self_declared',
  jsonb_build_object('migration', '202607250026')
from released;

update public.review_requests rr
set state = 'resolved', resolved_at = now()
where rr.state = 'open'
  and exists (
    select 1
    from public.works w
    where w.id = rr.work_id
      and w.status = 'declared'
      and exists (
        select 1
        from public.verification_pipeline_runs vr
        where vr.work_id = w.id
          and vr.state = 'completed'
          and vr.decision = 'escalate'
      )
  );

commit;
