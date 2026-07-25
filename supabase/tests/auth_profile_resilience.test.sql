begin;
select plan(6);

select is(
  (select count(*)::integer from pg_proc where oid = 'public.sync_auth_user_to_humn_users()'::regprocedure),
  1,
  'Auth profile sync function exists'
);

select is(
  (select count(*)::integer from pg_trigger where tgrelid = 'auth.users'::regclass and tgname = 'humn_auth_user_created' and not tgisinternal),
  1,
  'Auth user trigger exists'
);

select is(
  (select count(*)::integer from pg_proc where oid = 'public.complete_humn_profile(text,text)'::regprocedure),
  1,
  'Missing-profile recovery function exists'
);

select is(
  (
    select count(*)::integer
    from auth.users auth_user
    left join public.users profile on profile.id = auth_user.id
    where profile.id is null
  ),
  0,
  'Every Auth user has a public profile after backfill'
);

select ok(
  has_function_privilege('authenticated', 'public.complete_humn_profile(text,text)', 'EXECUTE'),
  'Authenticated users may execute the missing-profile recovery function'
);

select ok(
  not has_function_privilege('anon', 'public.complete_humn_profile(text,text)', 'EXECUTE'),
  'Anonymous users cannot execute the missing-profile recovery function'
);

select * from finish();
rollback;
