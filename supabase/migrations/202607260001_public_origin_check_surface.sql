begin;

-- Public Work pages should communicate the result and limitations of an origin
-- check without publishing vendor identities, model versions, numeric scores,
-- confidence values, latency or internal error codes. The Work creator and
-- authorized Humn reviewers retain the complete audit-facing summary.
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
  v_privileged boolean := false;
begin
  select * into v_work
  from public.works
  where id = p_work_id;

  if not found then return null; end if;

  v_privileged := coalesce(v_work.creator_id = auth.uid(), false)
    or coalesce(public.is_humn_reviewer(auth.uid()), false);

  if v_work.removed_at is not null
     or (
       v_work.status = 'rejected'
       and not v_privileged
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
    'reason_code', case when v_privileged then v_run.reason_code else null end,
    'reason', case when v_privileged then v_run.reason else null end,
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
      select jsonb_agg(
        case
          when v_privileged then jsonb_build_object(
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
          )
          else jsonb_build_object(
            'provider', 'independent_check',
            'role', dr.provider_role,
            'status', dr.status,
            'model_version', null,
            'ai_score', null,
            'authentic_score', null,
            'confidence', null,
            'recapture_score', null,
            'deepfake_score', null,
            'partial_ai_score', null,
            'latency_ms', null,
            'error_code', null
          )
        end
        order by dr.provider_role, dr.provider
      )
      from public.verification_detector_results dr
      where dr.run_id = v_run.id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_work_verification_summary(uuid) from public;
grant execute on function public.get_work_verification_summary(uuid) to anon, authenticated;

-- These are public trust-state labels, not database-state names. Keep the
-- internal statuses unchanged while presenting narrower, literal claims.
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
      when p_status = 'verified' then 'ORIGIN CHECK PASSED'
      when p_status = 'awaiting' then 'ORIGIN CHECK IN PROGRESS'
      else 'CREATOR DECLARED'
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

commit;
