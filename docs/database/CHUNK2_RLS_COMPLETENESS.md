# Humn — RLS completeness boundary

This chunk completes authorization policies before the save, follow, report,
collection-create, and upload mutations are enabled in later chunks.

## Permission matrix

| Table | Anonymous | Authenticated owner/reporter | Other authenticated user | Trusted server/service role |
|---|---|---|---|---|
| `users` | Read public profiles | Read; update own `display_name` and `avatar_url` only | Read; cannot update | Bypasses RLS; protected-field trigger still applies unless a validated flow explicitly opts in |
| `works` | Read `declared`, `awaiting`, and `verified` | Public read plus read own rejected rows; insert/update/delete own rows | Public read only | Bypasses RLS |
| `proof_entries` | Read when parent Work is publicly readable | Read; insert/update/delete when parent Work is owned | Public-parent read only | Bypasses RLS |
| `file_evidence` | Read when parent Work is publicly readable | Read; insert/update/delete when parent Work is owned | Public-parent read only | Bypasses RLS |
| `technical_signals` | Read when parent Work is publicly readable | Read; insert/update/delete when parent Work is owned | Public-parent read only | Bypasses RLS |
| `collections` | Read public Collections | Read own private/public; insert/update/delete own | Read public only | Bypasses RLS |
| `collection_items` | Read items in public Collections | Read and mutate items only in owned Collections | Read items in public Collections only | Bypasses RLS |
| `follows` | Read | Insert/delete only rows where `follower_id = auth.uid()` | Cannot mutate another follower's rows | Bypasses RLS |
| `reports` | No access | Insert own report; read own reports | Insert/read only their own rows | Bypasses RLS; moderation access remains server/admin-only |

## Handle immutability

The `users.handle` unique constraint remains authoritative. Ordinary authenticated
clients receive update privilege only for `display_name` and `avatar_url`.
`protect_humn_user_fields()` additionally rejects direct changes to `id`, `handle`,
`reputation`, or `created_at`.

A future validated handle-change function may set the transaction-local
`humn.allow_handle_change` flag only after it performs availability, cooldown,
redirect, and audit checks. No such client flow is enabled in this chunk.

## UI boundary

The existing visual controls remain in place, but mutations are intentionally
inert for authenticated users until their feature chunks:

- Save to Collection — Chunk 4
- Follow — Chunk 4
- Collection creation — Chunk 4
- Reports — Chunk 5
- Upload/share work — Chunk 6

Signed-out interactions route through `/signin`, which aliases the existing
`/auth` screen. No browser or mobile code receives a service-role key.
