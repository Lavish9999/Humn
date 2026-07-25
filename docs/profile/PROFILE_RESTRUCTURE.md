# Humn profile restructure

## Public creator profile

Route: `/creator/[handle]`

Publicly visible:

- Handle, display name, avatar, and join month/year
- Positive creator record based on verified Work count
- Verified and awaiting-review Work only, provenance-ranked
- Follow/unfollow control for authenticated viewers
- Owner-only links to edit the profile and open the private account

Never rendered publicly:

- Strike count or history
- Posting cooldown
- Suspension state
- Appeal history
- Private settings
- Unverified/self-declared Work in the main showcase

## Private account

Route: `/account`

Authenticated-user-only content:

- Current standing and posting restrictions
- Graduated-response explanation
- Unverified Works and Add Proof Story links
- Strike and appeal history
- Public display-name editing
- Feed settings and privacy
- Data export
- Account deletion

Legacy `/you` redirects to `/account`. Legacy `/settings` redirects to `/account#settings`.

## Navigation

- `@handle` opens the current user's public profile.
- `Account` opens the private account dashboard.
- Public-profile and private-account destinations are explicitly labeled.

## Database

Migration `202607240016_profile_restructure.sql` adds the public read RPC `get_creator_public_works`. It uses the existing provenance badge and ranking functions and returns only verified or awaiting Work with at least one proof. Unverified, removed, rejected, and AI-declared Work is excluded.

## Manual verification

1. Sign out and open `/creator/robertd44`.
2. Confirm the profile shows creator identity, join date, positive verified-Work count, and public Work.
3. Confirm no standing, strike, cooldown, suspension, appeal, export, or delete information appears.
4. Sign in as `robertd44`; confirm `@robertd44` in the nav opens `/creator/robertd44` and `Account` opens `/account`.
5. Open `/account`; confirm standing, strikes/appeals, unverified Work prompts, settings, export, and delete controls are present.
6. Sign out and request `/account`; confirm redirection to `/signin?next=/account`.
7. Sign in as another account and request `/account`; confirm it shows only that session's account data, never `robertd44`'s private data.
