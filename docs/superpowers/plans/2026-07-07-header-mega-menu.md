# Header & Mega Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the tartan-shop's primary navigation — the full mega menu content tree and an optional visual promo tile inside a mega menu flyout — on top of the existing stock Dawn header/mega-menu/drawer, with no changes needed to that existing infrastructure's core behavior.

**Architecture:** Two independent halves that combine at the end: (1) a Node ops script that provisions the Shopify Navigation menu and three placeholder pages via the Admin GraphQL API, and (2) a small additive change to `sections/header.liquid` + `snippets/header-mega-menu.liquid` + `assets/component-mega-menu.css` that lets a merchant attach an image/heading/link "promo tile" block to any top-level mega menu item by title match. `sections/header-group.json` is flipped from `dropdown` to `mega` menu type and seeded with one example promo block.

**Tech Stack:** Shopify Dawn theme (Liquid, Online Store 2.0 JSON templates/sections), vanilla CSS, Node 23 (built-in `fetch`, `--env-file`) for the one-off Admin API script, Shopify CLI `theme check`.

## Global Constraints

- No copyrighted assets, images, logos, exact brand name, exact text, or proprietary code from any reference site — all content below is original placeholder copy.
- Theme code must pass `shopify theme check` with no new offenses.
- Layout must remain responsive at desktop/tablet/mobile breakpoints; the promo tile is desktop-only by design (mobile drawer is unchanged).
- Do not hardcode products; leaf navigation links point to `/collections/all` as an explicit placeholder per the approved design.
- New schema labels use plain English strings, not `t:` locale keys (approved tradeoff — bespoke single-market theme).
- Secrets (Admin API token) must never be committed; `.env` is gitignored.

---

### Task 1: Script scaffolding & secrets config

**Files:**
- Modify: `.gitignore`
- Create: `.env.example`
- Create: `scripts/` directory (created implicitly by Task 2's file)

**Interfaces:**
- Produces: `.env` convention (`SHOPIFY_STORE_DOMAIN`, `SHOPIFY_ADMIN_TOKEN`) consumed by Task 2's script via `node --env-file=.env`.

- [ ] **Step 1: Add `.env` to `.gitignore`**

Edit `.gitignore`, appending after the existing `*.zip` line:

```
*.zip
.env
```

- [ ] **Step 2: Create `.env.example`**

```
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_ADMIN_TOKEN=shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

- [ ] **Step 3: Verify `.env` is actually ignored**

Run: `touch .env && git status --short .env`
Expected: no output (git reports nothing — file is ignored). Then `rm .env` (it was just a probe file).

- [ ] **Step 4: Commit**

```bash
git add .gitignore .env.example
git commit -m "chore: add .env convention for admin API scripts"
```

---

### Task 2: Navigation & pages provisioning script

**Files:**
- Create: `scripts/setup-navigation.mjs`

**Interfaces:**
- Consumes: `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_ADMIN_TOKEN` env vars (from Task 1's `.env` convention).
- Produces: no exports (standalone CLI script); run via `node --env-file=.env scripts/setup-navigation.mjs [--dry-run]`.

- [ ] **Step 1: Write `scripts/setup-navigation.mjs`**

```js
#!/usr/bin/env node
// Provisions the tartan-shop "main-menu" navigation tree and placeholder
// pages via the Shopify Admin GraphQL API.
//
// Usage:
//   node --env-file=.env scripts/setup-navigation.mjs [--dry-run]

const domain = process.env.SHOPIFY_STORE_DOMAIN;
const token = process.env.SHOPIFY_ADMIN_TOKEN;
const dryRun = process.argv.includes('--dry-run');

if (!domain || !token) {
  console.error('Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_TOKEN env vars.');
  process.exit(1);
}

const API_VERSION = '2025-01';
const endpoint = `https://${domain}/admin/api/${API_VERSION}/graphql.json`;

async function adminGraphql(query, variables) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await response.json();
  if (json.errors) {
    throw new Error(`GraphQL error: ${JSON.stringify(json.errors)}`);
  }
  return json.data;
}

const menuTree = [
  {
    title: 'Find Your Clans',
    url: '/collections/all',
    items: [
      { title: 'Clans A-L', url: '/collections/all' },
      { title: 'Clans M-Y', url: '/collections/all' },
      { title: 'Canada Province Tartan', url: '/collections/all' },
      { title: 'Ireland County Tartan A-K', url: '/collections/all' },
      { title: 'Ireland County Tartan L-W', url: '/collections/all' },
    ],
  },
  {
    title: 'For Men',
    url: '/collections/all',
    items: [
      { title: 'Shirts & Tops', url: '/collections/all' },
      { title: 'Outerwear & Jacket', url: '/collections/all' },
      { title: 'Pants', url: '/collections/all' },
      { title: 'Clothing Accessories', url: '/collections/all' },
      { title: 'Sleepwear', url: '/collections/all' },
    ],
  },
  {
    title: 'For Women',
    url: '/collections/all',
    items: [
      { title: 'Shirts & Tops', url: '/collections/all' },
      { title: 'Outerwear & Jacket', url: '/collections/all' },
      { title: 'Bottoms', url: '/collections/all' },
      { title: 'Dresses', url: '/collections/all' },
      { title: 'Handbags', url: '/collections/all' },
      { title: 'Clothing Accessories', url: '/collections/all' },
      { title: 'Sleepwear', url: '/collections/all' },
      { title: 'Swimwear', url: '/collections/all' },
    ],
  },
  { title: 'New Arrivals', url: '/collections/all' },
  { title: 'Home Decor', url: '/collections/all' },
  { title: 'Footwears', url: '/collections/all' },
  { title: 'Blog', url: '/blogs/news' },
  { title: 'Tartan Club', url: '/pages/tartan-club' },
  { title: 'About Us', url: '/pages/about-us' },
  { title: 'Contact Us', url: '/pages/contact-us' },
];

const pagesToEnsure = [
  {
    handle: 'tartan-club',
    title: 'Tartan Club',
    body: '<p>Join the Tartan Club loyalty program for early access to new arrivals and member-only offers.</p>',
  },
  {
    handle: 'about-us',
    title: 'About Us',
    body: '<p>We design original tartan-inspired apparel and home goods. Replace this placeholder with your brand story.</p>',
  },
  {
    handle: 'contact-us',
    title: 'Contact Us',
    body: '<p>Get in touch with our team using the form below.</p>',
    templateSuffix: 'contact',
  },
];

function toMenuItemInput(node, baseUrl) {
  const input = {
    title: node.title,
    type: 'HTTP',
    url: `${baseUrl}${node.url}`,
  };
  if (node.items) {
    input.items = node.items.map((child) => toMenuItemInput(child, baseUrl));
  }
  return input;
}

async function getPrimaryDomainHost() {
  const data = await adminGraphql('query { shop { primaryDomain { host } } }');
  return data.shop.primaryDomain.host;
}

async function findMainMenu() {
  const data = await adminGraphql(`
    query {
      menus(first: 20) {
        nodes { id handle title }
      }
    }
  `);
  const menu = data.menus.nodes.find((m) => m.handle === 'main-menu');
  if (!menu) {
    throw new Error('Could not find a menu with handle "main-menu". Check Admin > Online Store > Navigation.');
  }
  return menu;
}

async function updateMainMenu(menuId, baseUrl) {
  const items = menuTree.map((node) => toMenuItemInput(node, baseUrl));
  if (dryRun) {
    console.log('--dry-run: menuUpdate items payload:');
    console.log(JSON.stringify(items, null, 2));
    return;
  }
  const data = await adminGraphql(
    `
      mutation UpdateMainMenu($id: ID!, $items: [MenuItemUpdateInput!]) {
        menuUpdate(id: $id, items: $items) {
          menu { id handle }
          userErrors { field message }
        }
      }
    `,
    { id: menuId, items }
  );
  const { userErrors, menu } = data.menuUpdate;
  if (userErrors.length) {
    throw new Error(`menuUpdate userErrors: ${JSON.stringify(userErrors)}`);
  }
  console.log(`Updated menu ${menu.handle} (${menu.id})`);
}

async function ensurePages() {
  for (const page of pagesToEnsure) {
    const existing = await adminGraphql(
      'query FindPage($query: String!) { pages(first: 1, query: $query) { nodes { id handle } } }',
      { query: `handle:${page.handle}` }
    );
    if (existing.pages.nodes.length) {
      console.log(`Page "${page.handle}" already exists, skipping.`);
      continue;
    }
    if (dryRun) {
      console.log(`--dry-run: would create page "${page.handle}"`);
      continue;
    }
    const data = await adminGraphql(
      `
        mutation CreatePage($page: PageCreateInput!) {
          pageCreate(page: $page) {
            page { id handle }
            userErrors { field message }
          }
        }
      `,
      {
        page: {
          title: page.title,
          handle: page.handle,
          body: page.body,
          templateSuffix: page.templateSuffix,
          isPublished: true,
        },
      }
    );
    const { userErrors, page: created } = data.pageCreate;
    if (userErrors.length) {
      throw new Error(`pageCreate userErrors for "${page.handle}": ${JSON.stringify(userErrors)}`);
    }
    console.log(`Created page "${created.handle}" (${created.id})`);
  }
}

async function main() {
  const baseUrl = `https://${await getPrimaryDomainHost()}`;
  const menu = await findMainMenu();
  await updateMainMenu(menu.id, baseUrl);
  await ensurePages();
  console.log(dryRun ? 'Dry run complete.' : 'Navigation setup complete.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
```

- [ ] **Step 2: Syntax-check the script**

Run: `node --check scripts/setup-navigation.mjs`
Expected: no output (exits 0).

- [ ] **Step 3: Commit**

```bash
git add scripts/setup-navigation.mjs
git commit -m "feat: add Admin API script to provision navigation menu and pages"
```

---

### Task 3: Provision the dev store (live run)

**Files:** none (operational task against the `nongsanhaiduong` dev store)

**Interfaces:**
- Consumes: `scripts/setup-navigation.mjs` from Task 2.

- [ ] **Step 1: Create a custom app in the dev store**

In the `nongsanhaiduong` dev store admin: Settings → Apps and sales channels → Develop apps → Create an app (e.g. name it "Theme Setup"). Under Configuration, grant Admin API scopes: `write_online_store_navigation`, `read_online_store_navigation`, `write_content`, `read_content`. Install the app, then reveal and copy the Admin API access token.

- [ ] **Step 2: Create `.env` locally (not committed)**

```bash
cp .env.example .env
```

Edit `.env` and fill in:
```
SHOPIFY_STORE_DOMAIN=nongsanhaiduong.myshopify.com
SHOPIFY_ADMIN_TOKEN=<paste the token from Step 1>
```

- [ ] **Step 3: Dry run**

Run: `node --env-file=.env scripts/setup-navigation.mjs --dry-run`
Expected: prints the constructed `menuUpdate` items JSON tree (10 top-level entries, 3 with nested `items`) and 3 "would create page" lines, then "Dry run complete." No network mutation occurs. If this errors, fix the script (e.g. adjust field/type names to match the API's actual error message) before proceeding — the Admin API version pinned in the script (`2025-01`) is expected to match `menuUpdate`/`pageCreate` shapes described above, but confirm against the live error text if not.

- [ ] **Step 4: Live run**

Run: `node --env-file=.env scripts/setup-navigation.mjs`
Expected: "Updated menu main-menu (...)" followed by 3 "Created page ..." lines (or "already exists, skipping." on a re-run), then "Navigation setup complete."

- [ ] **Step 5: Verify in Admin**

Open the dev store admin → Online Store → Navigation → main menu. Confirm all 10 top-level items and their children match the tree in the design doc. Open Online Store → Pages and confirm About Us, Contact Us, Tartan Club exist and are published.

- [ ] **Step 6: Verify idempotency**

Run: `node --env-file=.env scripts/setup-navigation.mjs`
Expected: same "Updated menu ..." line (menuUpdate overwrites cleanly) and 3 "already exists, skipping." lines — no duplicate pages created, no error.

(No commit — this task only mutates the live store, not the repo.)

---

### Task 4: Mega menu promo tile block schema

**Files:**
- Modify: `sections/header.liquid`

**Interfaces:**
- Produces: block type `mega_menu_promotion` with settings `menu_item_title`, `image`, `heading`, `link`, `link_label`, consumed by Task 5's snippet changes and Task 7's seed data.

- [ ] **Step 1: Raise `max_blocks` and add the new block type**

In `sections/header.liquid`, find:

```json
  "max_blocks": 3,
```

Replace with:

```json
  "max_blocks": 8,
```

Then find the `"blocks"` array at the end of the schema:

```json
  "blocks": [
    {
      "type": "@app"
    }
  ]
```

Replace with:

```json
  "blocks": [
    {
      "type": "mega_menu_promotion",
      "name": "Mega menu promotion",
      "settings": [
        {
          "type": "text",
          "id": "menu_item_title",
          "label": "Attach to top-level menu title",
          "info": "Must exactly match a top-level menu item's title, e.g. \"Find Your Clans\". Desktop mega menu only."
        },
        {
          "type": "image_picker",
          "id": "image",
          "label": "Image"
        },
        {
          "type": "text",
          "id": "heading",
          "label": "Heading",
          "default": "Find Your Tartan"
        },
        {
          "type": "url",
          "id": "link",
          "label": "Link"
        },
        {
          "type": "text",
          "id": "link_label",
          "label": "Link label",
          "default": "Shop now"
        }
      ]
    },
    {
      "type": "@app"
    }
  ]
```

- [ ] **Step 2: Validate the JSON schema parses**

Run: `python3 -c "import re,json; s=open('sections/header.liquid').read(); m=re.search(r'{% schema %}(.*){% endschema %}', s, re.S); json.loads(m.group(1)); print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add sections/header.liquid
git commit -m "feat: add mega menu promotion block type to header section"
```

---

### Task 5: Render promo tiles in the mega menu

**Files:**
- Modify: `snippets/header-mega-menu.liquid`

**Interfaces:**
- Consumes: `section.blocks` where `block.type == 'mega_menu_promotion'` (from Task 4).

- [ ] **Step 1: Wrap the link grid and render matching promo blocks**

In `snippets/header-mega-menu.liquid`, find:

```liquid
              <div
                id="MegaMenu-Content-{{ forloop.index }}"
                class="mega-menu__content color-{{ section.settings.menu_color_scheme }} gradient motion-reduce global-settings-popup"
                tabindex="-1"
              >
                <ul
                  class="mega-menu__list page-width{% if link.levels == 1 %} mega-menu__list--condensed{% endif %}"
                  role="list"
                >
                  {%- for childlink in link.links -%}
                    <li>
                      <a
                        id="HeaderMenu-{{ link.handle }}-{{ childlink.handle }}"
                        href="{{ childlink.url }}"
                        class="mega-menu__link mega-menu__link--level-2 link{% if childlink.current %} mega-menu__link--active{% endif %}"
                        {% if childlink.current %}
                          aria-current="page"
                        {% endif %}
                      >
                        {{ childlink.title | escape }}
                      </a>
                      {%- if childlink.links != blank -%}
                        <ul class="list-unstyled" role="list">
                          {%- for grandchildlink in childlink.links -%}
                            <li>
                              <a
                                id="HeaderMenu-{{ link.handle }}-{{ childlink.handle }}-{{ grandchildlink.handle }}"
                                href="{{ grandchildlink.url }}"
                                class="mega-menu__link link{% if grandchildlink.current %} mega-menu__link--active{% endif %}"
                                {% if grandchildlink.current %}
                                  aria-current="page"
                                {% endif %}
                              >
                                {{ grandchildlink.title | escape }}
                              </a>
                            </li>
                          {%- endfor -%}
                        </ul>
                      {%- endif -%}
                    </li>
                  {%- endfor -%}
                </ul>
              </div>
```

Replace with:

```liquid
              <div
                id="MegaMenu-Content-{{ forloop.index }}"
                class="mega-menu__content color-{{ section.settings.menu_color_scheme }} gradient motion-reduce global-settings-popup"
                tabindex="-1"
              >
                <div class="mega-menu__inner page-width">
                  <ul
                    class="mega-menu__list{% if link.levels == 1 %} mega-menu__list--condensed{% endif %}"
                    role="list"
                  >
                    {%- for childlink in link.links -%}
                      <li>
                        <a
                          id="HeaderMenu-{{ link.handle }}-{{ childlink.handle }}"
                          href="{{ childlink.url }}"
                          class="mega-menu__link mega-menu__link--level-2 link{% if childlink.current %} mega-menu__link--active{% endif %}"
                          {% if childlink.current %}
                            aria-current="page"
                          {% endif %}
                        >
                          {{ childlink.title | escape }}
                        </a>
                        {%- if childlink.links != blank -%}
                          <ul class="list-unstyled" role="list">
                            {%- for grandchildlink in childlink.links -%}
                              <li>
                                <a
                                  id="HeaderMenu-{{ link.handle }}-{{ childlink.handle }}-{{ grandchildlink.handle }}"
                                  href="{{ grandchildlink.url }}"
                                  class="mega-menu__link link{% if grandchildlink.current %} mega-menu__link--active{% endif %}"
                                  {% if grandchildlink.current %}
                                    aria-current="page"
                                  {% endif %}
                                >
                                  {{ grandchildlink.title | escape }}
                                </a>
                              </li>
                            {%- endfor -%}
                          </ul>
                        {%- endif -%}
                      </li>
                    {%- endfor -%}
                  </ul>
                  <div class="mega-menu__promotions">
                    {%- for block in section.blocks -%}
                      {%- if block.type == 'mega_menu_promotion' and block.settings.menu_item_title == link.title -%}
                        {%- liquid
                          assign promo_alt = block.settings.heading | escape
                        -%}
                        <a
                          href="{{ block.settings.link | default: '#' }}"
                          class="mega-menu__promotion-tile"
                          {{ block.shopify_attributes }}
                        >
                          <span class="mega-menu__promotion-image">
                            {%- if block.settings.image != blank -%}
                              {{
                                block.settings.image
                                | image_url: width: 400
                                | image_tag: loading: 'lazy', widths: '200, 400', alt: promo_alt
                              }}
                            {%- else -%}
                              {{ 'lifestyle-1' | placeholder_svg_tag: 'placeholder-svg mega-menu__promotion-placeholder' }}
                            {%- endif -%}
                          </span>
                          <span class="mega-menu__promotion-heading">{{ block.settings.heading | escape }}</span>
                          {%- if block.settings.link_label != blank -%}
                            <span class="mega-menu__promotion-link link">{{ block.settings.link_label | escape }}</span>
                          {%- endif -%}
                        </a>
                      {%- endif -%}
                    {%- endfor -%}
                  </div>
                </div>
              </div>
```

- [ ] **Step 2: Commit**

```bash
git add snippets/header-mega-menu.liquid
git commit -m "feat: render mega menu promotion tiles alongside link columns"
```

---

### Task 6: Promo tile styling

**Files:**
- Modify: `assets/component-mega-menu.css`

**Interfaces:**
- Consumes: class names `.mega-menu__inner`, `.mega-menu__promotions`, `.mega-menu__promotion-tile`, `.mega-menu__promotion-image`, `.mega-menu__promotion-heading`, `.mega-menu__promotion-link`, `.mega-menu__promotion-placeholder` from Task 5's markup.

- [ ] **Step 1: Append promo tile rules**

In `assets/component-mega-menu.css`, find the final rule:

```css
.mega-menu__list--condensed .mega-menu__link {
  font-weight: normal;
}
```

Replace with (keeping the existing rule and adding new rules after it):

```css
.mega-menu__list--condensed .mega-menu__link {
  font-weight: normal;
}

.mega-menu__inner {
  display: flex;
  align-items: flex-start;
  gap: 4rem;
}

.mega-menu__list {
  flex: 1 1 auto;
}

.mega-menu__promotions {
  display: flex;
  flex: 0 0 auto;
  gap: 2rem;
}

.mega-menu__promotions:empty {
  display: none;
}

.mega-menu__promotion-tile {
  display: block;
  width: 20rem;
  color: rgb(var(--color-foreground));
  text-decoration: none;
}

.mega-menu__promotion-image {
  display: block;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  margin-bottom: 1.2rem;
}

.mega-menu__promotion-image img,
.mega-menu__promotion-image svg {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mega-menu__promotion-heading {
  display: block;
  font-weight: bold;
  margin-bottom: 0.4rem;
}

.mega-menu__promotion-link {
  font-size: 1.3rem;
  text-decoration: underline;
}

@media screen and (max-width: 1200px) {
  .mega-menu__inner {
    flex-direction: column;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add assets/component-mega-menu.css
git commit -m "style: add mega menu promotion tile styles"
```

---

### Task 7: Enable mega menu type and seed the example promo block

**Files:**
- Modify: `sections/header-group.json`

**Interfaces:**
- Consumes: `mega_menu_promotion` block type from Task 4.

- [ ] **Step 1: Switch desktop menu type to mega and add a seed block**

In `sections/header-group.json`, find:

```json
    "header": {
      "type": "header",
      "settings": {
        "color_scheme": "scheme-1",
        "menu_color_scheme": "scheme-1",
        "logo_position": "middle-left",
        "menu": "main-menu",
        "menu_type_desktop": "dropdown",
        "sticky_header_type": "on-scroll-up",
        "show_line_separator": true,
        "enable_country_selector": true,
        "enable_language_selector": true,
        "enable_customer_avatar": true,
        "mobile_logo_position": "center",
        "margin_bottom": 0,
        "padding_top": 20,
        "padding_bottom": 20
      }
    }
```

Replace with:

```json
    "header": {
      "type": "header",
      "blocks": {
        "mega-menu-promo-clans": {
          "type": "mega_menu_promotion",
          "settings": {
            "menu_item_title": "Find Your Clans",
            "heading": "Find Your Tartan",
            "link": "/collections/all",
            "link_label": "Shop now"
          }
        }
      },
      "block_order": [
        "mega-menu-promo-clans"
      ],
      "settings": {
        "color_scheme": "scheme-1",
        "menu_color_scheme": "scheme-1",
        "logo_position": "middle-left",
        "menu": "main-menu",
        "menu_type_desktop": "mega",
        "sticky_header_type": "on-scroll-up",
        "show_line_separator": true,
        "enable_country_selector": true,
        "enable_language_selector": true,
        "enable_customer_avatar": true,
        "mobile_logo_position": "center",
        "margin_bottom": 0,
        "padding_top": 20,
        "padding_bottom": 20
      }
    }
```

- [ ] **Step 2: Validate JSON**

Run: `python3 -c "import json; json.load(open('sections/header-group.json')); print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add sections/header-group.json
git commit -m "feat: enable mega menu and seed example promotion tile"
```

---

### Task 8: Theme Check and manual QA

**Files:** none (verification only)

**Interfaces:**
- Consumes: all prior tasks' output, plus the live navigation/pages from Task 3.

- [ ] **Step 1: Run Theme Check**

Run: `shopify theme check`
Expected: no new offenses introduced by `sections/header.liquid`, `snippets/header-mega-menu.liquid`, `assets/component-mega-menu.css`, or `sections/header-group.json`. (Pre-existing Dawn offenses, if any, are out of scope.)

- [ ] **Step 2: Start local preview**

Run: `shopify theme dev --store nongsanhaiduong.myshopify.com`
Expected: CLI prints a local preview URL (typically `http://127.0.0.1:9292`).

- [ ] **Step 3: Desktop mega menu check**

Open the preview URL in a desktop-width browser window (≥ 990px). Click "Find Your Clans" — confirm a flyout opens showing 5 link columns (Clans A-L, Clans M-Y, Canada Province Tartan, Ireland County Tartan A-K, Ireland County Tartan L-W) plus the "Find Your Tartan" promo tile with placeholder image to the right. Click "For Men" and "For Women" — confirm their flyouts open with the correct columns and no promo tile (since no block targets them).

- [ ] **Step 4: Mobile drawer check**

Resize the browser to < 750px (or use device emulation). Click the hamburger icon — confirm the drawer opens. Tap "Find Your Clans" — confirm it drills into the 5 sub-links with a back button, and no promo tile appears in the drawer.

- [ ] **Step 5: Regression check on unaffected header features**

Confirm: sticky header still reveals/hides on scroll, the search icon opens the predictive search modal, the account icon links to login, and the cart icon shows the item count bubble after adding a product to cart.

- [ ] **Step 6: Stop the dev server**

Press `Ctrl+C` in the terminal running `shopify theme dev`.

(No commit — this task is verification only. If any step fails, fix the relevant task's file and re-commit before proceeding.)
