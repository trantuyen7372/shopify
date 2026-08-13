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
- [x] Live run: 112 collections + 182 products seeded, menu pushed (10/40/95 items), 38 images uploaded
- [x] Live browser QA with real pointer clicks (three-level menu, category cards, collection pages)
- [x] Header rebuilt: inline search bar + full-width dark nav bar
- [x] Journal seeded with four demo articles so the blog section stops showing placeholders
- [x] Mobile QA: header wrapping fixed, 3-level drawer menu verified with real taps
- [x] Footer Information column added (5 placeholder policy pages + Sitemap link), 4-column grid fix
- [x] Blog menu item split into 5 category blogs (Holiday/Culture/History/Fashion/How To), matching the reference's menu depth
- [x] Hero converted from a single static banner to a 3-slide slideshow (New Arrivals / Outerwear / Home Decor), matching the reference's rotating hero — verified with real dot-navigation clicks and no overflow on mobile

## Resolved blocker

`upload-theme-images.mjs` needs the **`write_files`** scope (`stagedUploadsCreate` with
`resource: FILE` returns ACCESS_DENIED without it; product images work because they fall
under `write_products`). The scope was added to the custom app on 2026-08-12 and the
existing token kept working.

## Left for the merchant

- Press logos ("As Seen On") — real, licensed outlet logos
- Real product photography to replace the generated tartan swatches
- Real policy text for the 5 placeholder pages (shipping, privacy, terms, refund, return)
