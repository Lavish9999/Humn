# Humn Round 5a Checklist

Scope: three targeted bug fixes only. Design tokens, typography, routing, page layout, and seed imagery URLs were not changed.

## 1. Red feed-card boxes

- [x] Feed media wrapper keeps the Work aspect ratio and uses `var(--paper-deep)` as the only fallback surface.
  - `apps/web/components/work-card.tsx:6-21`
  - `apps/web/app/globals.css:95-97`
- [x] Feed images are block-level, fill the wrapper in both dimensions, and use centered `object-fit: cover`.
  - `apps/web/app/globals.css:97`
- [x] Loading/missing surface is flat `var(--paper-deep)` with no animation.
  - `apps/web/components/work-card.tsx:11-12`
  - `apps/web/app/globals.css:95-96`
- [x] Pure-red source scan passed: no `#f00`, `#ff0000`, `rgb(255,0,0)`, `bg-red`, Tailwind `red-*` background utilities, or red background declarations remain in the web app or shared packages.
- [x] Render fixture checked at 375px, 768px, and 1440px: each image matched its wrapper dimensions and each screenshot contained zero pure `#FF0000` pixels.
  - Audit result: `humn-round5a-audit/results.json`

## 2. Provenance badge derivation

- [x] One shared derivation function now applies the exact proof/review rules and singular/plural labels.
  - `apps/web/components/provenance-badge.tsx:15-50`
- [x] Feed cards use the shared derivation inputs.
  - `apps/web/components/work-card.tsx:6-25`
- [x] Work detail uses the same shared derivation for both the badge and explanatory empty state.
  - `apps/web/app/work/[id]/page.tsx:33-40`
  - `apps/web/app/work/[id]/page.tsx:85-88`
  - `apps/web/app/work/[id]/page.tsx:109-123`
- [x] Style guide examples use the same shared component.
  - `apps/web/app/style-guide/page.tsx:12`
- [x] Development seed data explicitly stores review completion and produces 31 VERIFIED, 13 AWAITING, and 8 DECLARED Works out of 52.
  - `apps/web/lib/dev-catalogue.ts:15-34`
  - `apps/web/lib/dev-catalogue.ts:188-217`
  - `apps/web/lib/dev-catalogue.ts:241-284`
- [x] Discover positions 1-3 render VERIFIED, AWAITING REVIEW, and DECLARED HUMAN-MADE respectively.
- [x] Unit checks confirmed:
  - zero proofs always becomes DECLARED HUMAN-MADE;
  - one reviewed proof becomes VERIFIED · 1 PROOF;
  - multiple reviewed proofs use PROOFS;
  - unreviewed proof evidence becomes AWAITING REVIEW;
  - VERIFIED never renders with zero proofs.

## 3. Small fixes

- [x] The New Collection card now contains a real visible plus mark and label instead of relying on empty pseudo-element markup.
  - `apps/web/app/collections/page.tsx:92`
  - `apps/web/app/globals.css:136-139`
- [x] Discover-only top spacing is reduced to nav height plus 32px (`var(--space-8)`).
  - `apps/web/app/globals.css:20`

## Validation

- TypeScript/TSX syntax parse: passed for all six changed source modules.
- CSS brace validation: 284 opening / 284 closing braces.
- Badge behavior test: passed.
- Seed distribution test: 31 / 13 / 8 across 52 Works.
- First-screen variant test: VERIFIED / AWAITING / DECLARED.
- Pure-red source scan: passed.
- Responsive feed render fixture: passed at 375px, 768px, and 1440px with zero pure-red pixels.
