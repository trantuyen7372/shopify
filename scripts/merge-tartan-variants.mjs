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

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 3;

async function restRequest(method, path, body) {
  let url = `https://${domain}/admin/api/${API_VERSION}${path}`;
  const headers = {
    'X-Shopify-Access-Token': token,
    'Content-Type': 'application/json',
  };
  const requestBody = body ? JSON.stringify(body) : undefined;

  let response;
  for (let redirects = 0; ; redirects++) {
    // Fetch's automatic redirect-following downgrades POST/PUT/DELETE to GET
    // and drops the body on a 301/302 (per the Fetch spec). The Admin API
    // custom-domain host 301s to the canonical myshopify.com host, which
    // would otherwise silently turn every mutating call into a no-op GET.
    // So we follow redirects manually, re-issuing the SAME method/headers/body.
    response = await fetch(url, { method, headers, body: requestBody, redirect: 'manual' });
    if (!REDIRECT_STATUSES.has(response.status)) break;
    if (redirects >= MAX_REDIRECTS) {
      throw new Error(`${method} ${path} -> too many redirects (stopped after ${MAX_REDIRECTS})`);
    }
    const location = response.headers.get('location');
    if (!location) {
      throw new Error(`${method} ${path} -> ${response.status} redirect with no Location header`);
    }
    url = new URL(location, url).toString();
  }

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
