begin;
select plan(25);

select is((select string_agg(policyname,',' order by policyname) from pg_policies where schemaname='public' and tablename='users'), 'users_public_read,users_self_update', 'users policies are complete');
select is((select string_agg(policyname,',' order by policyname) from pg_policies where schemaname='public' and tablename='works'), 'works_creator_delete,works_creator_insert,works_creator_update,works_public_read', 'works policies are complete');
select is((select string_agg(policyname,',' order by policyname) from pg_policies where schemaname='public' and tablename='proof_entries'), 'proof_entries_owner_delete,proof_entries_owner_insert,proof_entries_owner_update,proof_entries_parent_read', 'proof-entry policies are complete');
select is((select string_agg(policyname,',' order by policyname) from pg_policies where schemaname='public' and tablename='file_evidence'), 'file_evidence_owner_delete,file_evidence_owner_insert,file_evidence_owner_update,file_evidence_parent_read', 'file-evidence policies are complete');
select is((select string_agg(policyname,',' order by policyname) from pg_policies where schemaname='public' and tablename='technical_signals'), 'technical_signals_owner_delete,technical_signals_owner_insert,technical_signals_owner_update,technical_signals_parent_read', 'technical-signal policies are complete');
select is((select string_agg(policyname,',' order by policyname) from pg_policies where schemaname='public' and tablename='collections'), 'collections_owner_delete,collections_owner_insert,collections_owner_read,collections_owner_update,collections_public_read', 'collection policies are complete');
select is((select string_agg(policyname,',' order by policyname) from pg_policies where schemaname='public' and tablename='collection_items'), 'collection_items_owner_delete,collection_items_owner_insert,collection_items_owner_update,collection_items_parent_read', 'collection-item policies are complete');
select is((select string_agg(policyname,',' order by policyname) from pg_policies where schemaname='public' and tablename='follows'), 'follows_follower_delete,follows_follower_insert,follows_public_read', 'follow policies are complete');
select is((select string_agg(policyname,',' order by policyname) from pg_policies where schemaname='public' and tablename='reports'), 'reports_reporter_insert,reports_reporter_read,reports_reviewer_read', 'report policies are complete');

select ok((select relrowsecurity from pg_class where oid='public.users'::regclass), 'RLS is enabled on users');
select ok((select relrowsecurity from pg_class where oid='public.works'::regclass), 'RLS is enabled on works');
select ok((select relrowsecurity from pg_class where oid='public.proof_entries'::regclass), 'RLS is enabled on proof_entries');
select ok((select relrowsecurity from pg_class where oid='public.file_evidence'::regclass), 'RLS is enabled on file_evidence');
select ok((select relrowsecurity from pg_class where oid='public.technical_signals'::regclass), 'RLS is enabled on technical_signals');
select ok((select relrowsecurity from pg_class where oid='public.collections'::regclass), 'RLS is enabled on collections');
select ok((select relrowsecurity from pg_class where oid='public.collection_items'::regclass), 'RLS is enabled on collection_items');
select ok((select relrowsecurity from pg_class where oid='public.follows'::regclass), 'RLS is enabled on follows');
select ok((select relrowsecurity from pg_class where oid='public.reports'::regclass), 'RLS is enabled on reports');

select is((select count(*)::integer from pg_trigger where tgrelid='public.users'::regclass and tgname='humn_users_protect_fields' and not tgisinternal), 1, 'protected user-field trigger is attached');
select is((select count(*)::integer from pg_constraint where conrelid='public.users'::regclass and contype='u' and pg_get_constraintdef(oid) ilike '%handle%'), 1, 'handle remains unique');

select is((select string_agg(privilege_type,',' order by privilege_type) from information_schema.role_table_grants where grantee='authenticated' and table_schema='public' and table_name='reports'), 'INSERT,SELECT', 'authenticated report privileges exclude update/delete');
select is((select string_agg(privilege_type,',' order by privilege_type) from information_schema.role_table_grants where grantee='authenticated' and table_schema='public' and table_name='follows'), 'DELETE,INSERT,SELECT', 'authenticated follow privileges exclude update');
select is((select count(*)::integer from information_schema.column_privileges where grantee='authenticated' and table_schema='public' and table_name='users' and privilege_type='UPDATE' and column_name='handle'), 0, 'authenticated users cannot directly update handle');
select is((select count(*)::integer from information_schema.column_privileges where grantee='authenticated' and table_schema='public' and table_name='users' and privilege_type='UPDATE' and column_name='reputation'), 0, 'authenticated users cannot directly update reputation');
select is((select count(*)::integer from information_schema.column_privileges where grantee='authenticated' and table_schema='public' and table_name='users' and privilege_type='UPDATE' and column_name in ('display_name','avatar_url')), 2, 'authenticated users may update only editable profile columns');

select * from finish();
rollback;
