begin;
select plan(37);

select has_table('public', 'provenance_signals', 'provenance signals table exists');
select has_table('public', 'review_requests', 'review requests table exists');
select has_table('public', 'moderation_actions', 'moderation action audit table exists');

select has_column('public', 'users', 'is_admin', 'users has admin override');
select has_column('public', 'users', 'reviewer_level', 'users has derived reviewer level');
select has_column('public', 'works', 'ai_declared', 'works records explicit C2PA AI declaration');
select has_column('public', 'works', 'report_count', 'works stores report count');
select has_column('public', 'works', 'verification_requested_at', 'works stores verification request time');
select has_column('public', 'works', 'removed_at', 'works supports soft removal');

select ok((select relrowsecurity from pg_class where oid='public.provenance_signals'::regclass), 'RLS enabled on provenance signals');
select ok((select relrowsecurity from pg_class where oid='public.review_requests'::regclass), 'RLS enabled on review requests');
select ok((select relrowsecurity from pg_class where oid='public.moderation_actions'::regclass), 'RLS enabled on moderation actions');

select is((select count(*)::integer from pg_proc where oid='public.create_origin_work_with_provenance(uuid,uuid,text,text,text,text,text,text,public.humn_origin_input,text,text,integer,text,text,text,text,timestamp with time zone,timestamp with time zone,jsonb,boolean)'::regprocedure), 1, 'provenance-aware creation RPC exists');
select ok(has_function_privilege('service_role', 'public.create_origin_work_with_provenance(uuid,uuid,text,text,text,text,text,text,public.humn_origin_input,text,text,integer,text,text,text,text,timestamp with time zone,timestamp with time zone,jsonb,boolean)', 'EXECUTE'), 'service role may create a provenance-aware Work');
select ok(not has_function_privilege('authenticated', 'public.create_origin_work_with_provenance(uuid,uuid,text,text,text,text,text,text,public.humn_origin_input,text,text,integer,text,text,text,text,timestamp with time zone,timestamp with time zone,jsonb,boolean)', 'EXECUTE'), 'browser clients cannot execute trusted creation RPC');
select ok(not has_function_privilege('authenticated', 'public.create_origin_work(uuid,text,text,text,text,text,text,public.humn_origin_input,text,text,integer,text,text,text,text,timestamp with time zone,timestamp with time zone)', 'EXECUTE'), 'legacy creation RPC is retired');

select ok(not has_table_privilege('authenticated', 'public.works', 'INSERT'), 'browser clients cannot bypass provenance by inserting Works directly');
select ok(not has_table_privilege('authenticated', 'public.file_evidence', 'INSERT'), 'browser clients cannot bypass provenance by inserting file evidence directly');
select ok(has_table_privilege('authenticated', 'public.proof_entries', 'INSERT'), 'creators may still author proof entries');
select ok(has_table_privilege('authenticated', 'public.reports', 'INSERT'), 'authenticated users may still report Works');

select ok(has_column_privilege('authenticated', 'public.works', 'title', 'UPDATE'), 'creator copy remains editable');
select ok(not has_column_privilege('authenticated', 'public.works', 'status', 'UPDATE'), 'creators cannot self-assign a Work status');
select ok(not has_table_privilege('authenticated', 'public.file_evidence', 'UPDATE'), 'recorded file evidence cannot be rewritten by clients');
select ok(not has_table_privilege('authenticated', 'public.technical_signals', 'INSERT'), 'clients cannot fabricate technical signals');

select is((select count(*)::integer from pg_trigger where tgrelid='public.reports'::regclass and tgname='humn_report_count_sync' and not tgisinternal), 1, 'report threshold trigger exists');
select is((select count(*)::integer from pg_trigger where tgrelid='public.users'::regclass and tgname='humn_users_reviewer_level' and not tgisinternal), 1, 'reviewer-level derivation trigger exists');
select is((select count(*)::integer from pg_proc where oid='public.request_work_verification(uuid)'::regprocedure), 1, 'verification-request RPC exists');
select is((select count(*)::integer from pg_proc where oid='public.moderate_work(uuid,public.humn_moderation_action,text)'::regprocedure), 1, 'moderation RPC exists');
select is((select count(*)::integer from pg_proc where oid='public.get_moderation_queue(integer)'::regprocedure), 1, 'moderation queue RPC exists');
select is((select count(*)::integer from pg_proc where oid='public.work_feed_rank(uuid,public.humn_work_status,public.humn_origin_input,boolean,integer)'::regprocedure), 1, 'mechanical ranking function exists');

select ok(exists(select 1 from storage.buckets where id='proof-display' and public=true), 'proof-stage derivative bucket exists');
select ok(exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='proof_display_owner_insert'), 'proof-stage owner insert policy exists');
select is((select count(*)::integer from public.works where status='verified' and proof_count=0), 0, 'verified with zero proofs remains impossible');
select is((select count(*)::integer from public.works where ai_declared and status='verified'), 0, 'C2PA AI-declared Works never occupy the verified tier');
select is((select count(*)::integer from public.works w where (select count(*) from public.provenance_signals ps where ps.work_id=w.id) <> 4), 0, 'every existing Work has four provenance signal rows after backfill');
select is((select count(*)::integer from public.provenance_signals where signal_name='c2pa' and value->>'state' in ('none','legacy_not_evaluated','unavailable','parse_error') and weight <> 0), 0, 'missing or unavailable C2PA is always neutral');
select ok(
  position('Missing C2PA or EXIF is neutral' in obj_description('public.provenance_signals'::regclass)) > 0,
  'neutral-evidence invariant is documented in the schema'
);

select * from finish();
rollback;
