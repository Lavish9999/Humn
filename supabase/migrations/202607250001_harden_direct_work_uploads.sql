-- Direct browser-to-Storage work uploads.
-- The browser may only upload with a server-issued signed upload token. Ordinary
-- anon/authenticated writes, overwrites, and deletes in the work buckets are blocked.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values
  (
    'work-originals',
    'work-originals',
    false,
    15728640,
    array['image/jpeg', 'image/png', 'image/webp']::text[]
  ),
  (
    'work-display',
    'work-display',
    true,
    15728640,
    array['image/webp']::text[]
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- An owner may read their private original through an authenticated Storage call.
-- The public work-display bucket intentionally remains publicly readable.
drop policy if exists "work originals owner read" on storage.objects;
create policy "work originals owner read"
on storage.objects
as permissive
for select
to authenticated
using (
  bucket_id = 'work-originals'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- RESTRICTIVE guards are combined with every existing permissive policy. This
-- prevents an older broad Storage policy from granting cross-creator access.
drop policy if exists "work originals cross creator read guard" on storage.objects;
create policy "work originals cross creator read guard"
on storage.objects
as restrictive
for select
to public
using (
  bucket_id <> 'work-originals'
  or (
    auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  )
);

drop policy if exists "work buckets signed uploads only" on storage.objects;
create policy "work buckets signed uploads only"
on storage.objects
as restrictive
for insert
to public
with check (
  bucket_id not in ('work-originals', 'work-display')
);

drop policy if exists "work buckets no client overwrite" on storage.objects;
create policy "work buckets no client overwrite"
on storage.objects
as restrictive
for update
to public
using (
  bucket_id not in ('work-originals', 'work-display')
)
with check (
  bucket_id not in ('work-originals', 'work-display')
);

drop policy if exists "work buckets no client delete" on storage.objects;
create policy "work buckets no client delete"
on storage.objects
as restrictive
for delete
to public
using (
  bucket_id not in ('work-originals', 'work-display')
);
