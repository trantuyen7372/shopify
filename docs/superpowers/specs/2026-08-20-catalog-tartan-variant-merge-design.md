# Catalog Merge: Per-Tartan Products → Tartan Variant Option

## Context

The client flagged that our product pages don't match the reference site
(tartanvibesclothing.com): the reference uses one "template" product per
item type (e.g. one Ceramic Ornament) with a "Choose Your Tartan" dropdown,
while our catalog has one full product per tartan (e.g. "Saskatchewan
Tartan Pillow Cover", "Yukon Tartan Pillow Cover" as two separate products).

The reference's dropdown is backed by a print-on-demand personalization
app that generates a composited mockup image per selection — infeasible
here because **this store's inventory is self-produced/pre-stocked, not
POD** (confirmed with the client). Adopting a POD app would mean adopting
a fulfillment model the business doesn't use.

Instead, this spec covers merging our catalog into the same one-product
group, using Shopify's native variant system: one product per item type,
with a real "Tartan" option whose values are actual pre-stocked SKUs
(real photo, real price, real inventory per tartan). This reproduces the
dropdown UX with zero new apps and no theme code changes — the product
template already renders `variant_picker` for any option that exists.

A 2-product pilot (Saskatchewan + Yukon Pillow Cover → one "Tartan Pillow
Cover" product) validated the approach and surfaced one real risk (below).
This spec covers rolling the same pattern out to the rest of the catalog.

## Current State (as of this spec)

- 222 live products, each named `<Tartan> Tartan <Item Name>` (e.g.
  "Alberta Tartan Bedding Set"), one tartan per product.
- 108 apparel products already carry a `Size` option (4 values); the
  rest are single "Default Title" variant.
- Regrouping products by the `<Item Name>` suffix of their title (not by
  product tags, which are inconsistently applied — see Data Quality
  below) yields:
  - **94 groups** with 2+ products → merge candidates
  - **25 groups** with exactly 1 product → no merge needed, left as-is
  - **1 product** ("Tartan Pillow Cover") already merged in the pilot
  - Total after full rollout: **~120 products** (from 222)
- No merge group exceeds Shopify's 100-variant-per-product limit. The
  largest (`Tartan Tees`, `Tartan Polos`) tops out at 16 combos
  (4 tartans × 4 sizes). Full per-group combo counts were computed and
  saved as part of this session's exploration; the migration script
  (below) recomputes them at run time from live data rather than a
  static list, so this spec does not duplicate that table.

## Data Quality Note

Some products are missing their narrow type tag (e.g. "Highland Tartan
Slippers" is tagged only `footwear`, not `tartan-slippers`), which is why
grouping by title suffix is used instead of tags. Title suffix is 100%
reliable across the catalog (only one title — the already-merged Pillow
Cover — doesn't match the `<Tartan> Tartan <Item Name>` pattern, because
it no longer has a tartan prefix).

## Risk Found in the Pilot: Search Breakage

`sections/find-your-clans.liquid` and `snippets/clan-finder-sidebar.liquid`
link each clan/tartan name to `/search?q="<Name> tartan"` (exact-phrase
search), relying on that phrase appearing in a product's indexed text.
Before the merge, the phrase lived in the product **title**. After
merging, the title becomes generic (e.g. "Tartan Pillow Cover") and no
longer contains any specific tartan name, so the search stopped
returning that product for either tartan's link — confirmed empirically
in the pilot (0 results before the fix, product appeared after).

**Mitigation (required for every merged product):** the merged
product's `body_html` must explicitly mention each tartan name in the
form `"<Name> tartan"` (e.g. "Available in Saskatchewan tartan and Yukon
tartan"). Shopify's default search indexes body content, so this
restores the search link. This is now a required field in the per-group
migration, not optional polish.

## Migration Procedure (per merge group)

For each group of 2+ products sharing an item name:

1. Fetch full data (title, tags, body_html, images, options, variants,
   product_type, vendor) for every product in the group.
2. Create one new product:
   - `title`: `"Tartan <Item Name>"` (e.g. "Tartan Pillow Cover")
   - `product_type`, `vendor`: inherited from the source products
     (identical across the group in every case checked)
   - `tags`: union of all source products' tags, deduplicated
   - `options`: `[{"name": "Tartan", "values": [<every tartan name in
     the group>]}]` — plus the existing `Size` option carried over
     unchanged for apparel groups (two-dimensional option: Tartan ×
     Size)
   - `variants`: cross product of Tartan × (Size if present), each
     variant's `price` taken from its source product/variant
   - `body_html`: a merged description that (a) explicitly names every
     tartan per the search-risk mitigation above, and (b) otherwise
     follows the same Product Details / Care Instructions / Perfect For
     structure already used catalog-wide, generalized to not name one
     specific tartan in the opening sentence
   - `images`: one image per source product, uploaded to the new product
3. Assign each image to its corresponding Tartan variant(s) via
   `variant.image_id` (for apparel groups with Size, all Size variants
   under the same Tartan share that Tartan's image).
4. Verify on the storefront: variant picker renders, switching Tartan
   (and Size, where present) updates price/image, and
   `/search?q="<Name> tartan"` returns the new product for every tartan
   in the group.
5. Delete the source products for that group.

No theme code changes are needed — `templates/product.json`'s
`variant_picker` block already renders whatever options a product has.

## Execution Order & Safety

- Process one merge group at a time, verify, then move to the next —
  not a single bulk operation — so a bad merge is caught before it
  compounds (94 groups is enough that batching blind would risk a
  systemic mistake going unnoticed for a while).
- No redirects are set up for the deleted product URLs, per the same
  reasoning as the pilot: this is a dev store with no real traffic/SEO
  history yet.
- This is destructive (deletes 195 live products) but reversible in the
  sense that all source data is fetched and can be reconstructed before
  any delete call — the migration script should hold each group's full
  source data until after the new product is created and verified,
  and only then delete.

## Out of Scope

- No print-on-demand app integration (ruled out — doesn't match this
  store's fulfillment model).
- No changes to the 25 singleton groups (nothing to merge).
- No theme/Liquid changes (existing `variant_picker` block already
  handles this).
- Fixing the underlying tag-consistency issue (some products missing
  narrow type tags) is not addressed — title-suffix grouping works
  around it for this migration, but the tags themselves stay as they
  are.
