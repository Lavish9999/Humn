begin;

-- Existing projects may have pgcrypto installed in public while newer Supabase
-- projects expose it in extensions. The pipeline uses one stable qualified name.
create schema if not exists extensions;

do $$
begin
  if to_regprocedure('extensions.digest(bytea,text)') is null
     and to_regprocedure('public.digest(bytea,text)') is not null
  then
    execute $create$
      create function extensions.digest(bytea, text)
      returns bytea
      language sql
      immutable
      strict
      parallel safe
      as 'select public.digest($1, $2)'
    $create$;
  end if;
end;
$$;

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

  -- Requeue a stale invocation only while attempts remain. This covers function
  -- termination, platform timeout and transient process loss without trusting a
  -- client retry or creating duplicate active runs.
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
          decision = 'escalate',
          reason_code = 'MAX_ATTEMPTS_EXHAUSTED',
          reason = 'Automated review could not complete after the configured retry limit. The Work was escalated and was not defaulted to VERIFIED.',
          completed_at = now(),
          updated_at = now()
      where id = v_stale.id;

      update public.works
      set status = 'awaiting',
          review_note = 'Automated review could not complete after repeated attempts. Human escalation is required.'
      where id = v_stale.work_id;

      insert into public.verification_audit_events (
        run_id, work_id, creator_id, actor_type, event_type, metadata
      ) values (
        v_stale.id,
        v_stale.work_id,
        v_stale.creator_id,
        'system',
        'max_attempts_escalated',
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
  'Service-role-only queue claim with stale-attempt recovery. Retry exhaustion ends in ESCALATE, never VERIFIED.';

commit;
