# Humn Chunk 4 Addition — AI Credential Rejection and Graduated Strikes

This addition rejects an upload before Storage or Work creation only when the file's own embedded C2PA Content Credentials explicitly assert trained-algorithmic or synthetic origin. It does not use visual classification, an AI-likelihood score, missing metadata, or a provenance-weight threshold.

## Confident strike sources

A strike can be created only by:

1. `c2pa_ai`: the uploaded file's own C2PA credential explicitly declares AI-generated/synthetic origin.
2. `review_upheld`: a human reviewer explicitly upholds a clear ownership or proof violation.

Reports alone never create a strike. The report threshold continues to demote the Work mechanically and create a human-review request only.

## Upload behavior

The trusted upload route processes the original bytes and reads C2PA before uploading any object to Supabase Storage. If `ai_generation_asserted` is true:

- no original is stored;
- no display derivative is stored;
- no public Work is created;
- `record_ai_upload_strike` records or collapses the accountability event;
- the creator receives a non-accusatory explanation that the decision came from the file's own credentials, not a detector or guess.

A second defense exists in `create_origin_work_with_provenance`: even a trusted-server regression cannot create a Work when `p_ai_declared=true`.

## Graduated response

Active strikes are rows where `expires_at > now()` and `appeal_status <> 'upheld'`.

- 1 active strike: educational warning, no posting restriction.
- 2 active strikes: seven-day posting cooldown; browsing remains available.
- 3 or more active strikes: posting suspension pending appeal; browsing remains available.

Every new strike extends all active strikes to six months from the newest strike, implementing six months of clean behavior before decay.

Identical C2PA AI attempts from the same user and original SHA-256 hash within 15 minutes collapse to one strike. Distinct confident violations do not collapse.

## Appeals

Creators see standing and strike history at `/you`. One human appeal may be submitted for each strike. Pending appeals appear in `/moderation`, and reviewers can:

- uphold the appeal, which overturns the strike and immediately recalculates penalties;
- deny the appeal;
- manually overturn a strike with an audited reason.

All issue, appeal, resolution, and overturn events are written to `moderation_actions`.

## Human-reviewed strikes

The moderation Work detail includes a separate accountability action. Reviewers must deliberately provide a clear violation reason. Work approval/rejection/removal remains separate from strike issuance, preventing report brigading from becoming an automatic penalty.

## Verification queries

### Latest strike rows and state

```sql
select
  s.id,
  u.handle,
  s.source,
  s.reason,
  s.evidence_hash,
  s.created_at,
  s.expires_at,
  s.appeal_status,
  u.posting_cooldown_until,
  u.suspended_at
from public.strikes s
join public.users u on u.id = s.user_id
where u.handle = 'robertd44'
order by s.created_at desc;
```

### Confirm no Work was created for an AI-declared attempt

Compare the rejected file's SHA-256 to `file_evidence.original_hash`. It should have a strike row but no file-evidence or Work row.

### Normal no-metadata upload

A normal PNG/JPEG with no C2PA manifest and no EXIF should create a DECLARED Work and create no strike row. Absence remains neutral.
