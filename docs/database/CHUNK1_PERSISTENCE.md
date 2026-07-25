# Humn backend — Chunk 1

This chunk replaces development arrays with Supabase-backed reads.

## Apply

```powershell
npx supabase db push --dry-run
npx supabase db push
npm run typecheck --workspace @human/web
```

The first migration archives the conflicting Phase 1 foundation tables in the `foundation_legacy` schema before creating the canonical Chunk 1 tables. It does not delete those archived rows.

## Route reads

- `/`: `get_work_feed`, first 8 records.
- `/discover`: `get_work_feed`, cursor-ready first 40 records.
- `/search`: `search_work_feed`; blank query uses `get_work_feed`.
- `/work/[id]`: `get_work_detail` returns the Work, creator, badge, ordered proof entries, file evidence, and technical signals.
- `/collections`: `get_collection_summaries` for the authenticated owner, including real counts and four-image previews.
- `/auth`: recent Work grid uses `get_work_feed`.
- `/style-guide`: live card examples use `get_work_feed`.

## Writes

RLS requires authentication. `HUMN_ENABLE_WRITES=false` keeps server mutations behind the Chunk 1 write guard until the authentication/write-flow chunk is enabled.

## Tables without application reads in Chunk 1

- `follows`: no application reads while Chunk 1 write/auth guards are disabled; wired in Chunk 2.
- `reports`: no application reads yet; reporting writes remain guarded for the moderation chunk.
- `users.reputation`: returned with Works but not displayed yet.
- `works.thumb_url`: used by Collection mosaics; the full feed currently uses `image_url`.
