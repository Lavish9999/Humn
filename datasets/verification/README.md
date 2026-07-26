# Humn automated verification benchmark dataset

This folder is intentionally data-empty in Git. Detector thresholds must be chosen from Humn-specific measurements, not vendor marketing claims or the placeholder defaults in the first migration.

## Target set: 1,500–1,800 images

Build a representative, licensed/consented set rather than a collection of obvious cherry-picked examples.

| Cohort | Suggested count | Required variation |
|---|---:|---|
| Real smartphone photographs | 600 | iPhone and Android; indoor/outdoor; people, food, art, crafts, interiors; low light; portrait mode; multiple camera generations |
| Real photographs with ordinary edits | 200 | crop, exposure, color, watermark, JPEG recompression, messaging/social-media export |
| Fully AI-generated images | 600 | roughly balanced across Midjourney, Flux, DALL·E/GPT Image, Stable Diffusion/SDXL, Imagen, Firefly or another current generator |
| AI-edited/partial-AI images | 150 | inpainting, background replacement, generative fill, face manipulation; retain the unedited source when permitted |
| AI images photographed from a screen | 250 | phones, tablets and monitors; different angles, brightness, distance, crop, focus and visible/non-visible bezel |
| Real images photographed from a screen or print | 100 | negative-control recaptures to measure whether the local screen fallback is over-broad |

A full initial benchmark therefore lands around 1,900 images. A smaller 1,000-image pilot is acceptable, but do not tune production thresholds on fewer than 1,000 representative items.

## Folder layout

```text
datasets/verification/
  manifest.jsonl
  images/
    real-smartphone/
    real-edited/
    ai/
      midjourney/
      flux/
      dalle-gpt-image/
      stable-diffusion/
      imagen/
      firefly-other/
    partial-ai/
    screen-rephoto-ai/
    screen-rephoto-real/
```

Image files under `images/` and the working `manifest.jsonl` are ignored by Git. Keep only `manifest.example.jsonl` in source control.

## Manifest format

One JSON object per line:

```json
{"id":"real-0001","path":"images/real-smartphone/real-0001.jpg","label":"real","source_type":"smartphone","generator":null,"edited":false,"compressed":false,"screen_rephotograph":false,"license":"owned-or-consented","notes":"iPhone rear camera, indoor low light"}
```

Allowed `label` values:

- `real`
- `ai`
- `partial_ai`
- `screen_rephoto_ai`
- `screen_rephoto_real`

Required fields:

- `id`: unique stable identifier
- `path`: relative to this directory
- `label`: one of the values above
- `source_type`: e.g. `smartphone`, `generator`, `screen-camera`, `print-camera`
- `generator`: generator name or `null`
- `edited`: boolean
- `compressed`: boolean
- `screen_rephotograph`: boolean
- `license`: ownership/consent/license note
- `notes`: optional but recommended

Do not include private user submissions without explicit evaluation consent. Strip unrelated personal data from the manifest, but do not alter benchmark image pixels or EXIF unless the sample's labelled cohort specifically represents an edited/exported copy.

## Run

Provision the server-only keys in your shell, then run from the repository root:

```bash
npm run benchmark:verification -- --manifest datasets/verification/manifest.jsonl
```

Useful options:

```bash
npm run benchmark:verification -- --manifest datasets/verification/manifest.jsonl --limit 100
npm run benchmark:verification -- --manifest datasets/verification/manifest.jsonl --output reports/verification-benchmark/pilot
npm run benchmark:verification -- --manifest datasets/verification/manifest.jsonl --optional-illuminarty
```

The script caches provider responses by image SHA-256 under `.verification-benchmark-cache/` so threshold experiments do not repeatedly consume detector API calls. Delete that cache only when intentionally re-running providers or testing a new provider/model version.

Sightengine Recapture is not part of the required benchmark path. The current screen result comes from Humn's local heuristic. A Recapture score is included only when the optional paid adapter is deliberately re-enabled behind `SIGHTENGINE_RECAPTURE_ENABLED`.

## Outputs

The harness writes:

- `report.json`: complete metric and per-sample data
- `report.md`: readable precision, recall, false-positive rate, false-verification rate, SELF-DECLARED abstention rate and coverage
- `samples.csv`: each label, score, decision and reason code

Interpretation rules:

- **False-positive rate:** real images auto-rejected / all real images evaluated.
- **False-verification rate:** AI-labelled images auto-VERIFIED / all AI-labelled images evaluated. This is the most dangerous failure for Humn.
- **SELF-DECLARED rate:** cases deliberately left without automated endorsement / all samples.
- Provider metrics exclude unavailable/error responses and separately report provider coverage.
- Combined-rule metrics treat SELF-DECLARED as abstention, not as a correct prediction or an automatic negative verdict.
- Tune on a training split and report final numbers on a held-out test split. Do not repeatedly tune against the same test set.

The benchmark TypeScript is compiled in the dedicated `Verification benchmark harness` GitHub Actions workflow on every relevant pull-request change.
