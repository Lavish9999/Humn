begin;
select plan(18);

select is(
  (select badge_variant from public.derive_work_badge('declared', 0, false)),
  'unverified',
  'bare declared status maps to the unverified badge variant'
);
select is(
  (select badge_label from public.derive_work_badge('declared', 0, false)),
  'UNVERIFIED · SELF-DECLARED',
  'bare declared status names the uploader as the source of the claim'
);
select is(
  (select badge_label from public.derive_work_badge('verified', 1, false)),
  'VERIFIED · 1 PROOF',
  'verified singular proof label is correct'
);
select is(
  (select badge_label from public.derive_work_badge('verified', 2, false)),
  'VERIFIED · 2 PROOFS',
  'verified plural proof label is correct'
);
select is(
  (select badge_label from public.derive_work_badge('awaiting', 1, false)),
  'AWAITING REVIEW',
  'awaiting with evidence retains the awaiting label'
);
select is(
  (select badge_label from public.derive_work_badge('awaiting', 0, false)),
  'UNVERIFIED · SELF-DECLARED',
  'awaiting without evidence cannot render as a review tier'
);
select is(
  (select badge_label from public.derive_work_badge('verified', 4, true)),
  'UNVERIFIED · SELF-DECLARED',
  'legacy AI-declared rows never render a human trust badge'
);

select is(
  (select count(*)::integer from public.get_work_feed(null, null, null, 60) where badge_variant = 'unverified'),
  0,
  'default Discover excludes bare unverified Works'
);
select is(
  (select count(*)::integer from public.get_work_feed(null, null, null, 60) where ai_declared),
  0,
  'default Discover excludes AI-declared legacy rows'
);
select ok(
  (select count(*) from public.get_unverified_work_feed(null, null, null, 60)) >= 0,
  'explicit unverified feed RPC is callable'
);
select is(
  (select count(*)::integer from public.get_unverified_work_feed(null, null, null, 60) where badge_variant <> 'unverified'),
  0,
  'explicit unverified feed contains only recessive unverified badges'
);

select is(
  (select count(*)::integer
   from public.search_work_feed('test', 60, false)
   where badge_variant = 'unverified'),
  0,
  'default Search excludes unverified Works'
);
select ok(
  (select count(*) from pg_proc where oid = 'public.get_unverified_work_feed(integer,timestamp with time zone,uuid,integer)'::regprocedure) = 1,
  'unverified feed function exists'
);
select ok(
  (select count(*) from pg_proc where oid = 'public.get_my_unverified_works(integer)'::regprocedure) = 1,
  'creator unverified-work prompt function exists'
);
select ok(
  has_function_privilege('authenticated', 'public.get_my_unverified_works(integer)', 'EXECUTE'),
  'authenticated creators may read their own unverified Work list'
);
select ok(
  not has_function_privilege('anon', 'public.get_my_unverified_works(integer)', 'EXECUTE'),
  'anonymous users cannot read a creator account prompt list'
);
select like(
  obj_description('public.get_work_feed(integer,timestamp with time zone,uuid,integer)'::regprocedure),
  '%Bare uploads are excluded%',
  'default-feed honesty invariant is documented'
);
select like(
  obj_description('public.get_unverified_work_feed(integer,timestamp with time zone,uuid,integer)'::regprocedure),
  '%Absence of provenance is neutral%',
  'unverified-feed neutrality invariant is documented'
);

select * from finish();
rollback;
