# Chunk 3 — creator upload pipeline

## Boundaries

This chunk accepts one JPEG, PNG, or WebP file up to 15 MB. It processes the file in a Node.js route handler, uploads the private original and public WebP derivatives to Supabase Storage, then atomically inserts the Work and file-evidence rows through a security-invoker Postgres function.

All uploaded Works begin with:

- `origin_input = uploaded`
- `status = declared`
- `proof_count = 0`

The database function accepts the full `humn_origin_input` enum so a later `captured_in_app` pipeline can use the same transaction without rewriting the data model.

## Storage

- `work-originals`: private; only the owner can read or modify objects under their UUID folder.
- `work-display`: public read; only the owner can write or remove objects under their UUID folder.

Paths are immutable and per-user:

```text
<user-id>/<work-id>/original.<extension>
<user-id>/<work-id>/display.webp
<user-id>/<work-id>/thumbnail.webp
```

## Recorded evidence

The route computes SHA-256 from the original bytes, reads dimensions from the image decoder, and extracts EXIF only when present. Missing EXIF remains null. Uploading an image never upgrades it beyond DECLARED.

## Verification query

After uploading a JPEG and PNG, run:

```sql
select
  w.id,
  u.handle,
  w.title,
  w.origin_input,
  w.status,
  w.proof_count,
  fe.original_hash,
  fe.dimensions,
  fe.capture_device,
  fe.lens,
  fe.iso,
  fe.shutter,
  fe.captured_at,
  fe.uploaded_at
from public.works w
join public.users u on u.id = w.creator_id
join public.file_evidence fe on fe.work_id = w.id
where u.handle = '<your-handle>'
order by w.created_at desc
limit 10;
```


Confirm the objects exist in Storage with:

```sql
select bucket_id, name, metadata->>'mimetype' as mime_type, created_at
from storage.objects
where name like '<your-user-id>/%'
order by created_at desc;
```
