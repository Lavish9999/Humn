begin;

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

  -- A running attempt older than the stale window is no longer requeued across
  -- several recovery days. Its public result becomes SELF-DECLARED immediately
  -- at the next recovery sweep. This is conservative: it never awards VERIFIED
  -- and it preserves the unfinished run plus a terminal audit reason.
  for v_stale in
    select vr.*
    from public.verification_pipeline_runs vr
    where vr.state = 'running'
      and vr.updated_at < now() - interval '3 minutes'
    for update skip locked
  loop
    update public.verification_pipeline_runs
    set state = 'completed',
        decision = 'self_declared',
        reason_code = 'STALE_ATTEMPT_SELF_DECLARED',
        reason = 'Automated review did not complete within the recovery window. The Work remains SELF-DECLARED and was not defaulted to VERIFIED.',
        completed_at = now(),
        updated_at = now()
    where id = v_stale.id;

    update public.works
    set status = 'declared',
        review_note = 'Automated review did not complete safely. The Work remains SELF-DECLARED.',
        verification_requested_at = null
    where id = v_stale.work_id
      and status = 'awaiting';

    update public.review_requests
    set state = 'resolved', resolved_at = now()
    where work_id = v_stale.work_id
      and state = 'open';

    insert into public.verification_audit_events (
      run_id, work_id, creator_id, actor_type, event_type, metadata
    ) values (
      v_stale.id,
      v_stale.work_id,
      v_stale.creator_id,
      'system',
      'stale_attempt_self_declared',
      jsonb_build_object(
        'attempt_count', v_stale.attempt_count,
        'stale_after_seconds', 180,
        'fallback', 'self_declared'
      )
    );
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
  'Service-role-only queue claim. A stale running attempt becomes terminal SELF-DECLARED at the next recovery sweep instead of being requeued or left AWAITING.';

commit;
