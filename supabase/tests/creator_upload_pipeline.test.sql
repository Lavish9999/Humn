begin;
select plan(14);

select has_table('public', 'works', 'works exists');
select has_table('public', 'file_evidence', 'file_evidence exists');
select has_function('public', 'create_origin_work', array[
  'uuid','text','text','text','text','text','text','public.humn_origin_input',
  'text','text','integer','text','text','text','text','timestamp with time zone','timestamp with time zone'
], 'atomic upload RPC exists');
select function_privs_are(
  'public', 'create_origin_work', array[
    'uuid','text','text','text','text','text','text','public.humn_origin_input',
    'text','text','integer','text','text','text','text','timestamp with time zone','timestamp with time zone'
  ], 'anon', array[]::text[], 'anon cannot execute upload RPC'
);
select function_privs_are(
  'public', 'create_origin_work', array[
    'uuid','text','text','text','text','text','text','public.humn_origin_input',
    'text','text','integer','text','text','text','text','timestamp with time zone','timestamp with time zone'
  ], 'authenticated', array[]::text[], 'legacy authenticated upload RPC is retired after Chunk 4'
);


select ok(
  has_function_privilege('service_role', 'public.create_origin_work_with_provenance(uuid,uuid,text,text,text,text,text,text,public.humn_origin_input,text,text,integer,text,text,text,text,timestamp with time zone,timestamp with time zone,jsonb,boolean)', 'EXECUTE'),
  'trusted server may execute provenance-aware creation RPC'
);

select ok(exists(select 1 from storage.buckets where id='work-originals' and public=false), 'original bucket is private');
select ok(exists(select 1 from storage.buckets where id='work-display' and public=true), 'display bucket is public');
select ok(exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='work_originals_owner_insert'), 'original upload policy exists');
select ok(exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='work_display_owner_insert'), 'display upload policy exists');
select ok(exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='work_display_public_read'), 'display public read policy exists');
select ok(exists(select 1 from pg_constraint where conrelid='public.works'::regclass and conname='works_aspect_ratio_check'), 'measured ratio constraint exists');
select ok(exists(select 1 from pg_constraint where conrelid='public.works'::regclass and conname='works_category_check'), 'canonical category constraint exists');
select is((select count(*) from public.works where status='verified' and proof_count=0), 0::bigint, 'verified with zero proofs remains impossible');

select * from finish();
rollback;
