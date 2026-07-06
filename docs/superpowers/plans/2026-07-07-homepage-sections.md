# Homepage Sections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Assemble the tartan-shop homepage from Dawn's existing sections (hero, featured collection, category grids via `multicolumn`, blog preview) plus three net-new sections Dawn doesn't provide (clan/tartan finder, testimonials, press logos).

**Architecture:** Three new, independent Liquid sections (`clan-finder`, `testimonials`, `press-logos`), each self-contained with inline `{% style %}` blocks (following the pattern already used by `sections/multicolumn.liquid` and `sections/header.liquid`) and no new asset files except reusing Dawn's existing `component-rating.css` for testimonial stars. `templates/index.json` is rewritten to assemble all 11 homepage sections in order.

**Tech Stack:** Shopify Dawn theme (Liquid, JSON templates/sections), vanilla CSS via inline `{% style %}` tags, existing Dawn snippets/assets (`placeholder_svg_tag`, `component-rating.css`).

## Global Constraints

- No copyrighted assets, images, logos, exact brand name, exact text, or proprietary code from any reference site — all seed copy is original placeholder.
- Theme code must pass `shopify theme check` with no new offenses vs. the current baseline (169 files, 53 offenses — confirmed unchanged after Phase 1).
- Do not hardcode products; category card links point to `/collections/all` as an explicit placeholder (consistent with Phase 1).
- Do not include real press/news outlet logos anywhere — every `press_logo` block ships with a blank image and falls back to a neutral placeholder box.
- New schema labels use plain English strings, not `t:` locale keys (same approved tradeoff as Phase 1).
- Layout must remain responsive at desktop/tablet/mobile.

---

### Task 1: Clan/Tartan Finder section

**Files:**
- Create: `sections/clan-finder.liquid`

**Interfaces:**
- Produces: section type `clan-finder` with settings `heading`, `description`, `color_scheme`, `padding_top`, `padding_bottom`, and block type `clan_link` (settings `title`, `link`), consumed by Task 4's `templates/index.json`.

- [ ] **Step 1: Write `sections/clan-finder.liquid`**

```liquid
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

  .clan-finder__grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1.5rem;
    margin-top: 3rem;
  }

  @media screen and (min-width: 750px) {
    .clan-finder__grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @media screen and (min-width: 990px) {
    .clan-finder__grid {
      grid-template-columns: repeat(5, 1fr);
    }
  }

  .clan-finder__link {
    display: block;
    padding: 2rem 1.5rem;
    text-align: center;
    border: 1px solid rgba(var(--color-foreground), 0.1);
    text-decoration: none;
    color: rgb(var(--color-foreground));
    font-weight: 600;
  }

  .clan-finder__link:hover {
    border-color: rgb(var(--color-foreground));
  }
{%- endstyle -%}

<div class="color-{{ section.settings.color_scheme }} gradient">
  <div class="page-width section-{{ section.id }}-padding">
    {%- if section.settings.heading != blank -%}
      <h2 class="title h1">{{ section.settings.heading | escape }}</h2>
    {%- endif -%}
    {%- if section.settings.description != blank -%}
      <div class="rte">{{ section.settings.description }}</div>
    {%- endif -%}
    <div class="clan-finder__grid">
      {%- for block in section.blocks -%}
        <a
          href="{{ block.settings.link | default: '#' }}"
          class="clan-finder__link"
          {{ block.shopify_attributes }}
        >
          {{ block.settings.title | escape }}
        </a>
      {%- endfor -%}
    </div>
  </div>
</div>

{% schema %}
{
  "name": "Clan finder",
  "class": "section",
  "tag": "section",
  "disabled_on": {
    "groups": ["header", "footer"]
  },
  "settings": [
    {
      "type": "text",
      "id": "heading",
      "label": "Heading",
      "default": "Find Your Tartan"
    },
    {
      "type": "richtext",
      "id": "description",
      "label": "Description",
      "default": "<p>Search our full range of clan and regional tartans.</p>"
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
  ],
  "blocks": [
    {
      "type": "clan_link",
      "name": "Clan link",
      "settings": [
        {
          "type": "text",
          "id": "title",
          "label": "Title",
          "default": "Clan name"
        },
        {
          "type": "url",
          "id": "link",
          "label": "Link"
        }
      ]
    }
  ],
  "presets": [
    {
      "name": "Clan finder",
      "blocks": [
        { "type": "clan_link" },
        { "type": "clan_link" },
        { "type": "clan_link" }
      ]
    }
  ]
}
{% endschema %}
```

- [ ] **Step 2: Validate the schema JSON parses**

Run: `python3 -c "import re,json; s=open('sections/clan-finder.liquid').read(); m=re.search(r'{% schema %}(.*){% endschema %}', s, re.S); json.loads(m.group(1)); print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add sections/clan-finder.liquid
git commit -m "feat: add clan/tartan finder homepage section"
```

---

### Task 2: Testimonials section

**Files:**
- Create: `sections/testimonials.liquid`

**Interfaces:**
- Consumes: `assets/component-rating.css` (existing Dawn asset — provides `.rating`/`.rating-star` classes driven by `--rating`/`--rating-max`/`--rating-decimal` custom properties).
- Produces: section type `testimonials` with settings `heading`, `subheading`, `color_scheme`, `padding_top`, `padding_bottom`, and block type `testimonial` (settings `quote`, `author`, `rating`), consumed by Task 4's `templates/index.json`.

- [ ] **Step 1: Write `sections/testimonials.liquid`**

```liquid
{{ 'component-rating.css' | asset_url | stylesheet_tag }}

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

  .testimonials__header {
    text-align: center;
  }

  .testimonials__subheading {
    margin-top: 0.4rem;
  }

  .testimonials__grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 2rem;
    margin-top: 3rem;
  }

  @media screen and (min-width: 750px) {
    .testimonials__grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  .testimonials__card {
    border: 1px solid rgba(var(--color-foreground), 0.1);
    padding: 2.4rem;
  }

  .testimonials__quote {
    margin: 1.2rem 0;
  }

  .testimonials__author {
    font-weight: 600;
    margin: 0;
  }
{%- endstyle -%}

<div class="color-{{ section.settings.color_scheme }} gradient">
  <div class="page-width section-{{ section.id }}-padding">
    <div class="testimonials__header">
      {%- if section.settings.heading != blank -%}
        <h2 class="title h1">{{ section.settings.heading | escape }}</h2>
      {%- endif -%}
      {%- if section.settings.subheading != blank -%}
        <p class="testimonials__subheading">{{ section.settings.subheading | escape }}</p>
      {%- endif -%}
    </div>
    <div class="testimonials__grid">
      {%- for block in section.blocks -%}
        <div class="testimonials__card" {{ block.shopify_attributes }}>
          <div class="rating" role="img" aria-label="{{ block.settings.rating }} out of 5 stars">
            <span
              aria-hidden="true"
              class="rating-star"
              style="--rating: {{ block.settings.rating }}; --rating-max: 5; --rating-decimal: 0;"
            ></span>
          </div>
          {%- if block.settings.quote != blank -%}
            <blockquote class="testimonials__quote">{{ block.settings.quote | escape }}</blockquote>
          {%- endif -%}
          {%- if block.settings.author != blank -%}
            <p class="testimonials__author">{{ block.settings.author | escape }}</p>
          {%- endif -%}
        </div>
      {%- endfor -%}
    </div>
  </div>
</div>

{% schema %}
{
  "name": "Testimonials",
  "class": "section",
  "tag": "section",
  "disabled_on": {
    "groups": ["header", "footer"]
  },
  "settings": [
    {
      "type": "text",
      "id": "heading",
      "label": "Heading",
      "default": "What Our Customers Say"
    },
    {
      "type": "text",
      "id": "subheading",
      "label": "Subheading",
      "default": "Real reviews from real customers"
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
  ],
  "blocks": [
    {
      "type": "testimonial",
      "name": "Testimonial",
      "settings": [
        {
          "type": "textarea",
          "id": "quote",
          "label": "Quote",
          "default": "This is the best tartan gear I've ever owned. Warm, well made, and true to the pattern."
        },
        {
          "type": "text",
          "id": "author",
          "label": "Author",
          "default": "Happy customer"
        },
        {
          "type": "range",
          "id": "rating",
          "min": 1,
          "max": 5,
          "step": 1,
          "label": "Rating",
          "default": 5
        }
      ]
    }
  ],
  "presets": [
    {
      "name": "Testimonials",
      "blocks": [
        { "type": "testimonial" },
        { "type": "testimonial" },
        { "type": "testimonial" }
      ]
    }
  ]
}
{% endschema %}
```

- [ ] **Step 2: Validate the schema JSON parses**

Run: `python3 -c "import re,json; s=open('sections/testimonials.liquid').read(); m=re.search(r'{% schema %}(.*){% endschema %}', s, re.S); json.loads(m.group(1)); print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add sections/testimonials.liquid
git commit -m "feat: add testimonials homepage section"
```

---

### Task 3: Press logos section

**Files:**
- Create: `sections/press-logos.liquid`

**Interfaces:**
- Produces: section type `press-logos` with settings `heading`, `subheading`, `color_scheme`, `padding_top`, `padding_bottom`, and block type `press_logo` (settings `image`, `link`), consumed by Task 4's `templates/index.json`.

- [ ] **Step 1: Write `sections/press-logos.liquid`**

```liquid
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

  .press-logos__header {
    text-align: center;
  }

  .press-logos__subheading {
    margin-top: 0.4rem;
  }

  .press-logos__strip {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 4rem;
    margin-top: 3rem;
  }

  .press-logos__logo {
    display: block;
    width: 12rem;
    height: 6rem;
  }

  .press-logos__logo img,
  .press-logos__logo svg {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
{%- endstyle -%}

<div class="color-{{ section.settings.color_scheme }} gradient">
  <div class="page-width section-{{ section.id }}-padding">
    <div class="press-logos__header">
      {%- if section.settings.heading != blank -%}
        <h2 class="h2">{{ section.settings.heading | escape }}</h2>
      {%- endif -%}
      {%- if section.settings.subheading != blank -%}
        <p class="press-logos__subheading">{{ section.settings.subheading | escape }}</p>
      {%- endif -%}
    </div>
    <div class="press-logos__strip">
      {%- for block in section.blocks -%}
        {%- liquid
          assign logo_alt = block.settings.image.alt | default: 'Press logo' | escape
        -%}
        {%- if block.settings.link != blank -%}
          <a href="{{ block.settings.link }}" class="press-logos__logo" {{ block.shopify_attributes }}>
        {%- else -%}
          <span class="press-logos__logo" {{ block.shopify_attributes }}>
        {%- endif -%}
        {%- if block.settings.image != blank -%}
          {{ block.settings.image | image_url: width: 300 | image_tag: loading: 'lazy', alt: logo_alt }}
        {%- else -%}
          {{ 'lifestyle-1' | placeholder_svg_tag: 'placeholder-svg' }}
        {%- endif -%}
        {%- if block.settings.link != blank -%}
          </a>
        {%- else -%}
          </span>
        {%- endif -%}
      {%- endfor -%}
    </div>
  </div>
</div>

{% schema %}
{
  "name": "Press logos",
  "class": "section",
  "tag": "section",
  "disabled_on": {
    "groups": ["header", "footer"]
  },
  "settings": [
    {
      "type": "text",
      "id": "heading",
      "label": "Heading",
      "default": "As Seen On"
    },
    {
      "type": "text",
      "id": "subheading",
      "label": "Subheading",
      "default": "And over 400 news sites"
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
  ],
  "blocks": [
    {
      "type": "press_logo",
      "name": "Press logo",
      "settings": [
        {
          "type": "image_picker",
          "id": "image",
          "label": "Logo image"
        },
        {
          "type": "url",
          "id": "link",
          "label": "Link"
        }
      ]
    }
  ],
  "presets": [
    {
      "name": "Press logos",
      "blocks": [
        { "type": "press_logo" },
        { "type": "press_logo" },
        { "type": "press_logo" },
        { "type": "press_logo" }
      ]
    }
  ]
}
{% endschema %}
```

- [ ] **Step 2: Validate the schema JSON parses**

Run: `python3 -c "import re,json; s=open('sections/press-logos.liquid').read(); m=re.search(r'{% schema %}(.*){% endschema %}', s, re.S); json.loads(m.group(1)); print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add sections/press-logos.liquid
git commit -m "feat: add press logos homepage section"
```

---

### Task 4: Assemble the homepage

**Files:**
- Modify: `templates/index.json`

**Interfaces:**
- Consumes: section type `clan-finder` (Task 1), `testimonials` (Task 2), `press-logos` (Task 3), plus existing Dawn section types `image-banner`, `featured-collection`, `multicolumn`, `featured-blog`.

- [ ] **Step 1: Replace `templates/index.json` with the full homepage assembly**

Replace the entire contents of `templates/index.json` with:

```json
{
  "sections": {
    "image_banner": {
      "type": "image-banner",
      "blocks": {
        "heading": {
          "type": "heading",
          "settings": {
            "heading": "Wear Your Heritage",
            "heading_size": "h0"
          }
        },
        "text": {
          "type": "text",
          "settings": {
            "text": "<p>Original tartan-inspired apparel and home goods, made to last.</p>",
            "text_style": "subtitle"
          }
        },
        "button": {
          "type": "buttons",
          "settings": {
            "button_label_1": "Shop all",
            "button_link_1": "shopify://collections/all",
            "button_style_secondary_1": true,
            "button_label_2": "Find your clan",
            "button_link_2": "#",
            "button_style_secondary_2": true
          }
        }
      },
      "block_order": [
        "heading",
        "text",
        "button"
      ],
      "settings": {
        "image_overlay_opacity": 40,
        "image_height": "large",
        "desktop_content_position": "bottom-center",
        "show_text_box": false,
        "image_behavior": "none",
        "desktop_content_alignment": "center",
        "color_scheme": "scheme-3",
        "mobile_content_alignment": "center",
        "stack_images_on_mobile": false,
        "show_text_below": false
      }
    },
    "clan_finder": {
      "type": "clan-finder",
      "blocks": {
        "clan-a-l": {
          "type": "clan_link",
          "settings": {
            "title": "Clans A-L",
            "link": "/collections/all"
          }
        },
        "clan-m-y": {
          "type": "clan_link",
          "settings": {
            "title": "Clans M-Y",
            "link": "/collections/all"
          }
        },
        "canada-province": {
          "type": "clan_link",
          "settings": {
            "title": "Canada Province Tartan",
            "link": "/collections/all"
          }
        },
        "ireland-a-k": {
          "type": "clan_link",
          "settings": {
            "title": "Ireland County Tartan A-K",
            "link": "/collections/all"
          }
        },
        "ireland-l-w": {
          "type": "clan_link",
          "settings": {
            "title": "Ireland County Tartan L-W",
            "link": "/collections/all"
          }
        }
      },
      "block_order": [
        "clan-a-l",
        "clan-m-y",
        "canada-province",
        "ireland-a-k",
        "ireland-l-w"
      ],
      "settings": {
        "heading": "Find Your Tartan",
        "description": "<p>Search our full range of clan and regional tartans.</p>",
        "color_scheme": "scheme-1",
        "padding_top": 36,
        "padding_bottom": 36
      }
    },
    "featured_collection": {
      "type": "featured-collection",
      "settings": {
        "title": "Featured products",
        "heading_size": "h2",
        "description": "",
        "show_description": false,
        "description_style": "body",
        "collection": "all",
        "products_to_show": 8,
        "columns_desktop": 4,
        "color_scheme": "scheme-1",
        "full_width": false,
        "show_view_all": true,
        "view_all_style": "solid",
        "enable_desktop_slider": false,
        "swipe_on_mobile": false,
        "image_ratio": "adapt",
        "image_shape": "default",
        "show_secondary_image": true,
        "show_vendor": false,
        "show_rating": false,
        "quick_add": "standard",
        "columns_mobile": "2",
        "padding_top": 44,
        "padding_bottom": 36
      }
    },
    "category_grid_apparel": {
      "type": "multicolumn",
      "blocks": {
        "c1": { "type": "column", "settings": { "title": "Tartan T-Shirt", "link_label": "Shop now", "link": "/collections/all" } },
        "c2": { "type": "column", "settings": { "title": "Tartan Polo Shirt", "link_label": "Shop now", "link": "/collections/all" } },
        "c3": { "type": "column", "settings": { "title": "Women's Polo Shirt", "link_label": "Shop now", "link": "/collections/all" } },
        "c4": { "type": "column", "settings": { "title": "Tartan Sweatshirt", "link_label": "Shop now", "link": "/collections/all" } },
        "c5": { "type": "column", "settings": { "title": "Tartan Long Sleeve Button Shirts", "link_label": "Shop now", "link": "/collections/all" } },
        "c6": { "type": "column", "settings": { "title": "Tartan Women's Casual Shirt", "link_label": "Shop now", "link": "/collections/all" } },
        "c7": { "type": "column", "settings": { "title": "Tartan Hawaiian Shirt", "link_label": "Shop now", "link": "/collections/all" } }
      },
      "block_order": ["c1", "c2", "c3", "c4", "c5", "c6", "c7"],
      "settings": {
        "title": "Apparel & Clothing",
        "heading_size": "h1",
        "image_width": "full",
        "image_ratio": "square",
        "button_label": "",
        "button_link": "",
        "columns_desktop": 4,
        "column_alignment": "center",
        "background_style": "none",
        "color_scheme": "scheme-1",
        "columns_mobile": "2",
        "swipe_on_mobile": true,
        "padding_top": 36,
        "padding_bottom": 36
      }
    },
    "category_grid_hoodies": {
      "type": "multicolumn",
      "blocks": {
        "c1": { "type": "column", "settings": { "title": "Casual Hoodie", "link_label": "Shop now", "link": "/collections/all" } },
        "c2": { "type": "column", "settings": { "title": "Sherpa Hoodie", "link_label": "Shop now", "link": "/collections/all" } },
        "c3": { "type": "column", "settings": { "title": "Tartan Bomber Jacket", "link_label": "Shop now", "link": "/collections/all" } },
        "c4": { "type": "column", "settings": { "title": "Tartan Padded Jacket", "link_label": "Shop now", "link": "/collections/all" } },
        "c5": { "type": "column", "settings": { "title": "Borg Fleece Hoodie", "link_label": "Shop now", "link": "/collections/all" } },
        "c6": { "type": "column", "settings": { "title": "Knitted Hoodie", "link_label": "Shop now", "link": "/collections/all" } },
        "c7": { "type": "column", "settings": { "title": "Baseball Jacket", "link_label": "Shop now", "link": "/collections/all" } },
        "c8": { "type": "column", "settings": { "title": "Sleeveless Puffer Jacket", "link_label": "Shop now", "link": "/collections/all" } }
      },
      "block_order": ["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8"],
      "settings": {
        "title": "Hoodies & Jackets",
        "heading_size": "h1",
        "image_width": "full",
        "image_ratio": "square",
        "button_label": "",
        "button_link": "",
        "columns_desktop": 4,
        "column_alignment": "center",
        "background_style": "primary",
        "color_scheme": "scheme-2",
        "columns_mobile": "2",
        "swipe_on_mobile": true,
        "padding_top": 36,
        "padding_bottom": 36
      }
    },
    "category_grid_dresses": {
      "type": "multicolumn",
      "blocks": {
        "c1": { "type": "column", "settings": { "title": "Sleeveless Midi Dresses", "link_label": "Shop now", "link": "/collections/all" } },
        "c2": { "type": "column", "settings": { "title": "Women's Casual Dresses", "link_label": "Shop now", "link": "/collections/all" } },
        "c3": { "type": "column", "settings": { "title": "Off Shoulder Long Dress", "link_label": "Shop now", "link": "/collections/all" } },
        "c4": { "type": "column", "settings": { "title": "Off Shoulder Lady Dress", "link_label": "Shop now", "link": "/collections/all" } },
        "c5": { "type": "column", "settings": { "title": "Tartan Hoodie Dress", "link_label": "Shop now", "link": "/collections/all" } },
        "c6": { "type": "column", "settings": { "title": "Full Length Skirt", "link_label": "Shop now", "link": "/collections/all" } },
        "c7": { "type": "column", "settings": { "title": "Pleated Midi Skirt", "link_label": "Shop now", "link": "/collections/all" } }
      },
      "block_order": ["c1", "c2", "c3", "c4", "c5", "c6", "c7"],
      "settings": {
        "title": "Dresses & Skirts",
        "heading_size": "h1",
        "image_width": "full",
        "image_ratio": "square",
        "button_label": "",
        "button_link": "",
        "columns_desktop": 4,
        "column_alignment": "center",
        "background_style": "none",
        "color_scheme": "scheme-1",
        "columns_mobile": "2",
        "swipe_on_mobile": true,
        "padding_top": 36,
        "padding_bottom": 36
      }
    },
    "category_grid_decor": {
      "type": "multicolumn",
      "blocks": {
        "c1": { "type": "column", "settings": { "title": "Premium Quilts", "link_label": "Shop now", "link": "/collections/all" } },
        "c2": { "type": "column", "settings": { "title": "Tartan Bedding Set", "link_label": "Shop now", "link": "/collections/all" } },
        "c3": { "type": "column", "settings": { "title": "Tartan Blanket", "link_label": "Shop now", "link": "/collections/all" } },
        "c4": { "type": "column", "settings": { "title": "Tartan Pillow Cover", "link_label": "Shop now", "link": "/collections/all" } },
        "c5": { "type": "column", "settings": { "title": "Door Mat Collection", "link_label": "Shop now", "link": "/collections/all" } },
        "c6": { "type": "column", "settings": { "title": "Tartan Tablecloth", "link_label": "Shop now", "link": "/collections/all" } },
        "c7": { "type": "column", "settings": { "title": "Tartan Flags", "link_label": "Shop now", "link": "/collections/all" } },
        "c8": { "type": "column", "settings": { "title": "Christmas Tree Skirt", "link_label": "Shop now", "link": "/collections/all" } }
      },
      "block_order": ["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8"],
      "settings": {
        "title": "Home Decor",
        "heading_size": "h1",
        "image_width": "full",
        "image_ratio": "square",
        "button_label": "",
        "button_link": "",
        "columns_desktop": 4,
        "column_alignment": "center",
        "background_style": "primary",
        "color_scheme": "scheme-2",
        "columns_mobile": "2",
        "swipe_on_mobile": true,
        "padding_top": 36,
        "padding_bottom": 36
      }
    },
    "category_grid_accessories": {
      "type": "multicolumn",
      "blocks": {
        "c1": { "type": "column", "settings": { "title": "Tartan Classic Cap", "link_label": "Shop now", "link": "/collections/all" } },
        "c2": { "type": "column", "settings": { "title": "Tartan Beanies", "link_label": "Shop now", "link": "/collections/all" } },
        "c3": { "type": "column", "settings": { "title": "Canvas Bag", "link_label": "Shop now", "link": "/collections/all" } },
        "c4": { "type": "column", "settings": { "title": "Leather Bag", "link_label": "Shop now", "link": "/collections/all" } },
        "c5": { "type": "column", "settings": { "title": "Leather Tote Bags", "link_label": "Shop now", "link": "/collections/all" } },
        "c6": { "type": "column", "settings": { "title": "Tartan Saddle Bag", "link_label": "Shop now", "link": "/collections/all" } },
        "c7": { "type": "column", "settings": { "title": "Tartan Umbrellas", "link_label": "Shop now", "link": "/collections/all" } }
      },
      "block_order": ["c1", "c2", "c3", "c4", "c5", "c6", "c7"],
      "settings": {
        "title": "Accessories",
        "heading_size": "h1",
        "image_width": "full",
        "image_ratio": "square",
        "button_label": "",
        "button_link": "",
        "columns_desktop": 4,
        "column_alignment": "center",
        "background_style": "none",
        "color_scheme": "scheme-1",
        "columns_mobile": "2",
        "swipe_on_mobile": true,
        "padding_top": 36,
        "padding_bottom": 36
      }
    },
    "testimonials": {
      "type": "testimonials",
      "blocks": {
        "t1": {
          "type": "testimonial",
          "settings": {
            "quote": "This is the best tartan gear I've ever owned. Warm, well made, and true to the pattern.",
            "author": "Alex R.",
            "rating": 5
          }
        },
        "t2": {
          "type": "testimonial",
          "settings": {
            "quote": "Found my exact clan tartan in minutes and the quality blew me away.",
            "author": "Jamie K.",
            "rating": 5
          }
        },
        "t3": {
          "type": "testimonial",
          "settings": {
            "quote": "Fast shipping and the blanket is even softer than the photos suggested.",
            "author": "Morgan T.",
            "rating": 4
          }
        }
      },
      "block_order": ["t1", "t2", "t3"],
      "settings": {
        "heading": "What Our Customers Say",
        "subheading": "Real reviews from real customers",
        "color_scheme": "scheme-1",
        "padding_top": 36,
        "padding_bottom": 36
      }
    },
    "featured_blog": {
      "type": "featured-blog",
      "settings": {
        "heading": "From the Journal",
        "heading_size": "h1",
        "blog": "news",
        "post_limit": 3,
        "columns_desktop": 3,
        "show_view_all": true,
        "show_image": true,
        "show_date": true,
        "show_author": false,
        "color_scheme": "scheme-1",
        "padding_top": 36,
        "padding_bottom": 36
      }
    },
    "press_logos": {
      "type": "press-logos",
      "blocks": {
        "p1": { "type": "press_logo", "settings": {} },
        "p2": { "type": "press_logo", "settings": {} },
        "p3": { "type": "press_logo", "settings": {} },
        "p4": { "type": "press_logo", "settings": {} }
      },
      "block_order": ["p1", "p2", "p3", "p4"],
      "settings": {
        "heading": "As Seen On",
        "subheading": "And over 400 news sites",
        "color_scheme": "scheme-1",
        "padding_top": 36,
        "padding_bottom": 36
      }
    }
  },
  "order": [
    "image_banner",
    "clan_finder",
    "featured_collection",
    "category_grid_apparel",
    "category_grid_hoodies",
    "category_grid_dresses",
    "category_grid_decor",
    "category_grid_accessories",
    "testimonials",
    "featured_blog",
    "press_logos"
  ]
}
```

- [ ] **Step 2: Validate JSON**

Run: `python3 -c "import json; json.load(open('templates/index.json')); print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add templates/index.json
git commit -m "feat: assemble homepage with new and existing sections"
```

---

### Task 5: Theme Check and manual QA

**Files:** none (verification only)

**Interfaces:**
- Consumes: all prior tasks' output.

- [ ] **Step 1: Run Theme Check**

Run: `shopify theme check`
Expected: no new offenses introduced by `sections/clan-finder.liquid`, `sections/testimonials.liquid`, `sections/press-logos.liquid`, or `templates/index.json`. (Baseline: 169 files, 53 pre-existing offenses, unrelated to this branch's files — same baseline confirmed in Phase 1.)

- [ ] **Step 2: Start local preview**

Run: `shopify theme dev --store nongsanhaiduong.myshopify.com`
Expected: CLI prints a local preview URL (typically `http://127.0.0.1:9292`).

- [ ] **Step 3: Desktop homepage check**

Open the preview URL in a desktop-width browser window (≥ 990px). Confirm, top to bottom: hero banner with heading/subtext/two buttons, "Find Your Tartan" clan finder grid (5 tiles), featured products grid, five category grids in order (Apparel & Clothing, Hoodies & Jackets, Dresses & Skirts, Home Decor, Accessories) each showing their titled cards, "What Our Customers Say" with 3 cards showing star ratings, "From the Journal" blog section, "As Seen On" with 4 placeholder logo boxes.

- [ ] **Step 4: Mobile check**

Resize to < 750px (or use device emulation). Confirm the clan finder grid collapses to 2 columns, category grids become swipeable/stacked, testimonials stack to 1 column, and the press logo strip wraps without overflow.

- [ ] **Step 5: Theme customizer check**

Open the theme editor link the CLI printed. Confirm all three new sections (Clan finder, Testimonials, Press logos) are editable — settings and blocks appear and can be added/removed/reordered.

- [ ] **Step 6: Stop the dev server**

Press `Ctrl+C` in the terminal running `shopify theme dev`.

(No commit — this task is verification only. If any step fails, fix the relevant task's file and re-commit before proceeding.)
