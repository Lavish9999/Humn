# Humn editorial redesign — Round 4 checklist

## 1a — Seeded Collections restored
- `apps/web/lib/dev-collections.ts:15-53` defines Kitchen renovation, Sleeve references, and Weekly recipes without removing database Collections.
- `apps/web/app/collections/page.tsx:66-71` merges development Collections with real rows by name.
- `apps/web/app/collections/page.tsx:82-93` renders every Collection as a self-contained card and keeps New Collection last.
- `apps/web/app/globals.css:124-143` contains the card, nested 2×2 mosaic, caption, metadata, and matching New Collection tile.

## 2a — Select chevron
- `apps/web/components/select-chevron.tsx:1-17` contains the requested inline 12×12 SVG path.
- `apps/web/app/collections/page.tsx:78` and `apps/web/app/report/[id]/page.tsx:49` use the shared SVG.
- `apps/web/app/globals.css:116-121` removes native appearance and positions the SVG in `--ink-muted`.
- A source grep found no literal `v`, `>`, `^`, `x`, or `⌄` used as an icon in the web code.

## 2b — Masonry gutter alignment
- `apps/web/components/masonry-feed.tsx:8-13` wraps every feed in the same `.shell` used by page headings.
- `apps/web/app/globals.css:89-90` keeps the masonry within that shell and preserves ruled gutters.

## 2c — Development seed catalogue
- `apps/web/lib/dev-catalogue.ts:46-177` defines 52 works across all 13 launch categories.
- `apps/web/lib/dev-catalogue.ts:179-207` rotates 2:3, 1:1, 4:5, 3:2, and 9:16 ratios with no adjacent duplicates and applies a 31 / 13 / 8 VERIFIED / AWAITING / DECLARED distribution.
- `apps/web/lib/dev-catalogue.ts:210-230` creates Proof Stories from 0 through 6 entries.
- `apps/web/lib/dev-catalogue.ts:233-273` builds deterministic category-specific photographic placeholder URLs and evidence records.
- `apps/web/app/discover/page.tsx:9-14` merges seed Works with real database Works in development instead of hiding seeds when one database row exists.

## 3a — Sticky navigation clipping
- `apps/web/app/globals.css:4` sets `scroll-padding-top` to the navigation height.
- `apps/web/app/globals.css:19` defines the shared first-section offset.
- `apps/web/app/globals.css:21` keeps the sticky navigation opaque and above all page content.
- Home, Discover, Search, Collections, Settings, Report, and Work detail apply `.page-first-section` to their opening section.

## 3b — Footer anchoring
- `apps/web/app/layout.tsx:19-23` wraps the application in `.app-shell` and `.app-main`.
- `apps/web/app/globals.css:14-16` creates the `100dvh` flex-column shell and gives page content the remaining height.
- `apps/web/app/globals.css:213-221` removes artificial footer margin and lets the footer anchor naturally.

## 3c — Home preview strip
- `apps/web/components/masonry-feed.tsx:5` limits preview feeds to eight complete cards.
- `apps/web/app/page.tsx:44-47` renders the complete preview and places Open Full Index below it.
- `apps/web/app/globals.css:91` removes the old max-height crop, so captions cannot be cut at the section boundary.

## 4 — Work detail route and navigation
- `apps/web/app/work/[id]/page.tsx:64-151` resolves both database and development Works and renders the complete detail page.
- `apps/web/app/work/[id]/page.tsx:107-113` renders ORIGIN RECORD, the creator row, badge, and actions.
- `apps/web/app/work/[id]/page.tsx:115-125` renders the Proof Story timeline and an explicit visible empty state.
- `apps/web/app/work/[id]/page.tsx:127-136` renders FILE EVIDENCE.
- `apps/web/app/work/[id]/page.tsx:138-146` renders TECHNICAL SIGNALS, five-segment bars, the hedge line, and report/method links.
- `apps/web/components/work-card.tsx:11` links every Home, Discover, and Search feed card to `/work/[id]`.
- `apps/web/app/collections/page.tsx:35-41` links every Collection mosaic work to `/work/[id]`.

## 5 — Responsive audit
- `apps/web/app/globals.css:236-245` controls 768–1024px layouts and masonry column counts.
- `apps/web/app/globals.css:248-254` moves the hero and Work detail to a robust single-column layout by 900px.
- `apps/web/app/globals.css:256-289` handles the 375px navigation, grids, Collections, footer, and Work panel.
- `apps/web/app/globals.css:291-307` handles the narrowest controls, metadata, signal bars, and footer links.
- Representative render fixtures using the production classes were checked at 375px, 768px, and 1440px. No intended page requires horizontal scrolling. The patch also sets `overflow-x: clip` as a final viewport guard; it does not hide oversized core layouts because the affected grids explicitly collapse before their minimum widths are reached.
