# Homepage Sections — Design

**Date:** 2026-07-07
**Status:** Approved (autonomous — user directed proceeding through all remaining phases without per-question review)
**Phase:** 2 of 4 (tartan-shop theme rebuild). Phase 1 (header/mega menu) is merged. Later phases: collection/product/blog template tweaks, footer & theme settings.

## Context

Assemble the homepage from the original scope: hero, clan/tartan finder, featured collection, five category grids (apparel, hoodies/jackets, dresses/skirts, home decor, accessories), testimonials, blog preview, and a press/"as seen on" strip.

Dawn already ships working, configurable sections for most of these:
- **Hero Banner** → `image-banner` (already in `templates/index.json`). Its `heading`, `text`, and `buttons` blocks cover heading/subheading/primary+secondary CTA. No new code.
- **Featured Product Collection** → `featured-collection` (already present). `quick_add` setting covers the "quick add button" requirement. No new code. ("Wishlist placeholder" touches the shared product card used on collection/product pages too — deferred to Phase 3 so it's designed once, not bolted onto homepage only.)
- **Category Grid** (all five: apparel, hoodies & jackets, dresses & skirts, home decor, accessories) → Dawn's `multicolumn` section is a generic image+title+link block grid — exactly a "category card" grid. No new code; each category becomes a separate `multicolumn` instance with its own blocks.
- **Blog Posts** → `featured-blog` (existing). Covers image/date/author/title, post count, view-all link. No new code.

Not covered by Dawn, so net-new sections:
- **Clan/Tartan Finder** — no equivalent exists.
- **Customer Testimonials** — no equivalent exists.
- **Press / "As Seen On"** — no equivalent exists.

## 1. New section: Clan/Tartan Finder (`sections/clan-finder.liquid`)

- Settings: `heading` (text), `description` (richtext).
- Blocks: `clan_link` (repeatable) — `title` (text), `link` (url). Rendered as a responsive grid of link tiles (CSS grid, 2 cols mobile / 3 tablet / 5 desktop).
- No live search input: there's no product/clan dataset to search against yet (would need a metafield-driven catalog that doesn't exist), so a search box would be decorative. A configurable link grid satisfies "grid links for Clan A, Clan B..." directly and stays YAGNI.
- Seed content on the homepage: reuse the same 5 categories already in the Phase 1 mega menu ("Clans A-L", "Clans M-Y", "Canada Province Tartan", "Ireland County Tartan A-K", "Ireland County Tartan L-W"), each linking to `/collections/all` (placeholder, consistent with Phase 1's link-target decision). This keeps the header and homepage information architecture consistent.

## 2. New section: Customer Testimonials (`sections/testimonials.liquid`)

- Settings: `heading` (text, default "What Our Customers Say"), `subheading` (text).
- Blocks: `testimonial` (repeatable) — `quote` (textarea), `author` (text), `rating` (range 1-5, default 5). Rendered as a card grid (1 col mobile, 3 cols desktop). Stars rendered from the `rating` value using a small inline SVG star repeated via a `for` loop (no new asset needed — reuse the pattern, not an icon font).
- Seed content: 3 example blocks with original, generic placeholder review text and placeholder first-name+initial author names (not tied to any real brand or reference-site content).

## 3. New section: Press / As Seen On (`sections/press-logos.liquid`)

- Settings: `heading` (text, default "As Seen On"), `subheading` (text, default "And over 400 news sites").
- Blocks: `press_logo` (repeatable) — `image` (image_picker, no default), `link` (url, optional). Rendered as a horizontal logo strip (flex-wrap, grayscale-on-hover-color treatment consistent with Dawn's muted secondary sections).
- No real outlet logos or names are included anywhere in code or seed data — every block ships with a blank image (falls back to a neutral placeholder box via `placeholder_svg_tag`, matching the pattern already used for the Phase 1 mega-menu promo tile) so the merchant supplies real, licensed logos later. This avoids any trademark/copyright risk from the constraint against copying reference-site assets.

## 4. Homepage assembly (`templates/index.json`)

Order: `image_banner` (existing, hero) → `clan_finder` (new) → `featured_collection` (existing) → `category_grid_apparel` → `category_grid_hoodies` → `category_grid_dresses` → `category_grid_decor` → `category_grid_accessories` (five `multicolumn` instances, existing section type) → `testimonials` (new) → `featured_blog` (existing) → `press_logos` (new).

Category grid content (each card: title + link to `/collections/all`, blank image placeholder for the merchant to fill in):
- **Apparel & Clothing:** Tartan T-Shirt, Tartan Polo Shirt, Women's Polo Shirt, Tartan Sweatshirt, Tartan Long Sleeve Button Shirts, Tartan Women's Casual Shirt, Tartan Hawaiian Shirt
- **Hoodies & Jackets:** Casual Hoodie, Sherpa Hoodie, Tartan Bomber Jacket, Tartan Padded Jacket, Borg Fleece Hoodie, Knitted Hoodie, Baseball Jacket, Sleeveless Puffer Jacket
- **Dresses & Skirts:** Sleeveless Midi Dresses, Women's Casual Dresses, Off Shoulder Long Dress, Off Shoulder Lady Dress, Tartan Hoodie Dress, Full Length Skirt, Pleated Midi Skirt
- **Home Decor:** Premium Quilts, Tartan Bedding Set, Tartan Blanket, Tartan Pillow Cover, Door Mat Collection, Tartan Tablecloth, Tartan Flags, Christmas Tree Skirt
- **Accessories:** Tartan Classic Cap, Tartan Beanies, Canvas Bag, Leather Bag, Leather Tote Bags, Tartan Saddle Bag, Tartan Umbrellas

## 5. Out of scope for this phase
- Wishlist icon / quick-add styling on product cards (Phase 3 — shared card component).
- Any live search or metafield-driven clan/product catalog.
- Real press logos/press mentions (merchant-supplied later).

## 6. QA / acceptance criteria
- [ ] Homepage renders all 11 sections in order, each editable from the theme customizer
- [ ] Clan Finder grid links resolve, responsive at 2/3/5 columns
- [ ] Testimonials show correct star count per block's rating setting
- [ ] Press logos show placeholder boxes when no image is set, real image when one is added
- [ ] Five category grids show their correct card lists, responsive (Dawn's existing multicolumn grid classes)
- [ ] `shopify theme check` passes with no new offenses vs. the Phase 1 baseline
