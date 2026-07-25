# Humn Round 6 Checklist

## Scope preserved

- Existing paper / ink / vermillion / danger tokens were not changed.
- Existing route structure, Supabase queries, save/follow actions, and shared provenance badge variants remain in place.
- This patch changes seed integrity, shared count grammar, origin-record evidence semantics, targeted detail-page presentation, and the style-guide specimen flow only.

## Priority 1 — Seed data is semantically coherent

- [x] **1 — Forty whole, hand-authored Work records**
  - Record schema and required evidence fields: `apps/web/lib/dev-catalogue.ts:1-79`
  - Forty literal Work inputs begin at `apps/web/lib/dev-catalogue.ts:81` and end at `apps/web/lib/dev-catalogue.ts:1718`.
  - Every input owns its title, creator, category, explicit image ID, alt text, description, state, dimensions, timestamps, category-specific Proof Story, and file evidence.
  - Stable direct image URL construction: `apps/web/lib/dev-catalogue.ts:1720-1722`
  - Full record conversion without independent title/description/image pools: `apps/web/lib/dev-catalogue.ts:1761-1806`
  - Exported catalogue: `apps/web/lib/dev-catalogue.ts:1808-1810`
  - Distribution validated: 24 VERIFIED, 10 AWAITING, 6 DECLARED.
  - Proof Story lengths validated across 0, 1, 2, 3, 4, and 6 entries.
  - Category coverage validated: all 13 launch categories, with 40 total records.

## Priority 2 — Recurring bug prevention

- [x] **2a — No rendered placeholder/debug record strings**
  - Seed Work IDs are stable UUIDs inside the literal records, beginning at `apps/web/lib/dev-catalogue.ts:83`.
  - Hash values are generated as 64-character hexadecimal records at `apps/web/lib/dev-catalogue.ts:1724-1734` and assigned at `apps/web/lib/dev-catalogue.ts:1798`.
  - The detail page no longer renders a catalogue record ID; catalogue and file evidence are separated at `apps/web/app/work/[id]/page.tsx:263-283`.
  - Source scan across `apps/web` and `packages` returns no rendered strings containing `DEV-`, `TEST`, `PLACEHOLDER`, `LOREM`, `TODO`, `FIXME`, `XXX`, `SAMPLE`, `DUMMY`, `FOO`, or `BAR`.

- [x] **2b — One shared pluralization helper**
  - Shared helper: `apps/web/lib/pluralize.ts:1-4`
  - Provenance proof count: `apps/web/components/provenance-badge.tsx:34-37`
  - Collection Work count: `apps/web/app/collections/page.tsx:84-89`
  - Search result count: `apps/web/app/search/page.tsx:48`
  - Proof Story entry count: `apps/web/app/work/[id]/page.tsx:227`
  - Technical signal count: `apps/web/app/work/[id]/page.tsx:286-290`
  - Style-guide Work count: `apps/web/app/style-guide/page.tsx:17`
  - Source scan found no remaining inline numeric `PROOFS`, `ENTRIES`, `WORKS`, `SIGNALS`, or `RESULTS` construction.

## Priority 3 — File evidence semantics

- [x] **3 — Forensic rows are complete, ordered, and separate from cataloguing**
  - Exact ordered row definition — capture device, lens, ISO, shutter, dimensions, file format, original hash, captured, uploaded, origin input: `apps/web/app/work/[id]/page.tsx:162-172`
  - Missing-value normalization to an em dash: `apps/web/app/work/[id]/page.tsx:117-120`
  - Separate Catalogue block for category and published date: `apps/web/app/work/[id]/page.tsx:263-270`
  - File Evidence block: `apps/web/app/work/[id]/page.tsx:272-284`
  - First-eight / last-eight hash truncation and click-to-copy confirmation: `apps/web/app/work/[id]/copy-hash.tsx:5-26`
  - Catalogue and copy-confirmation styles: `apps/web/app/globals.css:543-579`

## Priority 4 — Proof Story details

- [x] **4a — Date and time are always shown together**
  - UTC record formatter outputs `YYYY-MM-DD · HH:MM`: `apps/web/app/work/[id]/page.tsx:42-49`
  - Seed entries store full ISO timestamps: `apps/web/lib/dev-catalogue.ts:1763-1768`

- [x] **4b — No empty thumbnail box**
  - Thumbnail markup is conditional: `apps/web/app/work/[id]/page.tsx:234-247`
  - Mobile layout only reserves the 80px column when `.has-thumbnail` is present: `apps/web/app/globals.css:617-621`

- [x] **4c — Entry count uses the shared helper**
  - `apps/web/app/work/[id]/page.tsx:227`

## Priority 5 — Detail page behavior

- [x] **5a — Action row is Save + Share**
  - `apps/web/app/work/[id]/save-button.tsx:127-135`

- [x] **5b — Work image is constrained without cropping**
  - Max-height 80vh, centered, `object-fit: contain`: `apps/web/app/globals.css:530-542`

- [x] **5c — Origin Record opens with the shared badge**
  - Panel and header: `apps/web/app/work/[id]/page.tsx:213-218`
  - Shared badge component remains the single provenance label implementation: `apps/web/components/provenance-badge.tsx:40-54`

- [x] **5d — Hedge line is readable body copy**
  - Sentence-case copy: `apps/web/app/work/[id]/page.tsx:294-296`
  - Inter Tight / body-family 13px styling: `apps/web/app/globals.css:580-587`

## Priority 6 — Style guide density

- [x] **6 — Cells size to content and Collection specimen is populated**
  - Populated 2x2 collection mosaic: `apps/web/app/style-guide/page.tsx:6-17`
  - Content-sized two-column flow: `apps/web/app/globals.css:588-600`
  - Real mosaic image fitting: `apps/web/app/globals.css:601-607`
  - Single-column small-screen flow: `apps/web/app/globals.css:609-611`

## Validation performed before packaging

- TypeScript / TSX syntax parse passed for every changed source file.
- CSS brace count is balanced.
- Seed parser confirmed 40 records, 13 categories, 24 / 10 / 6 state distribution, and Proof Story lengths from 0 through 6.
- Placeholder/debug string scan passed for application and shared-package source.
- Inline count grammar scan passed.
- A full Next.js typecheck is run automatically by the installation script on the founder's local dependency set.

## Representative Work URLs after applying

- Six-entry VERIFIED: `/work/5333c9fd-1b14-56d8-a94e-d34797dd9fd6`
- Two-entry AWAITING REVIEW: `/work/59d201b6-8335-51bf-ad24-5eeaeecb4005`
- Zero-entry DECLARED HUMAN-MADE: `/work/a643266d-7e5d-55df-a5bf-874e8fe78c6e`
