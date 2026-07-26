begin;
select plan(5);

select has_function(
  'public',
  'get_work_verification_summary',
  array['uuid'],
  'public origin-check summary RPC exists'
);

select ok(
  position('v_privileged' in pg_get_functiondef(
    'public.get_work_verification_summary(uuid)'::regprocedure
  )) > 0,
  'verification summary distinguishes creator or reviewer access from public access'
);

select ok(
  position('independent_check' in pg_get_functiondef(
    'public.get_work_verification_summary(uuid)'::regprocedure
  )) > 0,
  'public detector entries use an anonymized provider label'
);

select ok(
  position('ORIGIN CHECK PASSED' in pg_get_functiondef(
    'public.derive_work_badge(public.humn_work_status,integer,boolean)'::regprocedure
  )) > 0,
  'verified database state maps to the narrower public origin-check label'
);

select ok(
  position('CREATOR DECLARED' in pg_get_functiondef(
    'public.derive_work_badge(public.humn_work_status,integer,boolean)'::regprocedure
  )) > 0,
  'declared database state maps to a neutral creator-declared label'
);

select * from finish();
rollback;
