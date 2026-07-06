# Footer & Theme Settings — Design

**Date:** 2026-07-07
**Status:** Approved (autonomous — user directed proceeding through all remaining phases without per-question review)
**Phase:** 4 of 4 (final phase — tartan-shop theme rebuild).

## Context

Original scope: a multi-column footer (Shop By Category, Information, Customer Care, Connect Us, payment icons, copyright) and global theme settings (logo, colors, buttons, typography, social links, footer contact info, payment icon visibility, product card style, sticky header toggle).

As with every prior phase, Dawn already implements almost all of this:
- **Theme settings**: `config/settings_schema.json` already has dedicated sections for Logo, Colors, Typography, Buttons, Cards (product card style), Social media, and (from Phase 1) sticky header. **Zero new settings needed** — these exist and are already customizer-editable; this phase does not touch `settings_schema.json`.
- **Information column** (Shipping/Privacy/Terms/Refund policy links): Dawn's footer already renders these automatically via `section.settings.show_policy` (already `true`) — Shopify auto-populates whatever legal policies the merchant fills in under Settings → Policies. No menu, no code.
- **Payment icons row** and **copyright row**: already rendered automatically via `section.settings.payment_enable` (already `true`) and Dawn's built-in copyright block. No code.
- **Connect Us** (social icons): Dawn's `brand_information` footer block already shows social icons driven by the global `settings.social_*_link` values (present, currently blank — correctly left blank, no fake accounts).

What's missing, so net-new for this phase:
- **Shop By Category** and **Customer Care** footer link columns — Dawn's `link_list` footer block type exists and takes a Navigation menu, but `sections/footer-group.json` currently has zero blocks configured. Two new footer navigation menus need to be created (same mechanism as Phase 1's header menu) and wired in.
- **Connect Us contact info** (address/email placeholder) — Dawn's `text` footer block (heading + richtext subtext) covers this; just needs a block instance.
- Two new placeholder pages: FAQs and Order Tracking (About Us/Contact Us/Blog already exist from Phase 1).

## 1. Footer navigation menus (script)

**File:** `scripts/setup-footer-navigation.mjs` (new, standalone — mirrors Phase 1's `setup-navigation.mjs` pattern but not imported from it, since that script runs its `main()` at import time; a second small self-contained script is simpler than extracting a shared library for two one-off ops scripts).

Creates two menus via the Admin GraphQL API (idempotent — same `menuCreate`-if-absent pattern) and two pages:

```
footer-shop-by-category
├── Shop By Clan & Tartan   → /collections/all
├── Men's Tartan Collection → /collections/all
├── Women's Tartan Collection → /collections/all
├── Tartan Flat Cap         → /collections/all
├── Tartan Polos            → /collections/all
├── Tartan Tees             → /collections/all
└── Home Decor              → /collections/all

footer-customer-care
├── FAQs           → /pages/faqs (page created by this script)
├── Blog           → /blogs/news
├── About Us       → /pages/about-us (exists from Phase 1)
├── Contact Us     → /pages/contact-us (exists from Phase 1)
└── Order Tracking → /pages/order-tracking (page created by this script)
```

Unlike Phase 1's `main-menu` (which already exists by default and only needed `menuUpdate`), these two menus don't exist yet, so the script uses `menuCreate` (falling back to `menuUpdate` if a re-run finds them already created — same idempotency guarantee as Phase 1).

## 2. Footer content assembly

**File:** `sections/footer-group.json` (modify)

Add four blocks to the footer section:
- `shop_by_category`: `link_list` block, heading "Shop By Category", menu → `footer-shop-by-category`
- `customer_care`: `link_list` block, heading "Customer Care", menu → `footer-customer-care`
- `connect_us`: `text` block, heading "Connect With Us", subtext with placeholder address + email (original placeholder text, not a real address)
- `brand`: `brand_information` block, `show_social: true` (surfaces whatever social links are set in theme settings — currently blank, which is correct)

## 3. Out of scope for this phase
- Populating real social media URLs, a real address, or real policy text — all merchant-supplied later, consistent with every prior phase's placeholder convention.
- Any change to `config/settings_schema.json` — nothing is missing there.
- Any change to the header (Phase 1) or homepage (Phase 2) — this phase touches only the footer.

## 4. QA / acceptance criteria
- [ ] Footer shows 4 columns: newsletter signup (existing Dawn default) is unaffected; Shop By Category (7 links); Customer Care (5 links); Connect Us (placeholder address/email + social icons, hidden gracefully if no social links are set)
- [ ] Policy links (Information) and payment icons still render (regression check — Phase 1-3 didn't touch these, this phase adds blocks alongside them)
- [ ] `shopify theme dev` live sync succeeds with no upload errors (semantic schema check, per the lesson from Phase 2)
- [ ] `shopify theme check` passes with no new offense types vs. the Phase 3 baseline (173 files, 57 offenses)
- [ ] Footer navigation script is idempotent (safe to re-run), verified same as Phase 1
