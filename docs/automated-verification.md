# Humn automated verification pipeline

## Label meaning

`VERIFIED · AUTOMATED CLEAR` means:

> Cleared by Humn's automated origin detectors.

It does **not** mean human-reviewed, guaranteed human-made, or impossible to fool. Every vendor output is treated as a fallible signal. When the pipeline cannot confidently clear or strongly reject a Work, the completed outcome is `SELF-DECLARED` rather than an indefinite reviewer queue.

## State flow

```text
SELF-DECLARED (`declared`)
  creator adds proof
  creator requests automated review
        ↓
AWAITING AUTOMATED REVIEW (`awaiting`)
  temporary queued/running state only
  durable server queue claims private original
  provenance + local screen heuristic + independent providers
        ↓
  VERIFIED       — both required detectors positively clear at high confidence and every guard is clean
  REJECTED       — explicit C2PA synthetic declaration or one required detector crosses a strong reject threshold
  SELF-DECLARED  — disagreement, incomplete/low-confidence scores, provider failure, duplicate, local screen or partial-AI suspicion
```

A completed run never leaves a Work in `awaiting`. AWAITING exists only while the durable queue is queued or running. Pipeline exceptions and stale-attempt exhaustion also return the Work to SELF-DECLARED. Human reviewers cannot award the automated VERIFIED badge.

## Trust boundary

The browser can call only `request_work_verification(work_id)`. That RPC verifies ownership, proof availability, posting eligibility and the per-user hourly rate limit, then queues a run.

Only Supabase `service_role` can call:

- `claim_verification_run(work_id)`
- `complete_verification_run(...)`

The completion RPC re-evaluates the conservative decision requirements inside Postgres. Application code cannot award VERIFIED merely by submitting the text `verified`:

- exactly two required provider results must be `ok`
- both AI scores must be present and at or below the configured clear threshold
- both deepfake scores must be present and below the configured reject threshold
- both confidence values must meet the configured minimum
- no required provider may error or time out
- no required AI/deepfake score may cross a reject threshold
- no optional provisioned recapture, localized-AI, local screen or duplicate-hash gate may be active
- the Work cannot carry an explicit synthetic C2PA assertion

Sightengine Recapture is **not required** and is not requested in the current configuration. The old Postgres trigger that demanded a primary Recapture score has been removed. The dormant score field, threshold and `SIGHTENGINE_RECAPTURE_ENABLED` flag remain only so a paid signal could be re-added later as an optional conservative blocker; absence is neutral and never counts as clear or adverse evidence.

RLS plus revoked table/function privileges prevent browser clients from writing runs, detector results, audit events or `works.status`. The authenticated self-verification test remains required to fail with SQLSTATE `42501`.

## Processing architecture

1. The request RPC atomically changes `declared → awaiting`, creates a review request, and inserts a queued pipeline run.
2. A Next.js server callback immediately tries to process that Work.
3. A bearer-protected recovery worker processes queued runs and recovers stale attempts.
4. The worker downloads the untouched original from private `work-originals` storage.
5. It reads current threshold/provider configuration from `verification_pipeline_config`.
6. It loads existing provenance inputs: C2PA, exact duplicate hash, EXIF summary and origin input.
7. It runs the local screen/rephotograph heuristic and configured provider adapters independently.
8. Core decision logic chooses VERIFIED, REJECTED or SELF-DECLARED.
9. Postgres independently enforces the rule, records normalized scores and raw responses, updates the Work, resolves the review request, and writes a SHA-256 evidence digest and event audit trail.

## Provider interface

Core decision code depends only on `DetectorProvider` and normalized `DetectorResult` contracts. Provider names are selected from the database configuration.

Required initial adapters:

- `sightengine` — primary AI-image and deepfake scores; content-safety flags run separately
- `hive` — independent secondary AI-generated-media and deepfake scores through Hive V3 Playground

Optional adapters/signals:

- `illuminarty` — configurable endpoint for whole-image and localized/heatmap evidence; disabled by default
- Sightengine Recapture — disabled and not provisioned; re-enableable only through the existing server-only environment flag after account entitlement

Adding or replacing a vendor requires an adapter and a configuration change; the decision engine and database rule remain vendor-neutral.

## Initial thresholds

These are conservative **starting configuration values**, not measured claims:

| Setting | Initial value | Behavior |
|---|---:|---|
| AI reject | 0.90 | Either required provider at/above rejects |
| AI clear | 0.10 | Both required providers must be at/below |
| Minimum confidence | 0.80 | Lower confidence returns SELF-DECLARED |
| Deepfake reject | 0.90 | Either required provider at/above rejects |
| Optional Recapture blocker | 0.50 | Used only if the paid signal is deliberately re-enabled |
| Local screen heuristic | 0.60 | Suspicion returns SELF-DECLARED |
| Optional localized-AI | 0.50 | Region suspicion returns SELF-DECLARED |
| Provider timeout | 15 seconds | Timeout returns SELF-DECLARED |
| User rate limit | 5 requests/hour | Stops detector API abuse |
| Maximum attempts | 3 | Stale exhaustion returns SELF-DECLARED |

Update the singleton config row only after examining a held-out Humn benchmark report.

## Screen/rephotograph v1

Coverage is explicitly partial. The current free path uses:

- periodic high-frequency texture/autocorrelation associated with moiré or pixel grids
- high edge density
- border/interior contrast that may indicate a screen bezel or print edge
- concentrated highlights/reflections
- weak common-display aspect and resolution matches

The local heuristic never clears or rejects by itself. Suspicion blocks VERIFIED and returns the Work to SELF-DECLARED.

Known misses:

- tightly cropped screens with no bezel
- intentionally defocused or motion-blurred recaptures
- high-density displays photographed at favorable angles/distances
- screen content occupying a small part of the photo
- prints without obvious paper edges or reflections
- camera pipelines that suppress moiré strongly

Known false positives:

- textiles, grids, halftone art and architectural patterns
- legitimate photos with strong borders or reflections
- images naturally matching common display dimensions

The labelled benchmark must include both AI screen recaptures and real-image screen/print recaptures to measure this tradeoff.

## Third-party secrets

Provision only as Vercel server environment variables:

- `SIGHTENGINE_API_USER`
- `SIGHTENGINE_API_SECRET`
- `HIVE_V3_SECRET_KEY`
- `AUTOMATED_REVIEW_SECRET`

Hive V3 uses the Playground Secret Key as a bearer credential. The Access Key ID is not sent to the detection endpoint. `HIVE_API_KEY` remains a temporary legacy environment-variable alias only.

Optional:

- `SIGHTENGINE_RECAPTURE_ENABLED` — keep `false` unless paid access is deliberately provisioned
- `ILLUMINARTY_API_URL`
- `ILLUMINARTY_API_KEY`
- `ILLUMINARTY_MEDIA_FIELD`
- `ILLUMINARTY_AUTH_SCHEME`

Never use `NEXT_PUBLIC_` prefixes for detector or worker credentials.

## Accuracy gate before launch

The benchmark harness is `scripts/verification-benchmark.ts`. Dataset instructions and the JSONL schema are in `datasets/verification/README.md`.

Do not describe the detector stack as reliable until the labelled Humn-distribution set has produced held-out measurements. The required report includes:

- precision, recall, false-positive rate and coverage per provider
- combined automatic rejection precision/recall/FPR
- false-verification rate for AI-labelled samples
- real-image auto-rejection rate
- SELF-DECLARED/abstention rate
- screen-rephotograph precision/recall/FPR
- every sample's scores, decision and reason code

Precision, recall and false-positive rate remain **UNMEASURED** until that benchmark runs.

## Deployment order

1. Validate migrations and pgTAP locally/CI.
2. Apply migrations through `202607250026` to Supabase.
3. Provision required Vercel secrets; keep Recapture disabled.
4. Deploy the Next.js application.
5. Run the labelled benchmark and tune database thresholds only from representative data.
6. Exercise a preview end-to-end with clean, AI, screen-recapture, provider-failure and normal-user denial cases.
7. Only then enable creator-facing automated review for launch.
