begin;
select plan(43);

select has_table('public', 'verification_pipeline_config', 'tunable verification config exists');
select has_table('public', 'verification_pipeline_runs', 'verification run ledger exists');
select has_table('public', 'verification_detector_results', 'per-provider detector evidence exists');
select has_table('public', 'verification_audit_events', 'verification audit event ledger exists');

select ok((select relrowsecurity from pg_class where oid='public.verification_pipeline_runs'::regclass), 'RLS enabled on verification runs');
select ok((select relrowsecurity from pg_class where oid='public.verification_detector_results'::regclass), 'RLS enabled on detector results');
select ok((select relrowsecurity from pg_class where oid='public.verification_audit_events'::regclass), 'RLS enabled on verification audit');

select is((select count(*)::integer from public.verification_pipeline_config), 1, 'exactly one active threshold configuration exists');
select is((select ai_reject_threshold from public.verification_pipeline_config where singleton), 0.9000::numeric, 'initial strong-AI threshold is explicit');
select is((select ai_clear_threshold from public.verification_pipeline_config where singleton), 0.1000::numeric, 'initial clear threshold is explicit');
select is((select min_confidence from public.verification_pipeline_config where singleton), 0.8000::numeric, 'initial confidence threshold is explicit');
select is((select recapture_escalate_threshold from public.verification_pipeline_config where singleton), 0.5000::numeric, 'optional future recapture threshold remains explicit');
select is((select local_screen_escalate_threshold from public.verification_pipeline_config where singleton), 0.6000::numeric, 'local screen heuristic threshold is explicit');
select ok(
  (select lower(primary_provider) <> lower(secondary_provider) from public.verification_pipeline_config where singleton),
  'primary and secondary providers are independently configured'
);
select has_index(
  'public', 'verification_detector_results', 'verification_detector_one_required_role_idx',
  'a run can retain only one primary and one secondary result'
);

select has_function('public', 'claim_verification_run', array['uuid'], 'service worker claim RPC exists');
select has_function('public', 'complete_verification_run', array['uuid','text','text','text','text','jsonb','jsonb','jsonb'], 'automated completion RPC exists');
select has_function('public', 'resolve_escalated_verification', array['uuid','text','text'], 'legacy human escalation resolution RPC remains available');
select has_function('public', 'get_work_verification_summary', array['uuid'], 'sanitized public verification summary RPC exists');

select ok(has_function_privilege('service_role', 'public.claim_verification_run(uuid)', 'EXECUTE'), 'service role may claim queued detector work');
select ok(not has_function_privilege('authenticated', 'public.claim_verification_run(uuid)', 'EXECUTE'), 'normal authenticated users cannot claim detector work');
select ok(has_function_privilege('service_role', 'public.complete_verification_run(uuid,text,text,text,text,jsonb,jsonb,jsonb)', 'EXECUTE'), 'service role may complete automated decisions');
select ok(not has_function_privilege('authenticated', 'public.complete_verification_run(uuid,text,text,text,text,jsonb,jsonb,jsonb)', 'EXECUTE'), 'normal authenticated users are denied the verification decision RPC');
select ok(not has_function_privilege('anon', 'public.complete_verification_run(uuid,text,text,text,text,jsonb,jsonb,jsonb)', 'EXECUTE'), 'anonymous users are denied the verification decision RPC');

select ok(not has_table_privilege('authenticated', 'public.verification_pipeline_runs', 'INSERT'), 'clients cannot fabricate pipeline runs');
select ok(not has_table_privilege('authenticated', 'public.verification_pipeline_runs', 'UPDATE'), 'clients cannot rewrite run decisions');
select ok(not has_table_privilege('authenticated', 'public.verification_detector_results', 'INSERT'), 'clients cannot fabricate detector scores');
select ok(not has_table_privilege('authenticated', 'public.verification_detector_results', 'UPDATE'), 'clients cannot alter detector raw responses');
select ok(not has_table_privilege('authenticated', 'public.verification_audit_events', 'INSERT'), 'clients cannot fabricate audit events');
select ok(not has_column_privilege('authenticated', 'public.works', 'status', 'UPDATE'), 'normal users cannot self-assign VERIFIED through table updates');

select ok(
  position('coalesce(auth.role(), '''') <> ''service_role''' in pg_get_functiondef(
    'public.complete_verification_run(uuid,text,text,text,text,jsonb,jsonb,jsonb)'::regprocedure
  )) > 0,
  'completion RPC independently checks service_role at runtime'
);
select ok(
  position('v_required_clear <> 2' in pg_get_functiondef(
    'public.complete_verification_run(uuid,text,text,text,text,jsonb,jsonb,jsonb)'::regprocedure
  )) > 0,
  'database requires two clear required detector results for VERIFIED'
);
select ok(
  position('v_required_errors <> 0' in pg_get_functiondef(
    'public.complete_verification_run(uuid,text,text,text,text,jsonb,jsonb,jsonb)'::regprocedure
  )) > 0,
  'database refuses VERIFIED when a required provider errors'
);
select ok(
  position('nullif(r ->> ''deepfakeScore''::text, ''''::text) IS NOT NULL' in pg_get_functiondef(
    'public.complete_verification_run(uuid,text,text,text,text,jsonb,jsonb,jsonb)'::regprocedure
  )) > 0,
  'database requires a present deepfake score from each clear provider'
);
select ok(
  position('v_next := ''declared''' in pg_get_functiondef(
    'public.complete_verification_run(uuid,text,text,text,text,jsonb,jsonb,jsonb)'::regprocedure
  )) > 0,
  'uncertain terminal completion returns the Work to declared SELF-DECLARED status'
);
select ok(
  position('primary recapture score' in lower(pg_get_functiondef(
    'public.complete_verification_run(uuid,text,text,text,text,jsonb,jsonb,jsonb)'::regprocedure
  ))) = 0,
  'completion RPC does not require a primary recapture score'
);
select ok(
  position('VERIFIED is awarded only by the automated detector pipeline' in pg_get_functiondef(
    'public.moderate_work(uuid,public.humn_moderation_action,text)'::regprocedure
  )) > 0,
  'human moderation cannot award the automated VERIFIED badge'
);
select ok(
  not exists (
    select 1
    from information_schema.role_table_grants
    where grantee = 'authenticated'
      and table_schema = 'public'
      and table_name in ('verification_pipeline_config','verification_pipeline_runs','verification_detector_results','verification_audit_events')
      and privilege_type in ('INSERT','UPDATE','DELETE')
  ),
  'authenticated role has no write grant anywhere inside the automated trust boundary'
);

select has_trigger(
  'public', 'verification_pipeline_runs', 'humn_completed_verification_run_immutable',
  'completed run immutability trigger exists'
);
select has_trigger(
  'public', 'verification_detector_results', 'humn_completed_detector_result_immutable',
  'completed detector evidence immutability trigger exists'
);
select has_trigger(
  'public', 'verification_audit_events', 'humn_verification_audit_append_only',
  'verification audit append-only trigger exists'
);
select hasnt_trigger(
  'public', 'verification_pipeline_runs', 'humn_verified_requires_recapture_signal',
  'database no longer requires Recapture for VERIFIED'
);

set local role authenticated;
select throws_ok(
  $$
    select public.complete_verification_run(
      '00000000-0000-0000-0000-000000000000'::uuid,
      'verified',
      'CLIENT_ATTEMPT',
      'client attempted to self verify',
      'client',
      '{}'::jsonb,
      '[]'::jsonb,
      '{}'::jsonb
    )
  $$,
  '42501',
  null,
  'a normal authenticated account is denied when it attempts to self-verify'
);
reset role;

select * from finish();
rollback;
