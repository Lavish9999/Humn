begin;

select plan(14);

select ok(
  exists(select 1 from storage.buckets where id = 'work-originals'),
  'private original-work bucket exists'
);
select is(
  (select public from storage.buckets where id = 'work-originals'),
  false,
  'original-work bucket is private'
);
select is(
  (select file_size_limit from storage.buckets where id = 'work-originals'),
  15728640::bigint,
  'original-work bucket enforces the 15 MB limit'
);
select is(
  (select allowed_mime_types from storage.buckets where id = 'work-originals'),
  array['image/jpeg', 'image/png', 'image/webp']::text[],
  'original-work bucket accepts only supported image MIME types'
);

select ok(
  exists(select 1 from storage.buckets where id = 'work-display'),
  'public display-work bucket exists'
);
select is(
  (select public from storage.buckets where id = 'work-display'),
  true,
  'display-work bucket remains public'
);
select is(
  (select file_size_limit from storage.buckets where id = 'work-display'),
  15728640::bigint,
  'display-work bucket enforces the 15 MB limit'
);
select is(
  (select allowed_mime_types from storage.buckets where id = 'work-display'),
  array['image/webp']::text[],
  'display-work bucket accepts only generated WebP derivatives'
);

select ok(
  exists(
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'work originals owner read'
      and cmd = 'SELECT'
  ),
  'owners have an explicit private-original read policy'
);
select ok(
  exists(
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'work originals cross creator read guard'
      and permissive = 'RESTRICTIVE'
      and cmd = 'SELECT'
  ),
  'cross-creator reads are restricted even if another permissive policy exists'
);
select ok(
  exists(
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'work buckets signed uploads only'
      and permissive = 'RESTRICTIVE'
      and cmd = 'INSERT'
  ),
  'ordinary client inserts into work buckets are blocked'
);
select ok(
  exists(
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'work buckets no client overwrite'
      and permissive = 'RESTRICTIVE'
      and cmd = 'UPDATE'
  ),
  'ordinary client overwrites in work buckets are blocked'
);
select ok(
  exists(
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'work buckets no client delete'
      and permissive = 'RESTRICTIVE'
      and cmd = 'DELETE'
  ),
  'ordinary client deletes in work buckets are blocked'
);
select ok(
  coalesce((
    select with_check like '%work-originals%'
      and with_check like '%work-display%'
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'work buckets signed uploads only'
  ), false),
  'signed-upload guard covers both work buckets'
);

select * from finish();
rollback;
