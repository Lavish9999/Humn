begin;

alter table public.verification_pipeline_config
  drop constraint if exists verification_pipeline_config_distinct_required_providers;
alter table public.verification_pipeline_config
  add constraint verification_pipeline_config_distinct_required_providers
  check (lower(primary_provider) <> lower(secondary_provider));

create unique index if not exists verification_detector_one_required_role_idx
  on public.verification_detector_results (run_id, provider_role)
  where provider_role in ('primary', 'secondary');

comment on index public.verification_detector_one_required_role_idx is
  'A run can retain exactly one primary and one secondary result. Duplicate required roles abort completion instead of awarding VERIFIED.';

commit;
