# Demo Catalog Seeding (Products & Collections) — Design

**Date:** 2026-07-14
**Status:** Approved
**Phase:** Post-rebuild content phase (all 4 theme code phases merged as of 2026-07-07). This phase makes the store browsable end-to-end by replacing every `/collections/all` placeholder link with a real, populated collection.

## Context

The theme rebuild is complete, but the dev store (`nongsanhaiduong.myshopify.com`) has no catalog: every category/clan link in the header mega menu, footer, and homepage points at the `/collections/all` placeholder, which itself is empty. This phase seeds a demo catalog via the Admin GraphQL API (same pattern as `scripts/setup-navigation.mjs` and `scripts/setup-footer-navigation.mjs`), then re-points all placeholder links at the real collections.

Decisions made during brainstorming:
- **Scale:** ~40 products (2–3 per category/clan group).
- **Images:** procedurally generated tartan-plaid PNGs — on-theme, deterministic, zero external dependencies.
- **Collection membership:** smart collections with tag rules (future products join by tag).
- **Variants:** S/M/L/XL sizes on apparel at a single price; decor/footwear/handbags single-variant.
- **Approach:** one zero-dependency seed script; no `package.json`/`node_modules` introduced into the theme repo.

## 1. Catalog data model

**~24 smart collections**, one per placeholder link. Each has a single rule: product tag equals the collection handle.

| Group | Handles |
|---|---|
| Clans (5) | `clans-a-l`, `clans-m-y`, `canada-province-tartan`, `ireland-county-tartan-a-k`, `ireland-county-tartan-l-w` |
| Men (5) | `men-shirts-tops`, `men-outerwear-jackets`, `men-pants`, `men-accessories`, `men-sleepwear` |
| Women (8) | `women-shirts-tops`, `women-outerwear-jackets`, `women-bottoms`, `women-dresses`, `women-handbags`, `women-accessories`, `women-sleepwear`, `women-swimwear` |
| Other (6) | `new-arrivals`, `home-decor`, `footwear`, `tartan-flat-caps`, `tartan-polos`, `tartan-tees` |

**~40 products** defined as a static table in the script: title, handle, description (2–3 original sentences), product type, price, tags, sizes flag. Tags do the heavy lifting — each product carries multiple tags so it appears in several collections at once (e.g. "MacLeod Tartan Flannel Shirt" → tags `clans-m-y`, `men-shirts-tops`, `new-arrivals`). 40 multi-tagged products fill 24 collections with 2–4 items each; **every collection must end up with at least 2 products**. Roughly a third of products also carry `new-arrivals`.

- Apparel: option "Size" with S/M/L/XL variants, all at the product's single price.
- Home decor, footwear, handbags, flat caps: single default variant.
- Prices: plausible USD values in the $20–$180 range, varied per product type.
- Product names/descriptions are original (tartan/clan-inspired), not copied from any reference site. Clan names themselves (MacLeod, Fraser, etc.) are historical/public.

## 2. Image generation (zero-dep)

Each product gets one 800×800 tartan-plaid PNG:
- A classic tartan sett — a symmetric sequence of colored thread bands rendered in both warp and weft with twill-style blending where bands cross — computed per-pixel in plain JS.
- PNG encoding by hand: IHDR/IDAT/IEND chunks, `zlib.deflateSync` for IDAT, hand-rolled CRC32. (~80 lines, no npm packages.)
- Each clan/category group has a fixed color palette defined in the script; a product's palette is chosen deterministically from its handle. Re-runs produce byte-identical images.
- PNGs are written to the session scratchpad (not the repo), uploaded via `stagedUploadsCreate` → HTTP upload → attached with `productCreateMedia`. Alt text = product title.

## 3. Seeding script

**File:** `scripts/seed-catalog.mjs` (new). Conventions match the two existing setup scripts:
- `node --env-file=.env scripts/seed-catalog.mjs [--dry-run]`
- Admin GraphQL API `2025-01`, `SHOPIFY_STORE_DOMAIN`/`SHOPIFY_ADMIN_TOKEN` from `.env`.
- Throws on any `userErrors`.

Flow:
1. **Collections:** for each of the 24, look up by handle; if absent, `collectionCreate` with `ruleSet` (column `TAG`, relation `EQUALS`, condition = handle) and publish to the Online Store publication.
2. **Products:** for each of the ~40, look up by handle; if present, skip (idempotent — safe to re-run after a partial failure). Otherwise create with options/variants/price/tags/status `ACTIVE` via `productSet` (one mutation covers options, variants, and prices on API `2025-01`), then upload + attach its generated image, then `publishablePublish` to the Online Store publication (API-created products are not necessarily visible on the storefront channel by default).
3. **Summary:** print created/skipped counts per resource type.

`--dry-run` prints the planned collection and product payloads without any mutation or upload.

## 4. Re-pointing placeholder links

1. `scripts/setup-navigation.mjs` — update the `menuTree` URL table: each clan/category item → `/collections/<matching-handle>`; "New Arrivals" → `/collections/new-arrivals`; "Home Decor" → `/collections/home-decor`; "Footwears" → `/collections/footwear`. The three top-level parents ("Find Your Clans"/"For Men"/"For Women") keep `/collections/all` — after seeding that is a legitimate, populated "shop all" page, and no "all clans"/"all men" collection exists. Re-run the script.
2. `scripts/setup-footer-navigation.mjs` — update the 7 Shop By Category URLs to the matching handles (`clans-a-l` for "Shop By Clan & Tartan", `men-shirts-tops` for "Men's Tartan Collection", `women-shirts-tops` for "Women's Tartan Collection", `tartan-flat-caps`, `tartan-polos`, `tartan-tees`, `home-decor`). Re-run the script.
3. `templates/index.json` — replace every `/collections/all` link: clan-finder tiles → the 5 clan collections, category-grid cards → matching category collections, `featured_collection.settings.collection` `"all"` → `"new-arrivals"`, banner buttons → `new-arrivals` / a category collection. Sync via `shopify theme dev`.

Script URL-table edits + `templates/index.json` are committed to git; store-side effects come from re-running the scripts.

## 5. Out of scope (YAGNI)

- Color/colorway variants, per-variant images.
- Inventory tracking, SKUs, weights, metafields, SEO fields.
- Blog content, product reviews, real photography, policy text, social URLs.
- Collection page template changes (stock Dawn already renders collections fully).

## 6. QA / acceptance criteria

- [ ] `--dry-run` prints the full planned payload without mutating the store.
- [ ] Live run completes with zero `userErrors`; re-run reports all resources skipped (idempotency).
- [ ] Every one of the 24 collections has ≥2 products (verify via Admin API query, not by eye).
- [ ] Products are visible on the storefront (Online Store channel), each with a tartan image and correct price; apparel shows the S/M/L/XL picker on the product page.
- [ ] Live `shopify theme dev` + Playwright QA with **real pointer clicks** (per the Phase 3 process note): mega-menu links land on non-empty collections; footer category links land on non-empty collections; homepage clan-finder tiles, category cards, and featured collection all resolve to populated pages; no link on header/footer/homepage still points at `/collections/all` except the three top-level mega-menu parents (intentional).
