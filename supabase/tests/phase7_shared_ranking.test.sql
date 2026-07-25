begin;

select plan(4);

select has_function(
  'public',
  'work_feed_rank',
  array['uuid','humn_work_status','humn_origin_input','boolean','integer'],
  'shared provenance rank exists'
);

select has_function(
  'public',
  'get_filtered_work_feed',
  array['text[]','text','humn_origin_input[]','integer','timestamp with time zone','uuid','integer'],
  'cursor-based filtered Discover exists'
);

select has_function(
  'public',
  'search_work_feed',
  array['text','integer','timestamp with time zone','uuid','integer'],
  'cursor-based Work search exists'
);

select has_function(
  'public',
  'search_creators',
  array['text','bigint','text','uuid','integer'],
  'cursor-based creator search exists'
);

select * from finish();
rollback;
