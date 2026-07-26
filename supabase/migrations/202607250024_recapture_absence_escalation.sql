begin;

-- Recapture is escalation-only, but its absence must never be interpreted as a
-- clean signal. The application decision engine escalates when the primary
-- provider returns no recapture score. This trigger independently prevents a
-- future application bug from awarding VERIFIED without that score.
create or replace function public.enforce_verified_recapture_signal()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_primary_recapture integer;
begin
  if new.state = 'completed' and new.decision = 'verified' then
    select count(*)::integer into v_primary_recapture
    from public.verification_detector_results vdr
    where vdr.run_id = new.id
      and vdr.provider_role = 'primary'
      and vdr.status = 'ok'
      and vdr.recapture_score is not null;

    if v_primary_recapture <> 1 then
      raise exception 'Automated VERIFIED requires a primary recapture score; missing recapture must escalate'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_verified_recapture_signal() from public, anon, authenticated;

drop trigger if exists humn_verified_requires_recapture_signal
on public.verification_pipeline_runs;
create trigger humn_verified_requires_recapture_signal
before update of state, decision on public.verification_pipeline_runs
for each row
execute function public.enforce_verified_recapture_signal();

commit;
