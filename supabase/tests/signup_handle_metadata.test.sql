begin;
select plan(8);

select is(
  (select count(*)::integer from pg_proc where oid = 'public.next_available_humn_handle(text,uuid)'::regprocedure),
  1,
  'Numeric-suffix handle resolver exists'
);

select is(
  (select count(*)::integer from pg_proc where oid = 'public.sync_auth_user_to_humn_users()'::regprocedure),
  1,
  'Auth-to-profile synchronization function exists'
);

select is(
  (
    select count(*)::integer
    from pg_trigger
    where tgrelid = 'auth.users'::regclass
      and tgname = 'humn_auth_user_created'
      and not tgisinternal
  ),
  1,
  'Auth profile trigger exists'
);

select like(
  pg_get_functiondef('public.sync_auth_user_to_humn_users()'::regprocedure),
  '%raw_user_meta_data->>''handle''%',
  'Profile trigger reads the explicit handle metadata key'
);

select like(
  pg_get_functiondef('public.sync_auth_user_to_humn_users()'::regprocedure),
  '%signup_source%',
  'Profile trigger distinguishes form and OAuth signups'
);

select like(
  pg_get_functiondef('public.sync_auth_user_to_humn_users()'::regprocedure),
  '%requires_handle_choice%',
  'Generated OAuth handles are flagged for handle choice'
);

select like(
  pg_get_functiondef('public.next_available_humn_handle(text,uuid)'::regprocedure),
  '%suffix_number in 2..9999%',
  'Collision handling uses numeric suffixes'
);

select ok(
  has_function_privilege('authenticated', 'public.complete_humn_profile(text,text)', 'EXECUTE'),
  'Authenticated users may complete a generated or adjusted handle'
);

select * from finish();
rollback;
