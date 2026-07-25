# Humn Round 5b — Work Detail Checklist

## Route and data
- Server-rendered dynamic route and database/dev lookup: `apps/web/app/work/[id]/page.tsx:123-152`
- 60/40 two-column page structure: `apps/web/app/work/[id]/page.tsx:173-211`; CSS `apps/web/app/globals.css:309-385`
- Single-column below 900px: `apps/web/app/globals.css:500-512`

## Left column
- Uncropped full-width Work image: `apps/web/app/work/[id]/page.tsx:176-187`; CSS `apps/web/app/globals.css:326-342`
- Fraunces 28px title: `apps/web/app/work/[id]/page.tsx:189-191`; CSS `apps/web/app/globals.css:344-352`
- 32px avatar, handle and outlined Follow action: `apps/web/app/work/[id]/page.tsx:192-198`; CSS `apps/web/app/globals.css:353-368`; behavior `apps/web/app/work/[id]/save-button.tsx:13-60`
- Description and Save to Collection / Share actions: `apps/web/app/work/[id]/page.tsx:199-207`; behavior `apps/web/app/work/[id]/save-button.tsx:62-138`

## Origin panel
- Sticky `ORIGIN RECORD` and shared provenance badge: `apps/web/app/work/[id]/page.tsx:211-217`; CSS `apps/web/app/globals.css:377-393`
- Proof Story timeline, thumbnails and persistent zero-entry explanation: `apps/web/app/work/[id]/page.tsx:219-260`; CSS `apps/web/app/globals.css:398-429`
- File Evidence rows with missing-value dash: `apps/web/app/work/[id]/page.tsx:163-171,262-274`; CSS `apps/web/app/globals.css:431-456`
- Truncated hash copy interaction and confirmation: `apps/web/app/work/[id]/copy-hash.tsx:5-24`; CSS `apps/web/app/globals.css:457-470`
- Technical Signals, five segments, qualifiers and standing hedge: `apps/web/app/work/[id]/page.tsx:100-115,276-284`; CSS `apps/web/app/globals.css:472-496`
- Report and method footer links: `apps/web/app/work/[id]/page.tsx:286-289`; danger treatment `apps/web/app/globals.css:497-498`

## Wiring
- Home, Discover and Search use the linked shared card: `apps/web/components/work-card.tsx:10`
- Collection mosaic Works link to the route: `apps/web/app/collections/page.tsx:36`
- Explicit 2px accent focus ring: `apps/web/app/globals.css:522-527`

## Seed states
- 6-entry verified fixture: `apps/web/lib/dev-catalogue.ts:263-270`
- 2-entry awaiting fixture: `apps/web/lib/dev-catalogue.ts:263-270`
- 0-entry declared fixture: `apps/web/lib/dev-catalogue.ts:263-270`
- Proof titles/thumbnails: `apps/web/lib/dev-catalogue.ts:234-252`
- Full file evidence and hedged signal fixtures: `apps/web/lib/dev-catalogue.ts:301-339`
