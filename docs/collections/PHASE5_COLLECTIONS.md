# Humn Phase 5 — Functional Collections

Phase 5 wires the existing Collection presentation to Supabase without changing provenance or trust logic.

## Save flow

- Every `WorkCard` and `/work/[id]` receives the signed-in user's Collection list and saved memberships in one server-side batch query.
- The picker can save or remove a Work from any number of Collections without a page reload.
- The picker can create a private or public Collection and atomically save the current Work into it.
- Signed-out save attempts route to `/signin`.
- All mutations use the authenticated Supabase server client and existing RLS.

## Collection routes

- `/collections` lists the owner's live Collections, counts, relative update time, and four-Work mosaic previews.
- `/collections/[id]` resolves through the `get_collection_detail` security-invoker RPC.
- Private Collections resolve only for their owner under RLS.
- Public Collections are readable by anyone with the URL.
- Owners can rename, change privacy, remove saved items, and delete a Collection.
- Deleting a Collection cascades only its `collection_items`; it never deletes Works.

## Database integrity

Migration `202607240015_collections_functional.sql` adds:

- Case-insensitive uniqueness of Collection names per owner.
- `create_collection_with_optional_work(...)` for atomic Collection creation plus optional initial save.
- `get_collection_detail(uuid)` for RLS-enforced detail data and provenance-ranked Work ordering.

The existing `humn_collection_item_touch` trigger updates `collections.updated_at` after save/removal.
