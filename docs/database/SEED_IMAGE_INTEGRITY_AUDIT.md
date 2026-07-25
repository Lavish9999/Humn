# Humn Seed Image Integrity Audit

## Scope

This audit reviews all 40 seeded Works for visible subject coherence between the
seeded image, title, description, and category. It does not validate ownership,
licensing provenance, creator identity, or the truth of simulated file evidence;
those require separate launch-readiness review.

## Invariant

A VERIFIED or AWAITING work must never use a photo of a screen, a stock UI
screenshot, or an image whose subject differs from its stated category, title,
and description. Screen captures are valid only when the work itself is
screen-based and the description explicitly says so. Text must never be rewritten
to excuse an unrelated image: swap the image or delete the record.

## Outcome

| Metric | Count |
|---|---:|
| Works before | 40 |
| Images swapped | 7 |
| Works deleted | 9 |
| Works after | 31 |
| VERIFIED after | 19 (61.3%) |
| AWAITING after | 8 (25.8%) |
| DECLARED after | 4 (12.9%) |

The resulting distribution remains approximately 60% / 25% / 15%.

## Full audit

| # | Work ID | Creator | Work | Category | Status | Decision | Finding | Replacement source |
|---:|---|---|---|---|---|---|---|---|
| 1 | `5333c9fd-1b14-56d8-a94e-d34797dd9fd6` | @marisol.ink | Botanical sleeve, healed at six weeks | tattoos | VERIFIED | **KEEP** | Tattooed botanical sleeve subject matches the tattoo category and healed-work description. | — |
| 2 | `59d201b6-8335-51bf-ad24-5eeaeecb4005` | @tonehouse | Textured bob with copper glaze | hairstyles | AWAITING | **KEEP** | Styled hair portrait is plausible for the textured copper bob record. | — |
| 3 | `a643266d-7e5d-55df-a5bf-874e8fe78c6e` | @form.daily | Charcoal overshirt with wide denim | outfits | DECLARED | **KEEP** | Fashion portrait plausibly depicts the layered overshirt-and-denim outfit. | — |
| 4 | `caba45cb-912a-5431-a581-a92b54268029` | @fieldoffice | Oak kitchen with limestone worktop | home-interiors | VERIFIED | **KEEP** | Kitchen interior matches the oak-kitchen renovation record. | — |
| 5 | `a12e13cb-62af-5613-aa36-9c8fccde00e1` | @tableproof | Country loaf with sesame score | food-recipes | VERIFIED | **KEEP** | Artisan bread image matches the country-loaf recipe record. | — |
| 6 | `4499c76c-0fb8-5457-b908-975d931a33f5` | @atelier.south | Ochre figure on raw linen | traditional-art | AWAITING | **KEEP** | Figure-painting subject matches traditional artwork on raw linen. | — |
| 7 | `6cfc27b6-3401-57ea-92ac-809465e77ae3` | @screenfield | Night bus poster with scanned type | digital-art | VERIFIED | **DELETE** | The source depicts a screen/UI-oriented design scene, not the described printed night-bus poster. | — |
| 8 | `67331345-662a-5209-9f40-d93427e135f6` | @greywindow | Window portrait on 35mm film | photography | VERIFIED | **SWAP** | Portrait by a sunlit window; replaces a camera/product image. | https://www.pexels.com/photo/10260568/ |
| 9 | `ea83bb43-9e32-5440-a50f-fbbfd44a5f89` | @earthturn | Salt-glazed breakfast cup | crafts-diy | AWAITING | **KEEP** | Ceramic cup subject matches the salt-glazed breakfast-cup record. | — |
| 10 | `1852f38e-788b-50c7-a06d-92feeae1c318` | @northline.shop | Walnut table with wedged stretcher | furniture-woodworking | VERIFIED | **DELETE** | The source depicts tools/hardware rather than the finished walnut table and wedged stretcher. | — |
| 11 | `2ea16b8c-1295-55bf-8c6f-6865787b019d` | @softlight.events | Courtyard ceremony in late sun | weddings-events | VERIFIED | **KEEP** | Outdoor ceremony scene matches the courtyard wedding record. | — |
| 12 | `fb992b4d-bfcb-5678-8839-f97fa62691ea` | @facepractice | Soft chrome eye with brown liner | beauty-makeup | VERIFIED | **SWAP** | Metallic eye makeup close-up; replaces a generic cosmetics still life. | https://www.pexels.com/photo/17022634/ |
| 13 | `852eb2eb-edc3-5cfa-a72e-6b00a1f305dc` | @watershed.studio | Rain garden after first storm | landscaping-gardens | AWAITING | **KEEP** | Planted garden subject matches the rain-garden record. | — |
| 14 | `f021c6d3-d0ef-582f-917d-3b29cd04e91e` | @northstar.tattoo | Blackwork moth above the knee | tattoos | VERIFIED | **KEEP** | Tattoo subject plausibly matches the blackwork tattoo record. | — |
| 15 | `51641def-0459-5bbd-90f8-81165ba2f28f` | @crownroom | Braided crown with clean centre part | hairstyles | AWAITING | **SWAP** | Crown-braid hairstyle; replaces a generic salon image. | https://www.pexels.com/photo/5037263/ |
| 16 | `610abae2-349b-5981-b6b7-01d1c20b2f90` | @mara.studio | Linen suit for a warm evening | outfits | VERIFIED | **SWAP** | Linen-suit fashion portrait outdoors; replaces a clothing-rack image. | https://www.pexels.com/photo/18031039/ |
| 17 | `488c8449-00d4-5351-b377-f66dd7a086bd` | @northwall.design | Clay reading room with low shelves | home-interiors | VERIFIED | **KEEP** | Quiet interior scene matches the clay reading-room record. | — |
| 18 | `dcf25a60-e604-5319-ba13-97d686bd9d98` | @pantry.record | Miso mushroom noodles | food-recipes | AWAITING | **KEEP** | Prepared noodle dish plausibly matches the miso-mushroom noodle record. | — |
| 19 | `dec1994b-3a9a-5d18-9ff2-3fdfbd9cbb28` | @wetedge | Harbour study in four paint passes | traditional-art | VERIFIED | **KEEP** | Painting-in-progress subject matches the harbour-study record. | — |
| 20 | `b535c28d-7b30-5607-919a-faec30e3a3eb` | @typepractice | Archive cover built from scanned paper | digital-art | VERIFIED | **DELETE** | The source is a photo of a monitor/tutorial-style Photoshop screen, not an archive cover made from scanned paper. | — |
| 21 | `f2adb87c-efbf-58e2-9065-42c1e852fe0b` | @shoreframe | Low-tide line study | photography | DECLARED | **KEEP** | Low-tide shoreline subject matches the photographic line study. | — |
| 22 | `ca7d4b32-a76b-52de-a18e-d378016f7557` | @foldandsew | Cloth-bound field journal | crafts-diy | VERIFIED | **KEEP** | Handmade notebook/craft subject matches the cloth-bound journal. | — |
| 23 | `cac25e16-8abc-5081-b885-9abeb745409a` | @benchline | Ash bedside cabinet with dovetails | furniture-woodworking | VERIFIED | **DELETE** | The source is a generic furnished interior rather than an ash bedside cabinet with visible dovetail work. | — |
| 24 | `297506df-46d9-562d-aba0-70ec45c62e12` | @gathered.studio | Rust linen dinner table | weddings-events | VERIFIED | **KEEP** | Styled event table matches the rust-linen dinner-table record. | — |
| 25 | `51be54eb-a98a-5653-9827-eb5331bf4c3e` | @toneandlight | Warm skin with visible freckles | beauty-makeup | AWAITING | **KEEP** | Close beauty portrait plausibly matches visible freckles and warm-skin treatment. | — |
| 26 | `97e2cc3d-8e61-58fe-a33b-cd7f0d055e9d` | @greenroom.land | Shaded courtyard planting | landscaping-gardens | VERIFIED | **KEEP** | Courtyard planting subject matches the landscaping record. | — |
| 27 | `d73c557c-82b6-521b-8f31-1ad773f3b610` | @softneedle | Fine-line shoulder stems | tattoos | DECLARED | **KEEP** | Fine-line botanical tattoo subject matches the shoulder-stem record. | — |
| 28 | `316d39df-6576-5a3b-bef7-43fec36cb3a6` | @coil.practice | Natural curl shape with soft fringe | hairstyles | VERIFIED | **KEEP** | Curly hairstyle subject matches the natural-curl record. | — |
| 29 | `1430bd08-eaea-555b-9321-2379f057967e` | @wearing.room | Utility jacket over pleated trousers | outfits | AWAITING | **DELETE** | The source is a clothing-rack/product scene rather than the described worn outfit. | — |
| 30 | `c5d68964-f64e-5e1a-896c-3c628889e8e4` | @plainspace | Daylit dining corner with vintage chairs | home-interiors | VERIFIED | **KEEP** | Dining interior with chairs matches the daylit dining-corner record. | — |
| 31 | `fc9aa88b-0712-53fb-afe1-1bff1f8bb8fb` | @slowplate | Charred tomato toast with herb oil | food-recipes | VERIFIED | **SWAP** | Toast with herbs and cherry tomatoes; replaces a generic food image. | https://www.pexels.com/photo/1460860/ |
| 32 | `78432e37-bfde-5c97-93ac-fe3798e81cb2` | @pressroom | Two-colour relief print of a doorway | traditional-art | DECLARED | **DELETE** | The source is a general painting/art scene, not a two-colour relief print of a doorway. | — |
| 33 | `5036e3d2-4264-5f30-a325-78f9c9120724` | @vectorhouse | Cobalt map study with hand-drawn routes | digital-art | VERIFIED | **DELETE** | The source is a laptop/screen scene, not a cobalt map study with hand-drawn routes. | — |
| 34 | `a3f616c4-2881-53a5-ba52-350642fe51fb` | @closefocus | Hands at the cabinetmaker’s bench | photography | AWAITING | **SWAP** | Hands using a hand plane at a woodworking bench; replaces an unrelated workshop/portrait image. | https://www.pexels.com/photo/30907888/ |
| 35 | `8f83b34e-51b9-511f-a04e-9268dc0b939c` | @loomnotes | Woven wall panel in undyed wool | crafts-diy | VERIFIED | **KEEP** | Woven textile subject matches the undyed-wool wall panel. | — |
| 36 | `f21e0df0-1d96-5a9b-8988-eda880f605b8` | @grainwork | Low oak reading chair prototype | furniture-woodworking | DECLARED | **DELETE** | The source is a styled living-room chair, not a documented low-oak prototype. | — |
| 37 | `a263db3b-b5a3-5e29-b3e1-93462c155e19` | @stemarchive | City hall bouquet with spring branches | weddings-events | VERIFIED | **SWAP** | Bouquet with budding branches; replaces an unrelated event image. | https://www.pexels.com/photo/36963443/ |
| 38 | `d6abecec-4639-5e3a-89d3-a7e040301b80` | @lineface | Graphic liner in three angles | beauty-makeup | AWAITING | **DELETE** | The source is a generic beauty/salon image, not a three-angle graphic-liner study. | — |
| 39 | `fe546201-8d6e-5080-8c7e-643496d8b7f4` | @plotpractice | Edible border with herbs and flowers | landscaping-gardens | VERIFIED | **KEEP** | Herb-and-flower garden subject matches the edible border. | — |
| 40 | `b19e4987-089b-5453-bd00-6c58f26f1b93` | @ovenrecord | Mushroom pizza with blistered crust | food-recipes | DECLARED | **KEEP** | Pizza subject matches the mushroom pizza record. | — |

## Deleted-record behavior

The cleanup migration deletes only the nine flagged Work rows. Existing foreign
keys remove their proof entries, file evidence, technical signals, collection
items, and reports through `ON DELETE CASCADE`.

## Replacement records

Replacement URLs are explicit and deterministic. They are not selected at
runtime and are not assembled from category keyword pools.

## Validation performed

- Every one of the 40 seed Work IDs has exactly one audit decision.
- Seven rows are updated to deterministic replacement imagery.
- Nine incoherent rows are deleted.
- Thirty-one seed rows remain.
- Remaining status counts are 19 VERIFIED, 8 AWAITING, and 4 DECLARED.
- No VERIFIED survivor has zero proofs.
- The migration contains transaction-scoped assertions for those counts.
