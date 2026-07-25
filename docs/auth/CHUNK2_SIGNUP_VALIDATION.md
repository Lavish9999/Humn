# Chunk 2 Auth validation fix

## Confirmed failure path before this patch

The failing Create account submission stopped inside `signUpAction` at the Zod
`safeParse` call. Supabase was not contacted when the username contained an
uppercase character.

The previous username rule was:

- 3 to 30 characters
- lowercase `a-z`
- digits `0-9`
- underscores `_`
- regular expression: `^[a-z0-9_]+$`

`Robertd44` therefore failed app-side validation before any Supabase request. The
server action then redirected to a generic query-string error, which remounted the
page and cleared all fields.

## Behavior after this patch

- Username input is visibly documented as lowercase letters, numbers, and
  underscores, 3–30 characters.
- Capital letters are converted to lowercase as the user types and again on the
  server.
- Client validation shows exact field errors without sending a request.
- Server validation repeats the same rules as a trust boundary.
- Failed submissions preserve display name, username, email, and the masked
  password value in client state.
- Supabase errors are mapped to the relevant field when possible, with the raw
  message retained in a friendly fallback for unknown failures.
- Server and browser diagnostic logs report only the stage and failing field
  names. They never log email addresses or passwords.

## Confirm email

The hosted project's Confirm email toggle cannot be inferred from repository
files. `supabase/config.toml` does not set the hosted dashboard value. The old UI
always displayed a check-email message even when Supabase returned a session, so
that behavior was not proof that the toggle was enabled.

The new signup action checks the actual Supabase response:

- `data.session === null`: confirmation is required; the form shows the check-email message.
- `data.session !== null`: confirmation is not required; the user is sent to Discover.

The remote setting can also be inspected in Supabase Dashboard under
Authentication → Providers → Email.
