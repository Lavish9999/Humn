# Chunk 2: signup handle metadata and profile-trigger repair

## Root cause

The form submitted `username` metadata, while the live trigger path could still
fall back to a generated `member_XXXXXXXX` handle. This patch makes the contract
explicit: form signup sends both `handle` and the legacy `username` key, plus
`display_name` and `signup_source=form`. The trigger reads `handle` first.

## Form signup

A valid available form handle is inserted unchanged into `public.users.handle`.
The Auth row retains these values in `auth.users.raw_user_meta_data`:

- `handle`
- `username`
- `display_name`
- `signup_source=form`
- `resolved_handle`
- `requires_handle_choice=false`

A race-condition collision receives a numeric suffix such as `_2`. Metadata is
flagged with `handle_adjusted=true` and the existing complete-profile route is
shown on the next authenticated visit.

## OAuth signup

OAuth accounts without an explicitly chosen Humn handle receive a deterministic
`member_XXXXXXXX` handle. Their Auth metadata contains:

- `signup_source=oauth`
- `handle_origin=generated`
- `requires_handle_choice=true`
- `handle_choice_reason=generated`

The server and client navigation route that authenticated account to
`/complete-profile`; it is never rendered as signed out.

## Backfill

Fallback profiles are repaired automatically when an older Auth row still has a
valid chosen `handle` or `username` in metadata. Remaining generated profiles are
flagged for handle choice. Established non-fallback handles are not changed.

## Verification queries

After a fresh form signup with `testcreator`:

```sql
select
  auth_user.email,
  auth_user.raw_user_meta_data,
  profile.handle
from auth.users auth_user
join public.users profile on profile.id = auth_user.id
where auth_user.email = 'FORM_TEST_EMAIL';
```

Expected public handle: `testcreator`.

After a fresh Google signup:

```sql
select
  auth_user.email,
  auth_user.raw_user_meta_data,
  profile.handle
from auth.users auth_user
join public.users profile on profile.id = auth_user.id
where auth_user.email = 'GOOGLE_TEST_EMAIL';
```

Expected public handle: `member_XXXXXXXX` (or a numeric collision suffix), with
`requires_handle_choice=true` and `handle_choice_reason=generated`.
