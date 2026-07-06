# Header & Mega Menu — Design

**Date:** 2026-07-07
**Status:** Approved
**Phase:** 1 of 4 (tartan-shop theme rebuild). Later phases: homepage sections, collection/product/blog template tweaks, footer & theme settings.

## Context

The repo is a stock Shopify Dawn 15.5.0 theme (scaffolded 2026-07-06). The goal for this phase is to stand up the site's primary navigation — mega menu, mobile drawer, header icons — modeled on the structure of a tartan/clothing ecommerce reference site (clan/tartan finder nav, Men/Women category menus, home decor/footwear/accessories/blog). No copyrighted text, images, logos, or code from any reference site are used; all content below is original/placeholder.

Dawn already ships a complete, working implementation of:
- 3-level mega menu (`sections/header.liquid` + `snippets/header-mega-menu.liquid`), driven entirely by a Shopify Navigation menu (linklist) — CSS grid auto-flows up to 6 columns
- Mobile hamburger + drawer (`snippets/header-drawer.liquid`) with matching nested submenu depth
- Sticky header, search, account/login, cart icon with count bubble
- All Theme Check clean, no known bugs

So this phase is **not** a rebuild of header infrastructure. It is:
1. Populating the Navigation menu with the tartan-shop content tree
2. A small, additive enhancement to let merchants attach an optional visual promo tile to a mega menu column

## 1. Navigation menu tree

Menu handle: `main-menu` (Dawn's default, already referenced by `sections/header.liquid`'s `menu` setting).

```
main-menu
├── Find Your Clans                          (mega menu — 5 columns)
│   ├── Clans A-L                 → /collections/all
│   ├── Clans M-Y                 → /collections/all
│   ├── Canada Province Tartan    → /collections/all
│   ├── Ireland County Tartan A-K → /collections/all
│   └── Ireland County Tartan L-W → /collections/all
├── For Men                                  (mega menu — 5 columns)
│   ├── Shirts & Tops             → /collections/all
│   ├── Outerwear & Jacket        → /collections/all
│   ├── Pants                     → /collections/all
│   ├── Clothing Accessories      → /collections/all
│   └── Sleepwear                 → /collections/all
├── For Women                                (mega menu — 8 columns, wraps to 2 rows at 6/row)
│   ├── Shirts & Tops             → /collections/all
│   ├── Outerwear & Jacket        → /collections/all
│   ├── Bottoms                   → /collections/all
│   ├── Dresses                   → /collections/all
│   ├── Handbags                  → /collections/all
│   ├── Clothing Accessories      → /collections/all
│   ├── Sleepwear                 → /collections/all
│   └── Swimwear                  → /collections/all
├── New Arrivals        → /collections/all
├── Home Decor          → /collections/all
├── Footwears           → /collections/all
├── Blog                → /blogs/news
├── Tartan Club         → /pages/tartan-club
├── About Us            → /pages/about-us
└── Contact Us          → /pages/contact-us
```

Notes:
- All product-category leaves point to `/collections/all` as an explicit placeholder. Once real collections exist, re-pointing these is an Admin → Navigation edit, not a code change.
- `Blog` points to the store's default `news` blog (created automatically by Shopify on every store).
- `Tartan Club`, `About Us`, `Contact Us` point to pages the setup script creates (see below). `Contact Us` uses Dawn's existing `page.contact.json` template (already in the theme) by naming the page's template suffix `contact`.
- "Find Your Clans" and "For Men"/"For Women" get Dawn's built-in mega-menu treatment automatically because they have child links (`link.links != blank`) — no template change needed to make these dropdowns.

## 2. Setup script

**File:** `scripts/setup-navigation.mjs`

- Plain Node script, zero npm dependencies (Node 23's built-in `fetch`), run manually with `node scripts/setup-navigation.mjs`.
- Reads config from `.env` (new file, gitignored): `SHOPIFY_STORE_DOMAIN` (e.g. `nongsanhaiduong.myshopify.com`) and `SHOPIFY_ADMIN_TOKEN`.
- Steps:
  1. `GET` the existing menu via GraphQL `menu(handle: "main-menu")` to obtain its `id`.
  2. Call `menuUpdate` with the full `items` tree above (title + `RELATIVE`/`HTTP` url resource types as plain URLs since target collections/pages are placeholders).
  3. For each of the 3 pages, query `pages(query: "handle:...")`; if absent, `pageCreate` with a short original placeholder body and, for Contact Us, `templateSuffix: "contact"`.
  4. Logs a summary of what was created/updated. Safe to re-run (idempotent — updates in place, doesn't duplicate).
- Required Admin API scopes on the custom app you create in the dev store: `write_online_store_navigation`, `write_content`.
- The design doc's implementation plan will include the exact step-by-step for generating that token in the `nongsanhaiduong` dev store admin (Settings → Apps → Develop apps).
- `.env` and `scripts/*.local.*` (if any) are added to `.gitignore`. The token itself is never committed.

## 3. Mega menu promo tile

**Goal:** give merchants an optional visual anchor inside a mega menu flyout (e.g., a "Find Your Tartan" tile inside "Find Your Clans"), without touching how Navigation drives the link columns.

**Files changed:**
- `sections/header.liquid` — add a new block type to the schema
- `snippets/header-mega-menu.liquid` — render matching blocks alongside the link grid

**Schema addition (`sections/header.liquid`):**
```json
{
  "type": "mega_menu_promotion",
  "name": "Mega menu promotion",
  "settings": [
    { "type": "text", "id": "menu_item_title", "label": "Attach to top-level menu title", "info": "Must exactly match a top-level menu item's title, e.g. \"Find Your Clans\". Desktop mega menu only." },
    { "type": "image_picker", "id": "image", "label": "Image" },
    { "type": "text", "id": "heading", "label": "Heading", "default": "Find Your Tartan" },
    { "type": "url", "id": "link", "label": "Link" },
    { "type": "text", "id": "link_label", "label": "Link label", "default": "Shop now" }
  ]
}
```
- `max_blocks` raised from 3 to accommodate `@app` blocks + a reasonable number of promo tiles (e.g. 8).
- Labels are plain English strings, not `t:` locale keys — this is a bespoke single-market theme, not a distributable/multi-locale Dawn fork, so skipping the 20+ locale file edits is the right tradeoff here.

**Rendering (`snippets/header-mega-menu.liquid`):**
- Wrap the existing `mega-menu__list` and a new `mega-menu__promotions` container in a flex row.
- Before rendering each top-level `<details class="mega-menu">`, collect `section.blocks` where `block.type == 'mega_menu_promotion'` and `block.settings.menu_item_title == link.title`.
- If any match, render them as fixed-width tiles (image, heading, CTA link) to the right of the link columns.
- If no promo blocks match a given top-level item, the flyout renders exactly as stock Dawn does today (no layout regression).
- Promo tiles are desktop-only; `header-drawer.liquid` is untouched.

**Default seed data:** one `mega_menu_promotion` block in `config/settings_data.json` (or documented for manual add in theme customizer) targeting "Find Your Clans", heading "Find Your Tartan", link `/collections/all`, so the feature is visible without extra setup.

**CSS:** small addition to the existing `{% style %}`/component CSS for `.mega-menu__promotions` / `.mega-menu__promotion-tile` (flex basis, image aspect ratio, spacing) — no new stylesheet file needed, kept inline or added to `assets/component-mega-menu.css`.

## 4. Out of scope for this phase
- Real product/collection content behind the placeholder links (later phases / merchant task)
- Homepage Clan/Tartan Finder section, category grids, testimonials, etc. (Phase 2)
- Footer link structure (Phase 4)
- Any visual restyling of the header beyond the promo tile (color scheme, fonts use existing theme settings)

## 5. QA / acceptance criteria
- [ ] `main-menu` in Admin → Navigation matches the tree above exactly
- [ ] About Us, Contact Us, Tartan Club pages exist and are reachable
- [ ] Desktop: "Find Your Clans" and "For Men"/"For Women" open as mega menu flyouts with correct columns
- [ ] "Find Your Clans" flyout shows the promo tile; other flyouts render unchanged
- [ ] Mobile (< 990px): hamburger opens drawer; nested categories drill in/out; no promo tile shown
- [ ] Sticky header, search modal, account link, cart bubble all still function
- [ ] `shopify theme check` passes with no new offenses
- [ ] Re-running `scripts/setup-navigation.mjs` is a no-op (idempotent) on second run
