# Humn sign-in recovery fix

## Changed behavior

- `/signin` and `/auth` perform a server-side session check. An authenticated user is redirected to the sanitized `next` destination or `/discover` instead of seeing the form.
- The client uses an explicit loading state with `try/catch/finally`; it always resets after validation, server errors, network errors, and timeout.
- Client requests time out after 15 seconds. The server-side Supabase sign-in call has a 12-second timeout.
- Wrong credentials, unconfirmed email, HTTP 429/rate limiting, invalid email, network failure, and timeout receive distinct inline messages.
- Existing authenticated sessions are handled defensively by the server action even if a stale form remains mounted.
- Internal `next` destinations are preserved while external or auth-loop redirects are rejected.

No database migration is required.
