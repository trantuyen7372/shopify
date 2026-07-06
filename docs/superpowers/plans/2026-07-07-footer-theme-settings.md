# Footer & Theme Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the tartan-shop theme rebuild's final phase: two new footer navigation menus (Shop By Category, Customer Care), two new placeholder pages (FAQs, Order Tracking), and wiring Dawn's existing footer block types (`link_list`, `text`, `brand_information`) into `sections/footer-group.json` — no changes to `config/settings_schema.json`, since Dawn already covers every theme-settings requirement in scope.

**Architecture:** A standalone Admin API script (mirroring Phase 1's `setup-navigation.mjs` pattern, not importing it) creates the two menus and two pages. A JSON config change adds four blocks to the existing footer section. Both are independent, mechanical changes.

**Tech Stack:** Node 23 (built-in `fetch`, `--env-file`), Shopify Admin GraphQL API, Shopify Dawn JSON section config.

## Global Constraints

- No copyrighted assets, images, logos, exact brand name, exact text, or proprietary code from any reference site — all seed copy is original placeholder.
- Do not hardcode products; leaf navigation links point to `/collections/all` as an explicit placeholder (consistent with Phases 1-3).
- Do not modify `config/settings_schema.json` — no gap exists there.
- Secrets (Admin API token) must never be committed; reuse the existing gitignored `.env` convention from Phase 1 (`SHOPIFY_STORE_DOMAIN`, `SHOPIFY_ADMIN_TOKEN`).
- Theme code must pass `shopify theme check` with no new offense types vs. the Phase 3 baseline (173 files, 57 offenses).
- Leave global social-media/address settings blank — no fake accounts or addresses.

---

### Task 1: Footer navigation & pages script

**Files:**
- Create: `scripts/setup-footer-navigation.mjs`

**Interfaces:**
- Consumes: `.env` convention from Phase 1 (`SHOPIFY_STORE_DOMAIN`, `SHOPIFY_ADMIN_TOKEN`).
- Produces: no exports (standalone CLI script, same as Phase 1's `setup-navigation.mjs`); run via `node --env-file=.env scripts/setup-footer-navigation.mjs [--dry-run]`.

- [ ] **Step 1: Write `scripts/setup-footer-navigation.mjs`**

```js
#!/usr/bin/env node
// Provisions the tartan-shop footer navigation menus and placeholder
// pages via the Shopify Admin GraphQL API.
//
// Usage:
//   node --env-file=.env scripts/setup-footer-navigation.mjs [--dry-run]

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

const footerMenus = [
  {
    handle: 'footer-shop-by-category',
    title: 'Footer Shop By Category',
    items: [
      { title: 'Shop By Clan & Tartan', url: '/collections/all' },
      { title: "Men's Tartan Collection", url: '/collections/all' },
      { title: "Women's Tartan Collection", url: '/collections/all' },
      { title: 'Tartan Flat Cap', url: '/collections/all' },
      { title: 'Tartan Polos', url: '/collections/all' },
      { title: 'Tartan Tees', url: '/collections/all' },
      { title: 'Home Decor', url: '/collections/all' },
    ],
  },
  {
    handle: 'footer-customer-care',
    title: 'Footer Customer Care',
    items: [
      { title: 'FAQs', url: '/pages/faqs' },
      { title: 'Blog', url: '/blogs/news' },
      { title: 'About Us', url: '/pages/about-us' },
      { title: 'Contact Us', url: '/pages/contact-us' },
      { title: 'Order Tracking', url: '/pages/order-tracking' },
    ],
  },
];

const pagesToEnsure = [
  {
    handle: 'faqs',
    title: 'FAQs',
    body: '<p>Answers to common questions go here. Replace this placeholder with your real FAQ content.</p>',
  },
  {
    handle: 'order-tracking',
    title: 'Order Tracking',
    body: '<p>Enter your order number and email to track your shipment. Replace this placeholder with real tracking instructions or an app embed.</p>',
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

async function findMenuByHandle(handle) {
  const data = await adminGraphql(`
    query {
      menus(first: 50) {
        nodes { id handle title }
      }
    }
  `);
  return data.menus.nodes.find((m) => m.handle === handle) || null;
}

async function ensureMenu(menuDef, baseUrl) {
  const items = menuDef.items.map((node) => toMenuItemInput(node, baseUrl));
  if (dryRun) {
    console.log(`--dry-run: menu "${menuDef.handle}" payload:`);
    console.log(JSON.stringify(items, null, 2));
    return;
  }
  const existing = await findMenuByHandle(menuDef.handle);
  if (existing) {
    const data = await adminGraphql(
      `
        mutation UpdateFooterMenu($id: ID!, $title: String!, $items: [MenuItemUpdateInput!]!) {
          menuUpdate(id: $id, title: $title, items: $items) {
            menu { id handle }
            userErrors { field message }
          }
        }
      `,
      { id: existing.id, title: menuDef.title, items }
    );
    const { userErrors, menu } = data.menuUpdate;
    if (userErrors.length) {
      throw new Error(`menuUpdate userErrors for "${menuDef.handle}": ${JSON.stringify(userErrors)}`);
    }
    console.log(`Updated menu ${menu.handle} (${menu.id})`);
    return;
  }
  const data = await adminGraphql(
    `
      mutation CreateFooterMenu($title: String!, $handle: String, $items: [MenuItemCreateInput!]!) {
        menuCreate(title: $title, handle: $handle, items: $items) {
          menu { id handle }
          userErrors { field message }
        }
      }
    `,
    { title: menuDef.title, handle: menuDef.handle, items }
  );
  const { userErrors, menu } = data.menuCreate;
  if (userErrors.length) {
    throw new Error(`menuCreate userErrors for "${menuDef.handle}": ${JSON.stringify(userErrors)}`);
  }
  console.log(`Created menu ${menu.handle} (${menu.id})`);
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
  for (const menuDef of footerMenus) {
    await ensureMenu(menuDef, baseUrl);
  }
  await ensurePages();
  console.log(dryRun ? 'Dry run complete.' : 'Footer navigation setup complete.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
```

- [ ] **Step 2: Syntax-check the script**

Run: `node --check scripts/setup-footer-navigation.mjs`
Expected: no output (exits 0).

- [ ] **Step 3: Commit**

```bash
git add scripts/setup-footer-navigation.mjs
git commit -m "feat: add Admin API script to provision footer navigation menus and pages"
```

---

### Task 2: Provision the dev store (live run)

**Files:** none (operational task against the `nongsanhaiduong` dev store)

**Interfaces:**
- Consumes: `scripts/setup-footer-navigation.mjs` from Task 1; the same `.env` file already created locally during Phase 1 (not committed — if it's missing in this checkout, recreate it following Phase 1's instructions: copy `.env.example` to `.env` and fill in `SHOPIFY_STORE_DOMAIN=nongsanhaiduong.myshopify.com` and the Admin API token from the "Theme Setup" custom app created in Phase 1 — the same app/token works here since it already has `write_online_store_navigation` and `write_content` scopes).

- [ ] **Step 1: Dry run**

Run: `node --env-file=.env scripts/setup-footer-navigation.mjs --dry-run`
Expected: prints the two menus' item payloads (7 items for `footer-shop-by-category`, 5 for `footer-customer-care`) and 2 "would create page" lines, then "Dry run complete." No network mutation occurs.

**Known risk (from Phase 1's experience):** the exact GraphQL field/type names for `menuCreate` (`MenuItemCreateInput`, whether `items` is nullable) may not exactly match what's written above — Phase 1 discovered `menuUpdate` needed adjustments only after a live run rejected the initially-written mutation. If the live run in Step 2 below errors, read the exact GraphQL error message and adjust the mutation string in `scripts/setup-footer-navigation.mjs` to match (e.g. add a missing required argument, or fix a nullability mismatch), then re-run. This is expected debugging, not a sign the task was done wrong.

- [ ] **Step 2: Live run**

Run: `node --env-file=.env scripts/setup-footer-navigation.mjs`
Expected: "Created menu footer-shop-by-category (...)", "Created menu footer-customer-care (...)", "Created page \"faqs\" (...)", "Created page \"order-tracking\" (...)", then "Footer navigation setup complete." If any mutation errors, fix the script per the note above and re-run.

- [ ] **Step 3: Verify idempotency**

Run: `node --env-file=.env scripts/setup-footer-navigation.mjs`
Expected: "Updated menu footer-shop-by-category (...)", "Updated menu footer-customer-care (...)", "Page \"faqs\" already exists, skipping.", "Page \"order-tracking\" already exists, skipping.", then "Footer navigation setup complete." — no duplicates, no errors.

- [ ] **Step 4: Commit any script fixes made during Steps 1-3**

If Step 2 required adjusting the mutation in `scripts/setup-footer-navigation.mjs`, commit that fix:

```bash
git add scripts/setup-footer-navigation.mjs
git commit -m "fix: correct footer menu GraphQL shape for live Admin API"
```

(If no fix was needed, skip this step — no commit.)

---

### Task 3: Assemble the footer

**Files:**
- Modify: `sections/footer-group.json`

**Interfaces:**
- Consumes: menu handles `footer-shop-by-category` and `footer-customer-care` from Task 1/2; Dawn's existing `link_list`, `text`, and `brand_information` footer block types (no code changes — already defined in `sections/footer.liquid`).

- [ ] **Step 1: Add footer blocks**

In `sections/footer-group.json`, find:

```json
    "footer": {
      "type": "footer",
      "blocks": {},
      "block_order": [],
      "settings": {
```

Replace with:

```json
    "footer": {
      "type": "footer",
      "blocks": {
        "shop_by_category": {
          "type": "link_list",
          "settings": {
            "heading": "Shop By Category",
            "menu": "footer-shop-by-category"
          }
        },
        "customer_care": {
          "type": "link_list",
          "settings": {
            "heading": "Customer Care",
            "menu": "footer-customer-care"
          }
        },
        "connect_us": {
          "type": "text",
          "settings": {
            "heading": "Connect With Us",
            "subtext": "<p>123 Placeholder Street, Anytown, USA</p><p>hello@example.com</p>"
          }
        },
        "brand": {
          "type": "brand_information",
          "settings": {
            "show_social": true
          }
        }
      },
      "block_order": [
        "shop_by_category",
        "customer_care",
        "connect_us",
        "brand"
      ],
      "settings": {
```

- [ ] **Step 2: Validate JSON**

Run: `python3 -c "import json; json.load(open('sections/footer-group.json')); print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add sections/footer-group.json
git commit -m "feat: assemble footer with shop/customer-care link lists and contact info"
```

---

### Task 4: Theme Check and manual QA

**Files:** none (verification only)

**Interfaces:**
- Consumes: all prior tasks' output.

- [ ] **Step 1: Run Theme Check**

Run: `shopify theme check`
Expected: no new offense types introduced by `scripts/setup-footer-navigation.mjs` or `sections/footer-group.json`. (Baseline: 173 files, 57 pre-existing offenses, unrelated to this branch's files.)

- [ ] **Step 2: Start local preview**

Run: `shopify theme dev --store nongsanhaiduong.myshopify.com`
Expected: CLI prints a local preview URL and completes the initial sync with no "Upload Errors".

- [ ] **Step 3: Footer content check**

Open any page and scroll to the footer. Confirm: "Shop By Category" column with 7 links, "Customer Care" column with 5 links, "Connect With Us" with the placeholder address/email text, brand/social block (social icons only appear if a social link is set — currently none are, so confirm this degrades gracefully with no broken icons), payment icons row, and policy links row (may be empty if no Shopify policies are filled in yet — that's expected, not a bug) all render without errors.

- [ ] **Step 4: Regression check**

Confirm the newsletter signup block (Dawn's existing default footer content) still renders above the new blocks, and the copyright row at the very bottom still shows correctly.

- [ ] **Step 5: Stop the dev server**

Press `Ctrl+C` in the terminal running `shopify theme dev`.

(No commit — this task is verification only. If any step fails, fix the relevant task's file and re-commit before proceeding.)
