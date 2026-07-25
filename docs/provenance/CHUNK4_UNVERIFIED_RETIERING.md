# Chunk 4: unverified retiering

## Product rule

A bare upload is not classified as AI and is not treated as suspicious. It is
labeled `UNVERIFIED · SELF-DECLARED`, excluded from default Discover/Search, and
available in the explicitly labeled `/discover?view=unverified` area.

Only `VERIFIED` uses the vermillion trust treatment. `AWAITING REVIEW` and
`UNVERIFIED · SELF-DECLARED` remain muted.

## Mechanical default-feed eligibility

A Work may enter default Discover when at least one of the following is true:

- It is VERIFIED and has at least one Proof Story entry.
- It is AWAITING REVIEW and has at least one Proof Story entry.
- It was captured through the reserved `captured_in_app` origin path.
- Its C2PA manifest explicitly asserts camera capture.

A legacy AI-declared row is excluded. New C2PA AI-declared uploads are already
rejected before Work creation by the strike pipeline.

## Creator path

Bare upload → UNVERIFIED → add Proof Story → request review → AWAITING REVIEW →
human approval → VERIFIED.

Missing C2PA and missing EXIF remain neutral throughout this path.
