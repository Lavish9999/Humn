# Chunk 2: navigation session and profile resilience

## Diagnosis

The live navigation was not reading authentication state at all. `PrimaryNav`
always rendered the literal `Sign in` link and had no Supabase session query or
auth-state subscription. A missing `public.users` row was therefore not the
immediate reason for the stale label, although the profile trigger still needed a
defensive repair and backfill.

## Behavior after this patch

- Server-rendered loads call `auth.getUser()` and load `public.users` from the
  cookie-backed SSR client.
- The client navigation subscribes to `onAuthStateChange` and updates without a
  manual browser refresh.
- Login uses the existing automatic `router.refresh()` to refresh the root layout
  after the server action writes session cookies.
- Logout updates the client state immediately, clears the Supabase session, then
  refreshes server-rendered content.
- A valid session with no profile renders `Complete profile`, never `Sign in`, and
  routes to `/complete-profile`.
- Migration `202607240009_auth_profile_resilience.sql` repairs the trigger,
  backfills existing orphaned accounts, and exposes a narrow authenticated RPC
  for the defensive completion route.
