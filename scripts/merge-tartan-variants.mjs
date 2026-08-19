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

  const html2 = buildMergedBodyHtml('Pillow Cover', ['Saskatchewan', 'Yukon']);
  assert.ok(html2.includes('Saskatchewan tartan'), 'must contain "Saskatchewan tartan" for search');
  assert.ok(html2.includes('Yukon tartan'), 'must contain "Yukon tartan" for search');

  const html3 = buildMergedBodyHtml('Bedding Set', ['Alberta', 'Antrim', 'Argyll']);
  for (const name of ['Alberta', 'Antrim', 'Argyll']) {
    assert.ok(html3.includes(`${name} tartan`), `must contain "${name} tartan" for search`);
  }

  console.log('selftest OK');
}

if (process.argv.includes('--selftest')) {
  selfTest();
  process.exit(0);
}

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

  // Check vendor and product_type consistency within each group
  for (const g of groups) {
    const firstMember = g.members[0];
    const baseVendor = firstMember.product.vendor;
    const baseProductType = firstMember.product.product_type;

    for (let i = 1; i < g.members.length; i++) {
      const member = g.members[i];
      if (member.product.vendor !== baseVendor || member.product.product_type !== baseProductType) {
        console.warn(`WARNING: group "${g.itemName}" has inconsistent vendor/product_type across members`);
        break;
      }
    }
  }

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
