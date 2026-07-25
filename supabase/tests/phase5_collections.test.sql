begin;
select plan(8);

select has_index(
  'public',
  'collections',
  'collections_owner_name_ci_unique',
  'collection names are unique per owner, case-insensitively'
);

select is(
  (select count(*)::integer from pg_proc where oid = 'public.create_collection_with_optional_work(text,public.humn_collection_privacy,uuid)'::regprocedure),
  1,
  'atomic collection creation RPC exists'
);

select is(
  (select count(*)::integer from pg_proc where oid = 'public.get_collection_detail(uuid)'::regprocedure),
  1,
  'collection detail RPC exists'
);

select policies_are(
  'public', 'collections',
  array[
    'collections_owner_delete',
    'collections_owner_insert',
    'collections_owner_read',
    'collections_owner_update',
    'collections_public_read'
  ],
  'collections retain complete owner/public RLS'
);

select policies_are(
  'public', 'collection_items',
  array[
    'collection_items_owner_delete',
    'collection_items_owner_insert',
    'collection_items_owner_update',
    'collection_items_parent_read'
  ],
  'collection items retain parent/owner RLS'
);

select ok(
  (select prosecdef = false from pg_proc where oid = 'public.get_collection_detail(uuid)'::regprocedure),
  'detail RPC is security invoker'
);

select ok(
  (select prosecdef = false from pg_proc where oid = 'public.create_collection_with_optional_work(text,public.humn_collection_privacy,uuid)'::regprocedure),
  'create RPC is security invoker'
);

select is(
  has_function_privilege('anon', 'public.get_collection_detail(uuid)', 'EXECUTE'),
  true,
  'anonymous users can resolve public collection URLs through RLS'
);

select * from finish();
rollback;
