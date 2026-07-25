begin;
select plan(28);

select has_table('public', 'strikes', 'strikes table exists');
select has_column('public', 'strikes', 'user_id', 'strike owns a user');
select has_column('public', 'strikes', 'source', 'strike stores confident source');
select has_column('public', 'strikes', 'expires_at', 'strike has six-month expiry');
select has_column('public', 'strikes', 'appeal_status', 'strike stores appeal status');
select has_column('public', 'users', 'posting_cooldown_until', 'users stores posting cooldown');
select has_column('public', 'users', 'suspended_at', 'users stores posting suspension');
select ok((select relrowsecurity from pg_class where oid='public.strikes'::regclass), 'RLS enabled on strikes');
select ok(exists(select 1 from pg_policies where schemaname='public' and tablename='strikes' and policyname='strikes_owner_or_reviewer_read'), 'owner/reviewer strike read policy exists');

select is((select count(*)::integer from pg_proc where oid='public.record_ai_upload_strike(uuid,text,text,jsonb)'::regprocedure), 1, 'trusted AI strike RPC exists');
select ok(has_function_privilege('service_role', 'public.record_ai_upload_strike(uuid,text,text,jsonb)', 'EXECUTE'), 'service role may record explicit C2PA AI strikes');
select ok(not has_function_privilege('authenticated', 'public.record_ai_upload_strike(uuid,text,text,jsonb)', 'EXECUTE'), 'clients cannot self-issue AI strikes');
select is((select count(*)::integer from pg_proc where oid='public.issue_review_strike(uuid,text)'::regprocedure), 1, 'human review strike RPC exists');
select is((select count(*)::integer from pg_proc where oid='public.submit_strike_appeal(uuid,text)'::regprocedure), 1, 'appeal submit RPC exists');
select is((select count(*)::integer from pg_proc where oid='public.resolve_strike_appeal(uuid,text,text)'::regprocedure), 1, 'appeal resolution RPC exists');
select is((select count(*)::integer from pg_proc where oid='public.get_user_strike_state(uuid)'::regprocedure), 1, 'strike state RPC exists');
select is((select count(*)::integer from pg_proc where oid='public.get_pending_strike_appeals(integer)'::regprocedure), 1, 'appeal queue RPC exists');

select has_column('public', 'moderation_actions', 'strike_id', 'moderation audit links strikes');
select has_column('public', 'moderation_actions', 'strike_action', 'moderation audit stores strike action');
select has_column('public', 'moderation_actions', 'target_user_id', 'moderation audit stores affected user');
select ok(exists(select 1 from pg_indexes where schemaname='public' and tablename='strikes' and indexname='strikes_ai_attempt_collapse_idx'), 'rapid identical attempt lookup index exists');

select ok(
  position('strikes' in pg_get_functiondef('public.sync_work_report_count()'::regprocedure)) = 0,
  'report threshold never auto-issues a strike'
);
select ok(
  position('assert_user_can_post' in pg_get_functiondef(
    'public.create_origin_work_with_provenance(uuid,uuid,text,text,text,text,text,text,public.humn_origin_input,text,text,integer,text,text,text,text,timestamp with time zone,timestamp with time zone,jsonb,boolean)'::regprocedure
  )) > 0,
  'database creation path enforces strike restrictions'
);
select ok(
  position('cannot be published as a Humn Work' in pg_get_functiondef(
    'public.create_origin_work_with_provenance(uuid,uuid,text,text,text,text,text,text,public.humn_origin_input,text,text,integer,text,text,text,text,timestamp with time zone,timestamp with time zone,jsonb,boolean)'::regprocedure
  )) > 0,
  'database creation path rejects C2PA AI-declared assets'
);
select ok(
  position('15 minutes' in pg_get_functiondef('public.record_ai_upload_strike(uuid,text,text,jsonb)'::regprocedure)) > 0,
  'identical C2PA AI attempts collapse in a short window'
);
select ok(
  position('6 months' in pg_get_functiondef('public.record_ai_upload_strike(uuid,text,text,jsonb)'::regprocedure)) > 0,
  'new strikes reset the clean-behavior decay window'
);
select is((select count(*)::integer from public.strikes where source='c2pa_ai' and evidence_hash is null), 0, 'automatic AI strikes always retain the evidence hash');
select is((select count(*)::integer from public.strikes where appeal_status='upheld' and expires_at > now()), 0, 'overturned strikes are no longer active by expiry');

select * from finish();
rollback;
