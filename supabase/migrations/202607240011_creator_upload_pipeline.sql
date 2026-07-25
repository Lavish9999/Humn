begin;

-- Uploaded originals remain private. Display derivatives are public because they
-- are the media shown in Discover and Work detail pages.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'work-originals',
  'work-originals',
  false,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'work-display',
  'work-display',
  true,
  15728640,
  array['image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Real uploads preserve the measured ratio instead of forcing one of the seed
-- catalogue ratios. Existing ratios remain valid under this broader constraint.
alter table public.works drop constraint if exists works_aspect_ratio_check;
alter table public.works
  add constraint works_aspect_ratio_check
  check (aspect_ratio ~ '^[1-9][0-9]{0,4}:[1-9][0-9]{0,4}$');

alter table public.works drop constraint if exists works_category_check;
alter table public.works
  add constraint works_category_check
  check (category in (
    'tattoos', 'hairstyles', 'outfits', 'home-interiors', 'food-recipes',
    'traditional-art', 'digital-art', 'photography', 'crafts-diy',
    'furniture-woodworking', 'weddings-events', 'beauty-makeup',
    'landscaping-gardens'
  ));

-- Storage object access is scoped to the first folder segment, which is always
-- the authenticated user's UUID. Public display reads do not grant public writes.
drop policy if exists work_originals_owner_read on storage.objects;
drop policy if exists work_originals_owner_insert on storage.objects;
drop policy if exists work_originals_owner_update on storage.objects;
drop policy if exists work_originals_owner_delete on storage.objects;
drop policy if exists work_display_public_read on storage.objects;
drop policy if exists work_display_owner_insert on storage.objects;
drop policy if exists work_display_owner_update on storage.objects;
drop policy if exists work_display_owner_delete on storage.objects;

create policy work_originals_owner_read
on storage.objects for select to authenticated
using (
  bucket_id = 'work-originals'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy work_originals_owner_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'work-originals'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy work_originals_owner_update
on storage.objects for update to authenticated
using (
  bucket_id = 'work-originals'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'work-originals'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy work_originals_owner_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'work-originals'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy work_display_public_read
on storage.objects for select to anon, authenticated
using (bucket_id = 'work-display');

create policy work_display_owner_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'work-display'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy work_display_owner_update
on storage.objects for update to authenticated
using (
  bucket_id = 'work-display'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'work-display'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy work_display_owner_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'work-display'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- This function is intentionally origin-input aware. Chunk 3 calls it with
-- 'uploaded'; a future captured_in_app pipeline can reuse the same transaction.
create or replace function public.create_origin_work(
  p_work_id uuid,
  p_title text,
  p_description text,
  p_category text,
  p_aspect_ratio text,
  p_image_url text,
  p_thumb_url text,
  p_origin_input public.humn_origin_input,
  p_capture_device text default null,
  p_lens text default null,
  p_iso integer default null,
  p_shutter text default null,
  p_dimensions text default null,
  p_file_format text default null,
  p_original_hash text default null,
  p_captured_at timestamptz default null,
  p_uploaded_at timestamptz default now()
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_creator_id uuid := auth.uid();
begin
  if v_creator_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  insert into public.works (
    id, creator_id, title, description, category, aspect_ratio, image_url,
    thumb_url, origin_input, status, proof_count, created_at, published_at
  ) values (
    p_work_id, v_creator_id, p_title, p_description, p_category, p_aspect_ratio,
    p_image_url, p_thumb_url, p_origin_input, 'declared', 0, now(), now()
  );

  insert into public.file_evidence (
    work_id, capture_device, lens, iso, shutter, dimensions, file_format,
    original_hash, captured_at, uploaded_at
  ) values (
    p_work_id, p_capture_device, p_lens, p_iso, p_shutter, p_dimensions,
    p_file_format, p_original_hash, p_captured_at, coalesce(p_uploaded_at, now())
  );

  return p_work_id;
end;
$$;

revoke all on function public.create_origin_work(
  uuid, text, text, text, text, text, text, public.humn_origin_input,
  text, text, integer, text, text, text, text, timestamptz, timestamptz
) from public, anon;

grant execute on function public.create_origin_work(
  uuid, text, text, text, text, text, text, public.humn_origin_input,
  text, text, integer, text, text, text, text, timestamptz, timestamptz
) to authenticated;

comment on function public.create_origin_work(
  uuid, text, text, text, text, text, text, public.humn_origin_input,
  text, text, integer, text, text, text, text, timestamptz, timestamptz
) is 'Atomically creates a creator-owned DECLARED Work and its recorded file evidence.';

commit;
