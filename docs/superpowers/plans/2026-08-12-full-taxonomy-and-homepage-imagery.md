# Full Taxonomy + Homepage Imagery — Plan

**Date:** 2026-08-12
**Branch:** `demo-catalog-seeding`
**Reference:** https://www.tartanvibesclothing.com/ (structure only — no assets, photos or copy are reproduced)

## Why

After the first catalog pass the store had 24 collections and a two-level menu, while the
reference site runs a three-level menu over ~100 collections, and every homepage category
card carries a product photo. The homepage read as a wireframe of empty boxes and the menu
was visibly shallower than the reference.

## Decisions

- **Mirror the reference taxonomy, not its assets.** Category names are functional; photos
  and marketing copy are not reproduced. All imagery is procedurally generated tartan.
- **One source of truth.** `scripts/taxonomy.mjs` holds the tree; the seeding script and the
  navigation script both consume it, so the menu cannot reference a missing collection.
- **Shared leaves keep every parent.** A leaf such as `hoodie` hangs under both departments;
  its products are tagged with both parent handles so neither department empties out.
- **Two products per leaf**, generated deterministically from a clan/region name pool so the
  clan collections fill up as a side effect.
- **Press logos stay empty.** Real outlet logos are the merchant's to supply.

## Steps

- [x] `scripts/taxonomy.mjs` — 112 collections, 91 product-type leaves, 3 levels
- [x] `scripts/palettes.mjs` — palettes extracted so both seed scripts share one definition
- [x] `scripts/seed-taxonomy.mjs` — idempotent collection + product seeding with tartan images
- [x] `scripts/setup-navigation.mjs` — menu built from the taxonomy
- [x] `templates/index.json` — 37 category cards re-pointed at their specific collections
- [x] `scripts/upload-theme-images.mjs` — generates and uploads one tartan image per homepage
      slot (hero + 37 cards), then rewrites the template with `shopify://shop_images/...` refs
- [ ] Live run: seed taxonomy → run nav script → upload theme images
- [ ] Live browser QA with real pointer clicks (three-level menu, category cards, product page)

## Blocker

`upload-theme-images.mjs` needs the **`write_files`** scope, which the custom app token does
not currently have (`stagedUploadsCreate` with `resource: FILE` returns ACCESS_DENIED).
Product images work because they fall under `write_products`. Add `write_files` in
Admin → Settings → Apps and sales channels → Develop apps → [app] → Configuration, reinstall,
then update `SHOPIFY_ADMIN_TOKEN` in `.env` if it changes.
