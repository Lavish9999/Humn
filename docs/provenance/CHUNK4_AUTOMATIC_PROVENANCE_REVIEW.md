# Chunk 4 — automatic provenance and thin human review

## Boundary

This chunk records provenance evidence and applies mechanical ranking rules. It does **not** implement an AI detector, human-likelihood score, or percentage verdict.

- Missing C2PA is neutral.
- Missing EXIF is neutral.
- Upload alone remains `DECLARED`.
- `VERIFIED` requires at least one creator-authored proof entry plus an explicit reviewer approval.
- The only automatic AI-origin label comes from an embedded C2PA digital-source assertion that itself declares trained-algorithmic or synthetic media.

## Server-only environment

Add this value to `apps/web/.env.local` before testing uploads:

```env
SUPABASE_SERVICE_ROLE_KEY=your_project_service_role_or_secret_key
```

The key is imported only by `apps/web/lib/supabase/admin.ts`, which is marked `server-only`. Never prefix it with `NEXT_PUBLIC_`, commit it, paste it into chat, or expose it to browser/mobile code.

## Automatic upload path

`POST /api/works/upload` now:

1. validates the authenticated creator and image;
2. hashes and processes the original file;
3. attempts local C2PA parsing with `@contentauth/c2pa-node`;
4. records EXIF presence without penalizing absent fields;
5. uploads the private original and public derivatives;
6. calls the service-role-only `create_origin_work_with_provenance` RPC;
7. atomically inserts the Work, File Evidence, C2PA/EXIF/origin signals and exact-hash duplicate signal.

The legacy authenticated `create_origin_work` RPC and direct browser inserts into `works` / `file_evidence` are revoked so the provenance pipeline cannot be skipped.

## Recorded signals

`provenance_signals` stores one row per Work and signal name:

- `c2pa`
- `exif_consistency`
- `duplicate_hash`
- `origin_input`

Weights are internal ranking inputs, not public confidence scores. The Work detail page renders plain-language evidence notes and the existing hedge language, not the numeric weights.

## Automatic rules

- C2PA trained-algorithmic/synthetic source assertion: `ai_declared = true`; remains outside the human-made verified tier and receives a strong ranking reduction.
- C2PA camera-capture assertion: positive mechanical ranking input.
- `captured_in_app`: reserved future origin mode and highest origin-input ranking input.
- ordinary upload: `status = declared`, `proof_count = 0`, no human review request.
- exact hash duplicate: negative ranking input and stored matching Work ID.
- each open report: ranking reduction; three open reports create a `reported_threshold` review request.

## Proof authoring and verification request

Creators can use `/work/<id>/proofs` to add timestamped Proof Story entries with an optional genuine stage image. A stage image is never synthesized from or copied from the hero image.

A Work enters `AWAITING REVIEW` only after its creator requests verification with at least one proof entry. The request creates a `verification_request` row. Creators cannot assign `VERIFIED` themselves.

## Reputation and reviewers

`users.reviewer_level` is derived from reputation:

- level 0: under 500
- level 1: 500+
- level 2: 1,500+
- level 3: 5,000+
- `is_admin = true`: level 3 override

The migration bootstraps `@robertd44` as the initial admin. Seed accounts remain below reviewer level 1. Tenure adds at most one reputation point per completed month, capped at 60 months. Approved Works add 25 creator reputation. Reporters whose open reports are accepted by a reject/remove action receive 5 points.

## Human-review queue

`/moderation` is server-gated and RLS/RPC-gated. It lists only open requests caused by:

- three or more open reports; or
- a creator request for the verified tier.

Every moderation decision writes a `moderation_actions` audit row with reviewer, action, reason, previous status, next status and timestamp.

- `APPROVE`: requires at least one proof and no C2PA AI declaration; sets `verified`.
- `REJECT`: sets `declared`; reason is retained for the creator.
- `REMOVE`: sets `rejected`, adds `removed_at`, and removes the Work from public feeds.

## Migration and tests

Migration:

```text
supabase/migrations/202607240012_automatic_provenance_review.sql
```

Structural policy tests:

```text
supabase/tests/chunk4_provenance_review.test.sql
```

The prior upload and RLS tests are updated to reflect the retired legacy creation RPC and reviewer report policy.

## Verification queries

### Recent Work statuses and mechanical rank

```sql
select
  w.id,
  u.handle,
  w.title,
  w.origin_input,
  w.status,
  w.proof_count,
  w.ai_declared,
  w.report_count,
  public.work_feed_rank(w.id, w.status, w.origin_input, w.ai_declared, w.report_count) as feed_rank
from public.works w
join public.users u on u.id = w.creator_id
where u.handle = 'robertd44'
order by w.created_at desc
limit 10;
```

### Provenance signal rows

```sql
select
  ps.work_id,
  w.title,
  ps.signal_name,
  ps.value,
  ps.weight,
  ps.created_at
from public.provenance_signals ps
join public.works w on w.id = ps.work_id
where w.creator_id = (select id from public.users where handle = 'robertd44')
order by ps.created_at desc, ps.signal_name;
```

For a normal stripped upload, expect the C2PA value to contain `state: "none"` (or `unavailable` only if the native parser could not load) and a neutral weight of zero. EXIF absence also has weight zero.

### Human-review queue

```sql
select
  rr.work_id,
  w.title,
  rr.trigger_type,
  rr.state,
  rr.created_at,
  w.report_count,
  w.proof_count,
  w.status
from public.review_requests rr
join public.works w on w.id = rr.work_id
order by rr.created_at desc;
```

### Audit trail

```sql
select
  ma.work_id,
  w.title,
  reviewer.handle as reviewer,
  ma.action,
  ma.reason,
  ma.previous_status,
  ma.next_status,
  ma.created_at
from public.moderation_actions ma
join public.works w on w.id = ma.work_id
join public.users reviewer on reviewer.id = ma.reviewer_id
order by ma.created_at desc;
```

## Manual verification sequence

1. Upload a normal stripped image. Confirm `DECLARED`, zero proofs, no review request, and neutral no-manifest/no-EXIF rows.
2. Upload a genuine C2PA asset when one is available. Confirm the parsed issuer, source types and validation status are stored. A camera-capture assertion raises mechanical rank; a trained-algorithmic assertion sets `ai_declared` and cannot be approved as human-made.
3. Use three different authenticated accounts to report one Work. Confirm `report_count = 3`, a `reported_threshold` request exists, and the feed rank falls.
4. As the creator, add a proof entry and request verification. Confirm `status = awaiting` and a `verification_request` exists.
5. As the admin, approve through `/moderation`. Confirm `status = verified`, proof count remains at least one, the request resolves, and an audit row exists.

Actual Work IDs and result rows are generated only after these uploads/reports occur in the linked Supabase project; they are not fabricated in this handoff.
