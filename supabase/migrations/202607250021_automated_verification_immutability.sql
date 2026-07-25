begin;

create or replace function public.protect_completed_verification_run()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.state = 'completed' then
    raise exception 'Completed verification runs are immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.protect_completed_detector_result()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state text;
begin
  select state into v_state
  from public.verification_pipeline_runs
  where id = old.run_id;

  if v_state = 'completed' then
    raise exception 'Detector evidence for a completed run is immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.protect_verification_audit_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Verification audit events are append-only and cannot be removed' using errcode = '42501';
end;
$$;

drop trigger if exists humn_completed_verification_run_immutable
  on public.verification_pipeline_runs;
create trigger humn_completed_verification_run_immutable
before update or delete on public.verification_pipeline_runs
for each row execute function public.protect_completed_verification_run();

drop trigger if exists humn_completed_detector_result_immutable
  on public.verification_detector_results;
create trigger humn_completed_detector_result_immutable
before update or delete on public.verification_detector_results
for each row execute function public.protect_completed_detector_result();

drop trigger if exists humn_verification_audit_append_only
  on public.verification_audit_events;
create trigger humn_verification_audit_append_only
before update or delete on public.verification_audit_events
for each row execute function public.protect_verification_audit_event();

revoke all on function public.protect_completed_verification_run() from public, anon, authenticated;
revoke all on function public.protect_completed_detector_result() from public, anon, authenticated;
revoke all on function public.protect_verification_audit_event() from public, anon, authenticated;

comment on function public.protect_completed_verification_run() is
  'Prevents later application code from rewriting or deleting a completed automated decision. New evidence requires a new run.';
comment on function public.protect_completed_detector_result() is
  'Prevents normalized scores or raw provider evidence from being rewritten or deleted after run completion.';
comment on function public.protect_verification_audit_event() is
  'Makes verification audit records append-only and non-deletable.';

commit;
