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

// Some groups contain two separate products with the identical tartan name
// (a genuine catalog data-quality issue, not a bug in extractTartanAndName —
// e.g. two distinct "Lindsay Tartan Leggings" products). Merging both as-is
// would produce two variants with the same option1 value, which Shopify
// rejects (or silently mishandles) as a duplicate option combination. Keep
// exactly one member per tartan name — preferring whichever product's tags
// look more specific to the item type — and record the other for deletion
// alongside the group's normal source products.
function dedupeGroupMembers(itemName, members) {
  const itemWords = itemName.toLowerCase().split(/\s+/).filter(Boolean);
  const tagsOf = (member) => member.product.tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
  const looksSpecific = (member) =>
    tagsOf(member).some((tag) => itemWords.some((word) => tag.includes(word) || word.includes(tag)));

  const byTartan = new Map();
  const droppedDuplicates = [];
  for (const member of members) {
    const existing = byTartan.get(member.tartan);
    if (!existing) {
      byTartan.set(member.tartan, member);
      continue;
    }

    // Duplicate tartan within this group. Prefer the one with a tag matching
    // the item type; if neither/both match, keep whichever was encountered
    // first and drop the other.
    let keep = existing;
    let drop = member;
    if (looksSpecific(member) && !looksSpecific(existing)) {
      keep = member;
      drop = existing;
    }
    console.log(
      `DEDUP: group "${itemName}" — tartan "${member.tartan}" appears twice. ` +
      `Keeping product ${keep.product.id} ("${keep.product.title}", tags=[${tagsOf(keep).join(', ')}]), ` +
      `dropping product ${drop.product.id} ("${drop.product.title}", tags=[${tagsOf(drop).join(', ')}]) — ` +
      `it will still be deleted alongside the group's other source products.`
    );
    byTartan.set(member.tartan, keep);
    droppedDuplicates.push(drop.product);
  }
  return { members: [...byTartan.values()], droppedDuplicates };
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
    .map(([itemName, members]) => {
      const { members: dedupedMembers, droppedDuplicates } = dedupeGroupMembers(itemName, members);
      return { itemName, members: dedupedMembers, droppedDuplicates };
    })
    .filter((group) => group.members.length >= 2);
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

  // Image alignment check: buildMergedProductPayload builds newProduct.images
  // in the same order as group.members (one image per member, by tartan), and
  // assignVariantImages relies on that same index alignment when assigning
  // image_id to each tartan's variant(s). Confirm that alignment actually held
  // by checking each member's variants point at the image at that member's index.
  for (let i = 0; i < group.members.length; i++) {
    const member = group.members[i];
    const expectedImage = newProduct.images[i];
    if (!expectedImage) {
      throw new Error(`Verification failed: no image at index ${i} for tartan "${member.tartan}"`);
    }
    const variantsForTartan = newProduct.variants.filter((v) => v.option1 === member.tartan);
    if (variantsForTartan.length === 0) {
      throw new Error(`Verification failed: no variants found for tartan "${member.tartan}"`);
    }
    for (const variant of variantsForTartan) {
      if (variant.image_id !== expectedImage.id) {
        throw new Error(
          `Verification failed: variant ${variant.id} (option1="${member.tartan}") has image_id ${variant.image_id}, ` +
          `expected ${expectedImage.id} (image[${i}], src=${expectedImage.src})`
        );
      }
    }
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

  // Delete the kept source products AND any duplicate-tartan products that
  // dedupeGroupMembers dropped in buildGroups — those never got a variant or
  // image of their own, but they still need to be removed so nothing survives
  // as an orphaned product.
  const sourceProducts = [...group.members.map((m) => m.product), ...(group.droppedDuplicates || [])];
  for (const product of sourceProducts) {
    await restRequest('DELETE', `/products/${product.id}.json`);
    console.log(`Deleted source product ${product.id} (${product.title})`);
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

  // Duplicate-tartan-within-group dedup (the real "Leggings" catalog bug:
  // two separate "Lindsay Tartan Leggings" products, one tagged "leggings").
  const legLikeProducts = [
    { id: 1, title: 'Keith Tartan Leggings', tags: 'clans-a-l, women-bottoms', options: [{ name: 'Title', values: ['Default Title'] }] },
    { id: 2, title: 'Lindsay Tartan Leggings', tags: 'clans-a-l, women-bottoms', options: [{ name: 'Title', values: ['Default Title'] }] },
    { id: 3, title: 'Lindsay Tartan Leggings', tags: 'clans-a-l, leggings, women-bottoms', options: [{ name: 'Title', values: ['Default Title'] }] },
  ];
  const legGroups = buildGroups(legLikeProducts);
  assert.equal(legGroups.length, 1, 'Leggings-like fixture should still form exactly one group');
  const legGroup = legGroups[0];
  assert.equal(legGroup.members.length, 2, 'duplicate Lindsay should be collapsed to a single member');
  const lindsayMembers = legGroup.members.filter((m) => m.tartan === 'Lindsay');
  assert.equal(lindsayMembers.length, 1, 'exactly one Lindsay variant source should remain');
  assert.equal(lindsayMembers[0].product.id, 3, 'the more specifically-tagged ("leggings") product should be kept');
  assert.deepEqual(legGroup.droppedDuplicates.map((p) => p.id), [2], 'the less specific duplicate should be recorded for deletion');

  // Tie-break: neither/both duplicate has a matching tag -> keep the first encountered.
  const tieProducts = [
    { id: 10, title: 'A Tartan Widget', tags: 'foo', options: [{ name: 'Title', values: ['Default Title'] }] },
    { id: 20, title: 'A Tartan Widget', tags: 'bar', options: [{ name: 'Title', values: ['Default Title'] }] },
    { id: 30, title: 'B Tartan Widget', tags: 'baz', options: [{ name: 'Title', values: ['Default Title'] }] },
  ];
  const tieGroups = buildGroups(tieProducts);
  assert.equal(tieGroups[0].members.find((m) => m.tartan === 'A').product.id, 10, 'tie-break keeps first-encountered duplicate');
  assert.deepEqual(tieGroups[0].droppedDuplicates.map((p) => p.id), [20]);

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
