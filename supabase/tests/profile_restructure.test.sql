begin;
select plan(5);

select has_function(
  'public',
  'get_creator_public_works',
  array['text', 'integer'],
  'public creator-work RPC exists'
);

select function_privs_are(
  'public',
  'get_creator_public_works',
  array['text', 'integer'],
  'anon',
  array['EXECUTE'],
  'anonymous viewers can load public creator work'
);

select function_privs_are(
  'public',
  'get_creator_public_works',
  array['text', 'integer'],
  'authenticated',
  array['EXECUTE'],
  'authenticated viewers can load public creator work'
);

select is(
  (
    select count(*)::integer
    from public.get_creator_public_works('robertd44', 100)
    where badge_variant = 'unverified'
  ),
  0,
  'public creator feed excludes unverified work'
);

select is(
  (
    select count(*)::integer
    from public.get_creator_public_works('robertd44', 100)
    where status not in ('verified', 'awaiting')
  ),
  0,
  'public creator feed contains only verified and awaiting work'
);

select * from finish();
rollback;
