# Humn Phase 7 — search and shared provenance ranking

## Single ranking source

`public.work_feed_rank(...)` in `supabase/migrations/202607250018_phase7_search_feed.sql` is the only ordering score used by:

- default Discover
- Following
- Work search
- public creator showcases
- Collection detail

The function is mechanical provenance ordering only. It does not inspect image appearance and does not produce an AI-likelihood score. Tier bases guarantee clean VERIFIED Works rank above AWAITING Works; newest publication time and Work ID are the tie-breakers.

## Search

`/search?q=...` searches Work title, description, category slug/display name, creator handle, and creator display name. Work and creator results are grouped. Search is debounced in the browser and cursor-paginated through `/api/search`.

## Discover filters

`/discover` supports URL-backed category, provenance tier, and origin filters. Account settings supply the initial provenance tier. Captured-in-Humn is hidden when no eligible captured Work exists. Cursor pagination is served through `/api/discover`.

## Moderation navigation

The existing server-derived `canReview` value controls the Moderation nav entry. `/moderation` independently rechecks reviewer access server-side and returns not found for non-reviewers.
