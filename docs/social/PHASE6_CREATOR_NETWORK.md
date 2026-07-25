# Humn Phase 6 — Creator Network

## Scope

Phase 6 completes the existing `follows` table as a shared Supabase backend primitive and adds public creator-network surfaces without changing provenance, strike, moderation, or badge logic.

## Public profile

`/creator/[handle]` now includes:

- avatar, display name, handle, and join date;
- positive creator framing only;
- verified-work, follower, and following counts;
- live Follow/Following state;
- clickable followers and following counts;
- verified and awaiting public work only.

Private standing, strikes, appeals, cooldowns, and suspension remain exclusively on `/account`.

## Follow behavior

Follow controls appear on:

- creator profiles;
- work-card creator rows across Home, Discover, Search, Collections, and creator showcases;
- Work detail creator rows;
- follower and following lists.

The UI updates optimistically and reconciles with `/api/follows`. Supabase RLS still restricts insert/delete to rows where `follower_id = auth.uid()`. A database constraint and API guard both prevent self-follow.

## Public lists

- `/creator/[handle]/followers`
- `/creator/[handle]/following`

Both are public and paginated. Each row contains identity, positive verified-work count, follower count, and a follow control.

## Following feed

`/discover?view=following` shows recent default-discoverable work from creators followed by the signed-in user. It reuses the existing public-discoverability and provenance ranking functions; unverified self-declared work is not promoted into the Following feed.

## Verification SQL

```sql
select
  f.follower_id,
  follower.handle as follower_handle,
  f.creator_id,
  creator.handle as creator_handle,
  f.created_at
from public.follows f
join public.users follower on follower.id = f.follower_id
join public.users creator on creator.id = f.creator_id
order by f.created_at desc;
```

Count reconciliation:

```sql
select
  u.handle,
  (select count(*) from public.follows f where f.creator_id = u.id) as followers,
  (select count(*) from public.follows f where f.follower_id = u.id) as following
from public.users u
where u.handle in ('robertd44');
```
