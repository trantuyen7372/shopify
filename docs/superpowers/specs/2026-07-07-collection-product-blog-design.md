# Collection/Product/Blog Template Tweaks — Design

**Date:** 2026-07-07
**Status:** Approved (autonomous — user directed proceeding through all remaining phases without per-question review)
**Phase:** 3 of 4 (tartan-shop theme rebuild). Phases 1-2 (header/mega menu, homepage) are merged. Later phase: footer & theme settings.

## Context

The original scope for this phase: collection page (grid, filters, sort, pagination), product page (media gallery, variant picker, buy buttons, collapsible tabs for description/shipping/returns/size guide, related products, trust badges), and blog/article pages (listing, article cards, social sharing, related articles).

Dawn already ships a complete, configured implementation of nearly all of this:
- **Collection page** (`templates/collection.json` + `sections/main-collection-product-grid.liquid` + `snippets/facets.liquid`): filtering (`enable_filtering: true`), sorting (`enable_sorting: true`), pagination, responsive grid, collection banner with description — all already enabled. **No gap, no changes needed.**
- **Product page** (`sections/main-product.liquid`): media gallery, variant picker, quantity selector, buy buttons (with dynamic checkout "Buy now"), description, social share — all present in `templates/product.json`. Two requirements are *supported by Dawn's own block types but not yet configured*:
  - Collapsible tabs (Shipping/Returns/Size Guide) → Dawn's `collapsible_tab` block type (heading + icon + richtext content), just needs block instances added to `templates/product.json`. No new code.
  - Trust badges / payment icons → Dawn's `icon-with-text` block type (up to 3 icon+heading pairings, icon set includes `truck`, `lock`, `return`) is built for exactly this. Just needs one block instance added. No new code.
- **Blog listing + article page**: `templates/blog.json`/`sections/main-blog.liquid` (listing grid) and `templates/article.json`/`sections/main-article.liquid` (title, date, content, featured image, social sharing via `share-button.liquid`) are all present and configured. **One real gap:** there is no "related articles" section anywhere in Dawn.

Not covered by Dawn, so net-new work:
- **Related articles** section for the article page.
- **Wishlist placeholder icon** on product cards — explicitly requested in the original scope, deliberately deferred from Phase 2 because it touches `snippets/card-product.liquid`, the single shared card component used on the homepage, collection grid, related-products, and search results. Building it once here fixes it everywhere.

## 1. Product page: trust badges + collapsible tabs (config only)

**File:** `templates/product.json` (modify)

Add block instances to the existing `main` section, no Liquid changes:
- One `icon-with-text` block: `truck` / "Free Shipping", `lock` / "Secure Checkout", `return` / "Easy Returns" (horizontal layout), placed after `buy_buttons`.
- Three `collapsible_tab` blocks after the existing `description` block: "Shipping" (icon: `truck`), "Returns" (icon: `return`), "Size Guide" (icon: `ruler`) — each with original placeholder richtext content the merchant will replace with real policy text.

The existing `description` block stays as the main expanded product description; the collapsible tabs are supplementary, matching how most Shopify product pages separate "what it is" from "practical details."

## 2. Related articles section

**File:** `sections/related-articles.liquid` (new), `templates/article.json` (modify)

- Settings: `heading` (default "Read more"), `heading_size`, `articles_to_show` (range 2-4, default 3), `columns_desktop`, `color_scheme`, padding.
- `enabled_on: { "templates": ["article"] }` (same restriction pattern Dawn itself uses for template-specific sections, e.g. `bulk-quick-order-list.liquid`).
- Markup: iterate `blog.articles`, skip the current `article`, cap at `articles_to_show`, render each via the existing `snippets/article-card.liquid` (already built for exactly this — takes `blog`/`article` and optional show flags). Reuses `assets/component-article-card.css`, no new stylesheet.
- Added to `templates/article.json`'s `order` after the existing `main` section.

## 3. Wishlist placeholder icon on product cards

**Files:** `snippets/card-product.liquid` (modify), `assets/component-card.css` (modify)

- A heart-icon `<button>` (using the existing `icon-heart.svg` asset, already shipped in this theme) is added as the first child inside the existing `.card__media` div — which is already `position: absolute` in Dawn's CSS, so it's a valid positioning context for an absolutely-positioned child without touching any existing rule.
- New CSS (additive only, no existing rules modified): `.card__wishlist-button` positioned `top: 1rem; right: 1rem;` with a circular background, and `.card__wishlist-button[aria-pressed="true"]` fills the heart color in.
- Behavior: a small reusable custom element (`<wishlist-button>`, defined once via an inline `{% javascript %}` tag — Shopify's `{% javascript %}` tag deduplicates automatically no matter how many times the snippet renders per page, so this is safe to include in a snippet rendered dozens of times) toggles `aria-pressed` on click and persists the on/off state in `localStorage` keyed by product ID, so it "sticks" across page loads within a browser.
- Explicitly **not** wired to any cart, account, or app — it's a decorative placeholder for a future wishlist app/feature, matching the original request's literal wording ("wishlist placeholder"). No new page, no new route, no backend.
- Because this lives in the shared `card-product.liquid` snippet, it automatically appears everywhere product cards render: homepage featured collection, category-adjacent product grids, collection page grid, related products, search results — with zero duplicate work.

## 4. Out of scope for this phase
- Real wishlist persistence/account integration (would require a Shopify app or metafield-backed customer wishlist — out of scope for a placeholder).
- Collection page changes (already fully featured by stock Dawn config).
- Real shipping/returns/size-guide policy copy (merchant-supplied later; seed content is original placeholder text).

## 5. QA / acceptance criteria
- [ ] Product page shows: trust badge row (3 icon+text pairings) near the buy buttons, and 3 collapsible tabs (Shipping, Returns, Size Guide) below the description, each expandable
- [ ] Article page shows a "Read more" grid of up to 3 other articles from the same blog, excluding the current one (and renders nothing extra if the blog has no other articles)
- [ ] Every product card (homepage, collection grid, related products) shows a heart-icon button in the top-right of its image; clicking toggles filled/unfilled state and persists across a page reload
- [ ] `shopify theme check` passes with no new offense types vs. the Phase 2 baseline (172 files, 56 offenses)
- [ ] Collection page unchanged and still fully functional (filters, sort, pagination) — regression check only, no new work
