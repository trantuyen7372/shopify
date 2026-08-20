# Catalog Tartan Variant Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the 222-product per-tartan catalog into ~120 products by giving each item type one product with a real "Tartan" variant option (combined with the existing "Size" option for apparel), eliminating the per-tartan product duplication while keeping every product purchasable with its real photo/price/inventory.

**Architecture:** A single Node script (`scripts/merge-tartan-variants.mjs`) with pure, unit-testable functions for grouping and content generation, plus live-API functions for the actual Admin REST calls (create product → assign variant images → verify on live data → delete source products). Run in discovery mode first to produce a manifest, then per-group, then as a full batch — each stage checkpointed before the next.

**Tech Stack:** Node 23 (global `fetch`, `--env-file`), Shopify Admin REST API 2024-10, `node:assert` for pure-function unit tests (this repo has no test framework — matches the existing `scripts/*.mjs` convention).

**Spec:** `docs/superpowers/specs/2026-08-20-catalog-tartan-variant-merge-design.md`

## Global Constraints

- No theme/Liquid code changes — `templates/product.json`'s `variant_picker` block already renders any option a product has.
- No merge group may exceed 100 variants (Shopify's per-product limit). Verified in the spec that none do; the discovery step must still assert this live rather than trust the cached number.
- Every merged product's `body_html` MUST contain the literal phrase `"<Tartan Name> tartan"` for every tartan folded into it (case as originally titled), or `/search?q="<Name>+tartan"` links from `sections/find-your-clans.liquid` and `snippets/clan-finder-sidebar.liquid` will stop resolving to that product (confirmed failure mode in the Pillow Cover pilot).
- Group by product title suffix (text after `<Tartan> Tartan `), not by tags — tags are inconsistently applied across the catalog (see spec's Data Quality Note).
- Never delete source products for a group until the merged replacement has been created, had its variant images assigned, and passed verification.
- Rate-limit Admin REST calls: Shopify's leaky bucket allows ~2 req/sec sustained. Sleep ~550ms between write calls.
- `.env` holds `SHOPIFY_STORE_DOMAIN` and `SHOPIFY_ADMIN_TOKEN` — load via `node --env-file=.env`. Per `[[shopify-custom-app-oauth-2026]]`, the token expires ~24h after issuance; if a run starts failing with 401s, the token needs re-minting via the client-credentials exchange before continuing (this plan does not automate that — surface the error and stop).

---

### Task 1: Group discovery

**Files:**
- Create: `scripts/merge-tartan-variants.mjs`

**Interfaces:**
- Produces: `extractTartanAndName(title: string): { tartan: string, itemName: string } | null`
- Produces: `buildGroups(products: Array<ShopifyProduct>): Array<{ itemName: string, members: Array<{ tartan: string, product: ShopifyProduct }> }>` — only groups with 2+ members
- Produces: `restGet(path: string): Promise<any>`, `restRequest(method: string, path: string, body?: object): Promise<any>` — shared REST helpers used by every later task

- [ ] **Step 1: Write the pure grouping functions with inline self-tests**

```js
#!/usr/bin/env node
// scripts/merge-tartan-variants.mjs
// Merges the per-tartan product catalog into one product per item type,
// using a real "Tartan" variant option (see
// docs/superpowers/specs/2026-08-20-catalog-tartan-variant-merge-design.md).
//
// Usage:
//   node --env-file=.env scripts/merge-tartan-variants.mjs --selftest
//   node --env-file=.env scripts/merge-tartan-variants.mjs --discover
//   node --env-file=.env scripts/merge-tartan-variants.mjs --group "Pillow Cover" [--dry-run]
//   node --env-file=.env scripts/merge-tartan-variants.mjs --all [--dry-run]

import assert from 'node:assert/strict';

const domain = process.env.SHOPIFY_STORE_DOMAIN;
const token = process.env.SHOPIFY_ADMIN_TOKEN;
const API_VERSION = '2024-10';

function extractTartanAndName(title) {
  const m = title.match(/^(.*?)\s+Tartan[- ]?(?:Trim )?(.*)$/);
  if (!m || !m[2].trim()) return null;
  return { tartan: m[1].trim(), itemName: m[2].trim() };
}

function buildGroups(products) {
  const byName = new Map();
  for (const product of products) {
    const parsed = extractTartanAndName(product.title);
    if (!parsed) continue;
    const { tartan, itemName } = parsed;
    if (!byName.has(itemName)) byName.set(itemName, []);
    byName.get(itemName).push({ tartan, product });
  }
  return [...byName.entries()]
    .filter(([, members]) => members.length >= 2)
    .map(([itemName, members]) => ({ itemName, members }));
}

function maxVariantCount(group) {
  const sizeOption = group.members[0].product.options.find((o) => o.name === 'Size');
  const sizeCount = sizeOption ? sizeOption.values.length : 1;
  return group.members.length * sizeCount;
}

function selfTest() {
  assert.deepEqual(
    extractTartanAndName('Alberta Tartan Bedding Set'),
    { tartan: 'Alberta', itemName: 'Bedding Set' }
  );
  assert.deepEqual(
    extractTartanAndName('Saskatchewan Tartan Pillow Cover'),
    { tartan: 'Saskatchewan', itemName: 'Pillow Cover' }
  );
  assert.equal(extractTartanAndName('Tartan Pillow Cover'), null, 'no tartan prefix -> null');

  const fixtureProducts = [
    { title: 'Alberta Tartan Bedding Set', options: [{ name: 'Title', values: ['Default Title'] }] },
    { title: 'Antrim Tartan Bedding Set', options: [{ name: 'Title', values: ['Default Title'] }] },
    { title: 'Alberta Tartan Bow Tie', options: [{ name: 'Title', values: ['Default Title'] }] },
  ];
  const groups = buildGroups(fixtureProducts);
  assert.equal(groups.length, 1, 'only Bedding Set has 2+ members in the fixture');
  assert.equal(groups[0].itemName, 'Bedding Set');
  assert.equal(groups[0].members.length, 2);

  const sizedGroup = {
    itemName: 'T-Shirt',
    members: [
      { tartan: 'A', product: { options: [{ name: 'Size', values: ['S', 'M', 'L', 'XL'] }] } },
      { tartan: 'B', product: { options: [{ name: 'Size', values: ['S', 'M', 'L', 'XL'] }] } },
    ],
  };
  assert.equal(maxVariantCount(sizedGroup), 8);

  console.log('selftest OK');
}

if (process.argv.includes('--selftest')) {
  selfTest();
  process.exit(0);
}
```

- [ ] **Step 2: Run the self-test**

Run: `node scripts/merge-tartan-variants.mjs --selftest`
Expected: prints `selftest OK` and exits 0. (No `.env` needed for this mode — it never touches the network.)

- [ ] **Step 3: Add the REST helpers and `--discover` mode, verified against live data**

```js
async function restRequest(method, path, body) {
  const response = await fetch(`https://${domain}/admin/api/${API_VERSION}${path}`, {
    method,
    headers: {
      'X-Shopify-Access-Token': token,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${method} ${path} -> ${response.status}: ${text}`);
  }
  return response.status === 204 ? null : response.json();
}

const restGet = (path) => restRequest('GET', path);

async function fetchAllProducts() {
  const fields = 'id,title,tags,body_html,images,options,variants,product_type,vendor';
  const data = await restGet(`/products.json?limit=250&fields=${fields}`);
  return data.products;
}

async function discover() {
  const products = await fetchAllProducts();
  const groups = buildGroups(products);
  const overflow = groups.filter((g) => maxVariantCount(g) > 100);
  console.log(`Total products: ${products.length}`);
  console.log(`Merge groups (2+ members): ${groups.length}`);
  console.log(`Products covered by merges: ${groups.reduce((n, g) => n + g.members.length, 0)}`);
  console.log(`Overflow groups (>100 variants): ${overflow.length}`);
  if (overflow.length) {
    console.log(overflow.map((g) => `${g.itemName}: ${maxVariantCount(g)}`).join('\n'));
  }
  for (const g of groups.sort((a, b) => b.members.length - a.members.length)) {
    console.log(`${g.itemName} (${g.members.length}): ${g.members.map((m) => m.tartan).join(', ')}`);
  }
}

if (process.argv.includes('--discover')) {
  await discover();
  process.exit(0);
}
```

Run: `node --env-file=.env scripts/merge-tartan-variants.mjs --discover`
Expected: `Merge groups (2+ members): 94`, `Overflow groups (>100 variants): 0`, and a full listing of every group with its member tartans — cross-check a handful of lines (e.g. `Pillow Cover` should now show only 0 members since it was already merged in the pilot and no longer matches the title pattern; `Bomber Jacket`, `Ankle Boots`, `Tote Bag` etc. should appear even though they lacked narrow tags, since this groups by title, not tags).

- [ ] **Step 4: Commit**

```bash
git add scripts/merge-tartan-variants.mjs
git commit -m "feat: add catalog merge script with group discovery"
```

---

### Task 2: Merged product body_html generator

**Files:**
- Modify: `scripts/merge-tartan-variants.mjs`

**Interfaces:**
- Consumes: nothing new
- Produces: `buildMergedBodyHtml(itemName: string, tartanNames: string[]): string`

- [ ] **Step 1: Write the generator with a self-test asserting the search-critical phrase is present for every tartan**

```js
function buildMergedBodyHtml(itemName, tartanNames) {
  const itemLower = itemName.toLowerCase();
  const tartanSentence = tartanNames.length === 2
    ? `${tartanNames[0]} tartan and ${tartanNames[1]} tartan`
    : `${tartanNames.slice(0, -1).map((t) => `${t} tartan`).join(', ')}, and ${tartanNames[tartanNames.length - 1]} tartan`;

  return (
    `<p>Bring a tartan into your everyday with this ${itemLower}. ` +
    `Available in ${tartanSentence} — choose yours below.</p>` +
    `<h3>Product Details</h3>` +
    `<ul>` +
    `<li>Printed or woven in an authentic tartan sett</li>` +
    `<li>Made from quality materials built to last</li>` +
    `<li>A distinctive way to carry your heritage</li>` +
    `</ul>` +
    `<h3>Care Instructions</h3>` +
    `<p>Follow standard care for the material — spot clean fabric pieces, machine wash cold where applicable.</p>` +
    `<p>Not sure about your clan? Visit our <a href="/pages/find-your-clans">Find Your Clans</a> page to explore the tartan that reflects your heritage.</p>`
  );
}
```

Add to `selfTest()`:

```js
  const html2 = buildMergedBodyHtml('Pillow Cover', ['Saskatchewan', 'Yukon']);
  assert.ok(html2.includes('Saskatchewan tartan'), 'must contain "Saskatchewan tartan" for search');
  assert.ok(html2.includes('Yukon tartan'), 'must contain "Yukon tartan" for search');

  const html3 = buildMergedBodyHtml('Bedding Set', ['Alberta', 'Antrim', 'Argyll']);
  for (const name of ['Alberta', 'Antrim', 'Argyll']) {
    assert.ok(html3.includes(`${name} tartan`), `must contain "${name} tartan" for search`);
  }
```

- [ ] **Step 2: Run the self-test**

Run: `node scripts/merge-tartan-variants.mjs --selftest`
Expected: `selftest OK`

- [ ] **Step 3: Commit**

```bash
git add scripts/merge-tartan-variants.mjs
git commit -m "feat: add merged product description generator"
```

---

### Task 3: Single-group merge execution

**Files:**
- Modify: `scripts/merge-tartan-variants.mjs`

**Interfaces:**
- Consumes: `restRequest`, `buildMergedBodyHtml`, group shape from Task 1
- Produces: `buildMergedProductPayload(group): object`, `mergeGroup(group, { dryRun }): Promise<void>`

- [ ] **Step 1: Write the payload builder and merge executor**

```js
function buildMergedProductPayload(group) {
  const { itemName, members } = group;
  const first = members[0].product;
  const sizeOption = first.options.find((o) => o.name === 'Size');
  const tags = [...new Set(members.flatMap((m) => m.product.tags.split(',').map((t) => t.trim())).filter(Boolean))];

  const options = [{ name: 'Tartan', values: members.map((m) => m.tartan) }];
  if (sizeOption) options.push({ name: 'Size', values: sizeOption.values });

  const variants = [];
  for (const member of members) {
    const sourceVariants = member.product.variants;
    if (sizeOption) {
      for (const size of sizeOption.values) {
        const sourceVariant = sourceVariants.find((v) => v.title === size || v.option1 === size);
        variants.push({
          option1: member.tartan,
          option2: size,
          price: sourceVariant ? sourceVariant.price : sourceVariants[0].price,
        });
      }
    } else {
      variants.push({ option1: member.tartan, price: sourceVariants[0].price });
    }
  }

  return {
    title: `Tartan ${itemName}`,
    vendor: first.vendor,
    product_type: first.product_type,
    tags: tags.join(', '),
    body_html: buildMergedBodyHtml(itemName, members.map((m) => m.tartan)),
    options,
    variants,
    images: members.map((m) => ({ src: m.product.images[0].src })),
  };
}

async function assignVariantImages(newProduct, group) {
  // Images come back in the same order they were submitted (one per member, by tartan).
  for (let i = 0; i < group.members.length; i++) {
    const tartan = group.members[i].tartan;
    const image = newProduct.images[i];
    const variantsForTartan = newProduct.variants.filter((v) => v.option1 === tartan);
    for (const variant of variantsForTartan) {
      await restRequest('PUT', `/variants/${variant.id}.json`, {
        variant: { id: variant.id, image_id: image.id },
      });
      await new Promise((r) => setTimeout(r, 550));
    }
  }
}

async function verifyMerge(newProduct, group) {
  for (const member of group.members) {
    const query = encodeURIComponent(`"${member.tartan} tartan"`);
    // Storefront search isn't reachable via Admin API; this checks the
    // necessary precondition instead — the phrase is present in the
    // product we just created, which is what makes search work.
    if (!newProduct.body_html.includes(`${member.tartan} tartan`)) {
      throw new Error(`Verification failed: body_html missing "${member.tartan} tartan" (query would be ${query})`);
    }
  }
  const expectedVariantCount = group.members.length * (newProduct.options.find((o) => o.name === 'Size')?.values.length || 1);
  if (newProduct.variants.length !== expectedVariantCount) {
    throw new Error(`Verification failed: expected ${expectedVariantCount} variants, got ${newProduct.variants.length}`);
  }
}

async function mergeGroup(group, { dryRun }) {
  const payload = buildMergedProductPayload(group);
  console.log(`\n=== ${group.itemName} (${group.members.length} tartans) ===`);
  if (dryRun) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  const { product: newProduct } = await restRequest('POST', '/products.json', { product: payload });
  console.log(`Created product ${newProduct.id} (${newProduct.handle})`);
  await new Promise((r) => setTimeout(r, 550));

  await assignVariantImages(newProduct, group);
  await verifyMerge(newProduct, group);
  console.log('Verified OK');

  for (const member of group.members) {
    await restRequest('DELETE', `/products/${member.product.id}.json`);
    console.log(`Deleted source product ${member.product.id} (${member.product.title})`);
    await new Promise((r) => setTimeout(r, 550));
  }
}

if (process.argv.includes('--group')) {
  const name = process.argv[process.argv.indexOf('--group') + 1];
  const dryRun = process.argv.includes('--dry-run');
  const products = await fetchAllProducts();
  const groups = buildGroups(products);
  const group = groups.find((g) => g.itemName === name);
  if (!group) throw new Error(`No group found for "${name}"`);
  await mergeGroup(group, { dryRun });
  process.exit(0);
}
```

- [ ] **Step 2: Dry-run against one real small group**

Run: `node --env-file=.env scripts/merge-tartan-variants.mjs --group "Bow Tie" --dry-run`
Expected: prints the would-be product payload (title `Tartan Bow Tie`, one `Tartan` option, no `Size` option, 2 variants) without creating or deleting anything. Confirm by running `--discover` again afterward and seeing the same 94 groups (nothing changed).

- [ ] **Step 3: Run for real against that one group**

Run: `node --env-file=.env scripts/merge-tartan-variants.mjs --group "Bow Tie"`
Expected: creates `Tartan Bow Tie`, assigns images, passes verification, deletes the 2 source products, prints no errors.

- [ ] **Step 4: Manually confirm on the live storefront**

- Push nothing (no theme files changed) — the new product is visible immediately at its handle.
- Open `https://kilt4less.uk/products/tartan-bow-tie` and confirm the Tartan variant picker renders with both names, switching updates the image.
- Open `https://kilt4less.uk/search?q=%22Alberta+tartan%22` (or whichever tartan was in this group) and confirm `Tartan Bow Tie` appears in results.

- [ ] **Step 5: Commit**

```bash
git add scripts/merge-tartan-variants.mjs
git commit -m "feat: add single-group merge execution with verification"
```

---

### Task 4: Batch runner for all remaining groups

**Files:**
- Modify: `scripts/merge-tartan-variants.mjs`

**Interfaces:**
- Consumes: `mergeGroup`, `buildGroups`, `fetchAllProducts`
- Produces: `--all` CLI mode

- [ ] **Step 1: Add the `--all` batch mode — re-fetches and re-groups before every single group (so a completed merge is never revisited) and stops on first error, printing which groups are done**

```js
if (process.argv.includes('--all')) {
  const dryRun = process.argv.includes('--dry-run');
  const done = [];
  const failed = [];
  for (;;) {
    const products = await fetchAllProducts();
    const groups = buildGroups(products);
    if (groups.length === 0) break;
    const group = groups[0];
    try {
      await mergeGroup(group, { dryRun });
      done.push(group.itemName);
    } catch (err) {
      console.error(`FAILED on "${group.itemName}": ${err.message}`);
      failed.push(group.itemName);
      break;
    }
    if (dryRun) break; // dry-run only previews the next group, doesn't loop
  }
  console.log(`\nDone: ${done.length} groups merged.`);
  if (failed.length) console.log(`Stopped due to failure in: ${failed.join(', ')}`);
  process.exit(failed.length ? 1 : 0);
}
```

- [ ] **Step 2: Dry-run to confirm it picks up the next real group correctly**

Run: `node --env-file=.env scripts/merge-tartan-variants.mjs --all --dry-run`
Expected: prints exactly one group's payload (the first one returned by `buildGroups` on current live data — `Bow Tie` is already gone from Task 3, so this will be whichever group sorts first) and exits.

- [ ] **Step 3: Run for real on the full remaining batch**

Run: `node --env-file=.env scripts/merge-tartan-variants.mjs --all 2>&1 | tee /tmp/merge-run.log`
Expected: processes all remaining ~93 groups one at a time, printing `Created`, `Verified OK`, and `Deleted` lines for each, ending with `Done: 93 groups merged.` and exit code 0. If it stops early with a `FAILED` line, that group's source products are untouched (verification runs before any delete) — fix the reported issue and re-run the same command; already-merged groups won't reappear since `buildGroups` re-reads live data every iteration.

If the run dies with 401 errors partway through, the Admin token expired (~24h lifetime per `[[shopify-custom-app-oauth-2026]]`) — stop, get a fresh token minted into `.env`, and re-run the same `--all` command; it resumes from wherever it left off since it re-derives the remaining groups from live data each time.

- [ ] **Step 4: Commit**

```bash
git add scripts/merge-tartan-variants.mjs
git commit -m "feat: add full-catalog batch merge runner"
```

---

### Task 5: Post-migration verification

**Files:**
- None created/modified — this is a verification-only task using existing tools (Admin API curl checks + Playwright browser checks, same as used throughout this session).

**Interfaces:**
- Consumes: the live, fully-migrated catalog

- [ ] **Step 1: Confirm final product count and zero remaining mergeable groups**

Run: `node --env-file=.env scripts/merge-tartan-variants.mjs --discover`
Expected: `Merge groups (2+ members): 0` (or only groups intentionally left out, if any were skipped), and `Total products` around 120 (94 merged products + 25 untouched singles + the earlier Pillow Cover pilot product).

- [ ] **Step 2: Spot-check 5 merged products on the live storefront across different categories (apparel-with-size, footwear, home decor, accessory)**

For each, open its `/products/<handle>` page on `https://kilt4less.uk` and confirm:
- The Tartan variant picker (and Size picker, where applicable) renders and switching Tartan changes the image and price.
- Breadcrumb still resolves correctly (uses the existing `snippets/breadcrumb.liquid` logic — no change needed, but worth confirming it doesn't break on a product with 2 options).
- `Add to cart` / `Buy it now` are enabled (this catalog's variants are untracked inventory, same as before the merge, so this should already work — confirm it didn't regress).

- [ ] **Step 3: Spot-check that Find Your Clans search links still resolve for a merged product's tartans**

Open `https://kilt4less.uk/pages/find-your-clans`, pick 2-3 tartan names that were folded into different merge groups, click through, and confirm the resulting `/search` page includes the corresponding merged product.

- [ ] **Step 4: Report final numbers to the user**

Summarize: starting product count (222), ending count, number of groups merged, any groups skipped and why (e.g. a data anomaly caught during the run), and confirmation that the spot-checks in Steps 2-3 passed.
