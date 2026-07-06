# Collection/Product/Blog Template Tweaks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill the three real gaps between Dawn's stock product/blog templates and the original scope — trust badges + Shipping/Returns/Size Guide tabs on the product page, a related-articles section on the article page, and a wishlist placeholder icon on every product card — without touching the collection page, which Dawn already fully satisfies.

**Architecture:** Two of the three deliverables are pure JSON configuration using Dawn's existing `icon-with-text` and `collapsible_tab` block types on `sections/main-product.liquid` (zero new Liquid). The third is a new, template-restricted section (`related-articles`) that reuses the existing `article-card` snippet. The fourth is a small, additive change to the single shared `snippets/card-product.liquid` (a heart-icon toggle, one insertion point that covers every render path) plus new CSS and a self-contained custom element script.

**Tech Stack:** Shopify Dawn theme (Liquid, JSON templates/sections), vanilla CSS, vanilla JS via Shopify's `{% javascript %}` tag (auto-deduplicated across repeated snippet renders), `localStorage` for wishlist state.

## Global Constraints

- No copyrighted assets, images, logos, exact brand name, exact text, or proprietary code from any reference site — all seed copy (trust badge labels, tab content, etc.) is original placeholder.
- Theme code must pass `shopify theme check` with no new offense types vs. the Phase 2 baseline (172 files, 56 offenses, all pre-existing environmental `ValidSchema`).
- Do not add real wishlist backend/account/app integration — this is an explicitly-scoped decorative placeholder (localStorage only).
- New schema labels use plain English strings, not `t:` locale keys (same approved tradeoff as Phases 1-2).
- Do not modify `templates/collection.json` or collection-page sections — no gap exists there.
- The wishlist button must not require modifying `assets/icon-heart.svg` or any other existing Dawn asset file — toggle via CSS only.

---

### Task 1: Product page trust badges and collapsible tabs

**Files:**
- Modify: `templates/product.json`

**Interfaces:**
- Consumes: Dawn's existing `icon-with-text` and `collapsible_tab` block types on the `main-product` section (no code changes — schema already exists in `sections/main-product.liquid`).

- [ ] **Step 1: Add the trust-badges and collapsible-tab blocks**

In `templates/product.json`, find the `main` section's `blocks` object and `block_order` array:

```json
      "blocks": {
        "vendor": {
          "type": "text",
          "settings": {
            "text": "{{ product.vendor }}",
            "text_style": "uppercase"
          }
        },
        "title": {
          "type": "title"
        },
        "price": {
          "type": "price"
        },
        "variant_picker": {
          "type": "variant_picker",
          "settings": {
            "picker_type": "button",
            "swatch_shape": "circle"
          }
        },
        "quantity_selector": {
          "type": "quantity_selector"
        },
        "buy_buttons": {
          "type": "buy_buttons",
          "settings": {
            "show_dynamic_checkout": true,
            "show_gift_card_recipient": true
          }
        },
        "description": {
          "type": "description"
        },
        "share": {
          "type": "share",
          "settings": {
            "share_label": "Share"
          }
        }
      },
      "block_order": [
        "vendor",
        "title",
        "price",
        "variant_picker",
        "quantity_selector",
        "buy_buttons",
        "description",
        "share"
      ],
```

Replace with:

```json
      "blocks": {
        "vendor": {
          "type": "text",
          "settings": {
            "text": "{{ product.vendor }}",
            "text_style": "uppercase"
          }
        },
        "title": {
          "type": "title"
        },
        "price": {
          "type": "price"
        },
        "variant_picker": {
          "type": "variant_picker",
          "settings": {
            "picker_type": "button",
            "swatch_shape": "circle"
          }
        },
        "quantity_selector": {
          "type": "quantity_selector"
        },
        "buy_buttons": {
          "type": "buy_buttons",
          "settings": {
            "show_dynamic_checkout": true,
            "show_gift_card_recipient": true
          }
        },
        "trust_badges": {
          "type": "icon-with-text",
          "settings": {
            "layout": "horizontal",
            "icon_1": "truck",
            "heading_1": "Free Shipping",
            "icon_2": "lock",
            "heading_2": "Secure Checkout",
            "icon_3": "return",
            "heading_3": "Easy Returns"
          }
        },
        "description": {
          "type": "description"
        },
        "tab_shipping": {
          "type": "collapsible_tab",
          "settings": {
            "heading": "Shipping",
            "icon": "truck",
            "content": "<p>Orders ship within 2 business days. Replace this placeholder with your real shipping policy.</p>"
          }
        },
        "tab_returns": {
          "type": "collapsible_tab",
          "settings": {
            "heading": "Returns",
            "icon": "return",
            "content": "<p>Returns are accepted within 30 days of delivery. Replace this placeholder with your real returns policy.</p>"
          }
        },
        "tab_size_guide": {
          "type": "collapsible_tab",
          "settings": {
            "heading": "Size Guide",
            "icon": "ruler",
            "content": "<p>Replace this placeholder with your size chart.</p>"
          }
        },
        "share": {
          "type": "share",
          "settings": {
            "share_label": "Share"
          }
        }
      },
      "block_order": [
        "vendor",
        "title",
        "price",
        "variant_picker",
        "quantity_selector",
        "buy_buttons",
        "trust_badges",
        "description",
        "tab_shipping",
        "tab_returns",
        "tab_size_guide",
        "share"
      ],
```

- [ ] **Step 2: Validate JSON**

Run: `python3 -c "import json; json.load(open('templates/product.json')); print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add templates/product.json
git commit -m "feat: add trust badges and shipping/returns/size-guide tabs to product page"
```

---

### Task 2: Related articles section

**Files:**
- Create: `sections/related-articles.liquid`
- Modify: `templates/article.json`

**Interfaces:**
- Consumes: existing `snippets/article-card.liquid` (accepts `blog`, `article`, `show_image`, `show_date` params — already built, no changes).
- Produces: section type `related-articles`, consumed by Task 2's own `templates/article.json` change (self-contained task).

- [ ] **Step 1: Write `sections/related-articles.liquid`**

```liquid
{{ 'component-article-card.css' | asset_url | stylesheet_tag }}

{%- style -%}
  .section-{{ section.id }}-padding {
    padding-top: {{ section.settings.padding_top | times: 0.75 | round: 0 }}px;
    padding-bottom: {{ section.settings.padding_bottom | times: 0.75 | round: 0 }}px;
  }

  @media screen and (min-width: 750px) {
    .section-{{ section.id }}-padding {
      padding-top: {{ section.settings.padding_top }}px;
      padding-bottom: {{ section.settings.padding_bottom }}px;
    }
  }
{%- endstyle -%}

{%- liquid
  assign related_count = 0
-%}

<div class="color-{{ section.settings.color_scheme }} gradient">
  <div class="page-width section-{{ section.id }}-padding">
    {%- if section.settings.heading != blank -%}
      <h2 class="title {{ section.settings.heading_size }}">{{ section.settings.heading | escape }}</h2>
    {%- endif -%}
    <ul
      class="grid grid--{{ section.settings.columns_desktop }}-col-desktop grid--2-col-tablet-down"
      role="list"
    >
      {%- for related_article in blog.articles -%}
        {%- unless related_article.id == article.id -%}
          {%- if related_count < section.settings.articles_to_show -%}
            <li class="grid__item">
              {% render 'article-card', blog: blog, article: related_article, show_image: true, show_date: true %}
            </li>
            {%- assign related_count = related_count | plus: 1 -%}
          {%- endif -%}
        {%- endunless -%}
      {%- endfor -%}
    </ul>
  </div>
</div>

{% schema %}
{
  "name": "Related articles",
  "class": "section",
  "tag": "section",
  "enabled_on": {
    "templates": ["article"]
  },
  "settings": [
    {
      "type": "text",
      "id": "heading",
      "label": "Heading",
      "default": "Read more"
    },
    {
      "type": "select",
      "id": "heading_size",
      "options": [
        { "value": "h2", "label": "Medium" },
        { "value": "h1", "label": "Large" }
      ],
      "default": "h2",
      "label": "Heading size"
    },
    {
      "type": "range",
      "id": "articles_to_show",
      "min": 2,
      "max": 4,
      "step": 1,
      "default": 3,
      "label": "Articles to show"
    },
    {
      "type": "range",
      "id": "columns_desktop",
      "min": 2,
      "max": 4,
      "step": 1,
      "default": 3,
      "label": "Columns on desktop"
    },
    {
      "type": "color_scheme",
      "id": "color_scheme",
      "label": "Color scheme",
      "default": "scheme-1"
    },
    {
      "type": "header",
      "content": "Padding"
    },
    {
      "type": "range",
      "id": "padding_top",
      "min": 0,
      "max": 100,
      "step": 4,
      "unit": "px",
      "label": "Top padding",
      "default": 36
    },
    {
      "type": "range",
      "id": "padding_bottom",
      "min": 0,
      "max": 100,
      "step": 4,
      "unit": "px",
      "label": "Bottom padding",
      "default": 36
    }
  ]
}
{% endschema %}
```

- [ ] **Step 2: Validate the schema JSON parses**

Run: `python3 -c "import re,json; s=open('sections/related-articles.liquid').read(); m=re.search(r'{% schema %}(.*){% endschema %}', s, re.S); json.loads(m.group(1)); print('OK')"`
Expected: `OK`

- [ ] **Step 3: Add the section to `templates/article.json`**

Replace the entire contents of `templates/article.json` with:

```json
{
  "sections": {
    "main": {
      "type": "main-article",
      "blocks": {
        "featured_image": {
          "type": "featured_image",
          "settings": {
            "image_height": "adapt"
          }
        },
        "title": {
          "type": "title",
          "settings": {
            "blog_show_date": true,
            "blog_show_author": false
          }
        },
        "share": {
          "type": "share",
          "settings": {
            "share_label": "Share"
          }
        },
        "content": {
          "type": "content"
        }
      },
      "block_order": [
        "featured_image",
        "title",
        "share",
        "content"
      ]
    },
    "related_articles": {
      "type": "related-articles",
      "settings": {
        "heading": "Read more",
        "heading_size": "h2",
        "articles_to_show": 3,
        "columns_desktop": 3,
        "color_scheme": "scheme-1",
        "padding_top": 36,
        "padding_bottom": 36
      }
    }
  },
  "order": [
    "main",
    "related_articles"
  ]
}
```

- [ ] **Step 4: Validate JSON**

Run: `python3 -c "import json; json.load(open('templates/article.json')); print('OK')"`
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add sections/related-articles.liquid templates/article.json
git commit -m "feat: add related articles section to article page"
```

---

### Task 3: Wishlist placeholder icon on product cards

**Files:**
- Modify: `snippets/card-product.liquid`
- Modify: `assets/component-card.css`

**Interfaces:**
- Produces: custom element `<wishlist-button>` (reads `data-product-id`, toggles `aria-pressed` on its inner `<button>`, persists to `localStorage` key `"wishlist"` as a JSON array of product ID strings). No other file consumes this — it's fully self-contained within `card-product.liquid`.

- [ ] **Step 1: Insert the wishlist button markup**

In `snippets/card-product.liquid`, find:

```liquid
        <div
          class="card__inner {% if settings.card_style == 'standard' %}color-{{ settings.card_color_scheme }} gradient{% endif %}{% if card_product.featured_media or settings.card_style == 'standard' %} ratio{% endif %}"
          style="--ratio-percent: {{ 1 | divided_by: ratio | times: 100 }}%;"
        >
          {%- if card_product.featured_media -%}
```

Replace with:

```liquid
        <div
          class="card__inner {% if settings.card_style == 'standard' %}color-{{ settings.card_color_scheme }} gradient{% endif %}{% if card_product.featured_media or settings.card_style == 'standard' %} ratio{% endif %}"
          style="--ratio-percent: {{ 1 | divided_by: ratio | times: 100 }}%;"
        >
          <wishlist-button class="card__wishlist-button" data-product-id="{{ card_product.id }}">
            <button type="button" aria-pressed="false" aria-label="Add to wishlist">
              <span class="svg-wrapper">{{ 'icon-heart.svg' | inline_asset_content }}</span>
            </button>
          </wishlist-button>
          {%- if card_product.featured_media -%}
```

- [ ] **Step 2: Add the custom element script**

At the very end of `snippets/card-product.liquid`, find the file's last line:

```liquid
{%- endif -%}
```

(this is the closing tag of the top-level `{%- if card_product and card_product != empty -%}` block opened near the top of the file — it should be the very last line, with nothing after it). Append immediately after it:

```liquid
{% javascript %}
  class WishlistButton extends HTMLElement {
    constructor() {
      super();
      this.button = this.querySelector('button');
      this.productId = this.dataset.productId;
      this.storageKey = 'wishlist';
    }

    connectedCallback() {
      this.updateState(this.isWishlisted());
      this.button.addEventListener('click', this.toggle.bind(this));
    }

    getWishlist() {
      try {
        return JSON.parse(localStorage.getItem(this.storageKey)) || [];
      } catch (error) {
        return [];
      }
    }

    isWishlisted() {
      return this.getWishlist().includes(this.productId);
    }

    toggle() {
      const wishlist = this.getWishlist();
      const index = wishlist.indexOf(this.productId);
      if (index > -1) {
        wishlist.splice(index, 1);
      } else {
        wishlist.push(this.productId);
      }
      localStorage.setItem(this.storageKey, JSON.stringify(wishlist));
      this.updateState(index === -1);
    }

    updateState(isActive) {
      this.button.setAttribute('aria-pressed', isActive);
      this.button.setAttribute('aria-label', isActive ? 'Remove from wishlist' : 'Add to wishlist');
    }
  }

  customElements.define('wishlist-button', WishlistButton);
{% endjavascript %}
```

To find the exact insertion point: this file has one top-level `{%- if card_product and card_product != empty -%} ... {%- else -%} ... {%- endif -%}` structure. Add the `{% javascript %}` block after that structure's closing `{%- endif -%}`, as the last content in the file (verify by reading the file's last 15 lines before editing — if the file doesn't end exactly with that `{%- endif -%}`, append after whatever the actual last line is).

- [ ] **Step 3: Add wishlist button CSS**

In `assets/component-card.css`, find:

```css
.card__inner {
  width: 100%;
}
```

Replace with:

```css
.card__inner {
  width: 100%;
}

.card__inner:has(.card__wishlist-button) {
  position: relative;
}

.card__wishlist-button {
  position: absolute;
  top: 1rem;
  right: 1rem;
  z-index: 2;
}

.card__wishlist-button button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3.6rem;
  height: 3.6rem;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background-color: rgb(var(--color-background));
  cursor: pointer;
}

.card__wishlist-button button .icon-heart {
  width: 1.8rem;
  height: 1.8rem;
  fill: rgba(var(--color-foreground), 0.4);
  transition: fill var(--duration-short) ease;
}

.card__wishlist-button button[aria-pressed='true'] .icon-heart {
  fill: rgb(var(--color-foreground));
}
```

- [ ] **Step 4: Commit**

```bash
git add snippets/card-product.liquid assets/component-card.css
git commit -m "feat: add wishlist placeholder icon to product cards"
```

---

### Task 4: Theme Check and manual QA

**Files:** none (verification only)

**Interfaces:**
- Consumes: all prior tasks' output.

- [ ] **Step 1: Run Theme Check**

Run: `shopify theme check`
Expected: no new offense types introduced by `templates/product.json`, `sections/related-articles.liquid`, `templates/article.json`, `snippets/card-product.liquid`, or `assets/component-card.css`. (Baseline: 172 files, 56 pre-existing offenses, unrelated to this branch's files.)

- [ ] **Step 2: Start local preview**

Run: `shopify theme dev --store nongsanhaiduong.myshopify.com`
Expected: CLI prints a local preview URL and completes the initial sync with no "Upload Errors" (this is the check that catches semantic schema/content-type issues that JSON-syntax validation cannot, per Phase 2's experience — if there IS an upload error, fix the relevant task's file and re-sync before continuing).

- [ ] **Step 3: Product page check**

Open a product page (e.g. `/products/<any-seeded-product-handle>`) in a desktop-width browser window. Confirm: the trust badge row (Free Shipping / Secure Checkout / Easy Returns with icons) appears below the buy buttons, and three collapsible rows (Shipping, Returns, Size Guide) appear below the description and expand/collapse on click.

- [ ] **Step 4: Article page check**

Open an article page (any post from the store's default "news" blog — if none exist, this step will show an empty related-articles grid; note this and move on, it's not a bug). Confirm the "Read more" heading and grid appear below the article content, showing up to 3 other articles, none of which is the current one.

- [ ] **Step 5: Wishlist button check**

On the homepage, a collection page, and a product page's related-products section, confirm every product card shows a heart icon in the top-right of its image. Click one — confirm it visually fills in (darker) and `aria-pressed` becomes `"true"` (check via browser dev tools or an accessibility snapshot). Reload the page — confirm the same heart is still filled in (localStorage persistence).

- [ ] **Step 6: Collection page regression check**

Open a collection page. Confirm filtering, sorting, and pagination still work exactly as before (this phase made no changes here — this step only guards against an unexpected regression from the shared `card-product.liquid` change).

- [ ] **Step 7: Stop the dev server**

Press `Ctrl+C` in the terminal running `shopify theme dev`.

(No commit — this task is verification only. If any step fails, fix the relevant task's file and re-commit before proceeding.)
