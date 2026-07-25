begin;
select plan(12);

select has_table('public', 'follows', 'follows table exists');
select has_index('public', 'follows', 'follows_creator_created_idx', 'creator-side follow index exists');
select has_index('public', 'follows', 'follows_follower_created_idx', 'follower-side follow index exists');
select has_function(
  'public',
  'get_following_work_feed',
  array['text[]','text','public.humn_origin_input[]','integer','timestamp with time zone','uuid','integer'],
  'cursor-based following feed RPC exists'
);
select has_function('public', 'get_creator_network', array['text','text','integer','integer'], 'creator network RPC exists');

select policies_are(
  'public',
  'follows',
  array['follows_public_read','follows_follower_insert','follows_follower_delete'],
  'follows retains public read and follower-owned mutations'
);

select table_privs_are(
  'public',
  'follows',
  'anon',
  array['SELECT'],
  'anonymous users can only read follows'
);

select table_privs_are(
  'public',
  'follows',
  'authenticated',
  array['SELECT','INSERT','DELETE'],
  'authenticated users can read and mutate only through RLS'
);

select function_privs_are(
  'public',
  'get_following_work_feed',
  array['text[]','text','public.humn_origin_input[]','integer','timestamp with time zone','uuid','integer'],
  'authenticated',
  array['EXECUTE'],
  'authenticated users can load their Following feed'
);

select function_privs_are(
  'public',
  'get_creator_network',
  array['text','text','integer','integer'],
  'anon',
  array['EXECUTE'],
  'anonymous users can load public network lists'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.follows'::regclass
      and conname = 'follows_no_self_follow'
  ),
  'self-follow constraint exists'
);

select is(
  (select count(*)::integer from public.follows where follower_id = creator_id),
  0,
  'seed and current data contain no self-follows'
);

select * from finish();
rollback;
