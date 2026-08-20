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
//   node --env-file=.env scripts/merge-tartan-variants.mjs --reenrich [--dry-run]

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

// One-off, controller-approved exclusions for specific product ids that are
// known-bad in a way that would break buildMergedProductPayload (e.g. zero
// images). This is intentionally a hardcoded, narrow list — NOT a general
// "skip any member with data problems" mechanism. A full 221-product catalog
// scan on 2026-08-20 confirmed product 10632330215726 is the only product
// with zero images, and that it was never published to the Online Store
// (published_at: null), so it was already invisible to customers. Any OTHER
// future zero-image product is deliberately left unhandled here — it should
// still make buildMergedProductPayload throw and mergeGroup fail loudly, so
// it gets investigated rather than silently dropped.
const KNOWN_ONE_OFF_EXCLUSIONS = new Map([
  [
    10632330215726,
    'zero images and published_at: null (never published) — confirmed a one-off ' +
    'catalog gap via a full 221-product scan on 2026-08-20, not a systemic pattern',
  ],
]);

function excludeKnownBadMembers(itemName, members) {
  const kept = [];
  const excluded = [];
  for (const member of members) {
    const reason = KNOWN_ONE_OFF_EXCLUSIONS.get(member.product.id);
    if (!reason) {
      kept.push(member);
      continue;
    }
    console.log(
      `EXCLUDE: group "${itemName}" — tartan "${member.tartan}" (product ${member.product.id}, ` +
      `"${member.product.title}") is a known one-off exclusion (${reason}). Dropped from the merge; ` +
      `it will still be deleted alongside the group's other source products.`
    );
    excluded.push(member.product);
  }
  return { members: kept, excluded };
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
      const { members: finalMembers, excluded } = excludeKnownBadMembers(itemName, dedupedMembers);
      return {
        itemName,
        members: finalMembers,
        // Everything here gets deleted by mergeGroup but gets no variant/image
        // of its own: duplicate-tartan drops, plus known-bad exclusions.
        excludedSourceProducts: [...droppedDuplicates, ...excluded],
        hadKnownExclusion: excluded.length > 0,
      };
    })
    // Normally a "group" needs 2+ members to be worth merging. The one
    // exception: a known-bad exclusion (see excludeKnownBadMembers) may
    // legitimately reduce a group to a single remaining tartan (e.g.
    // "Knitted Hoodie" had exactly Antrim + Carlow; Carlow is excluded).
    // We still want that single-tartan product renamed/restructured into
    // the uniform "Tartan <Item>" shape and the excluded product deleted,
    // so let it through in that specific case.
    .filter((group) => group.members.length >= 2 || group.hadKnownExclusion);
}

function maxVariantCount(group) {
  const sizeOption = group.members[0].product.options.find((o) => o.name === 'Size');
  const sizeCount = sizeOption ? sizeOption.values.length : 1;
  return group.members.length * sizeCount;
}

// Category-specific description templates, ported from the original
// per-tartan description generator (gen_descriptions.py's CATEGORY dict,
// used to write body_html for all 222 source products before the merge).
// Adapted for the merged, multi-tartan case: the Python originals name one
// specific {tartan} in the opening/details/perfect_for text (since each
// source product was a single tartan); here a merged product covers 2+
// tartans, so per-category copy that named a single tartan has been
// generalized to talk about "a"/"the" tartan generically instead — the
// specific tartan names are still guaranteed to appear (see tartanSentence
// below), just in the "Available in ..." sentence rather than repeated
// through every section.
const APPAREL_PRODUCT_TYPES = new Set([
  'Dresses', 'Leggings', 'Outerwear', 'Pants', 'Polos', 'Shirts', 'Skirts', 'Sleepwear', 'Swimwear', 'T-Shirts',
]);

const CATEGORY_TEMPLATES = {
  'Accessories': {
    opening: (item) => `Finish any outfit with this ${item}, a small detail that carries real clan heritage.`,
    details: [
      'Woven in an authentic tartan sett',
      'Made from durable, comfortable materials built for daily use',
      'A subtle way to show your heritage without overstating it',
      'Pairs easily with both casual and smart-casual outfits',
    ],
    care: 'Spot clean with a damp cloth. Avoid soaking or machine washing.',
    perfectFor: 'Everyday wear, gifting, or completing a family matching look for a clan gathering or Burns Night.',
  },
  'Bags': {
    opening: (item) => `Carry your heritage with you in this ${item}, built for everyday use with room for what matters.`,
    details: [
      'Woven in an authentic tartan sett',
      'Sturdy construction designed to hold its shape with daily use',
      'Practical storage for everyday essentials',
      'A distinctive alternative to plain, unbranded bags',
    ],
    care: 'Spot clean with a damp cloth and mild soap. Air dry away from direct heat.',
    perfectFor: 'Daily errands, travel, or as a thoughtful gift for someone connected to their chosen clan name.',
  },
  'Footwear': {
    opening: (item) => `Step out in this ${item}, comfortable everyday footwear with a clan pattern that stands out.`,
    details: [
      'Upper printed in an authentic tartan sett',
      'Cushioned footbed for all-day comfort',
      'Durable outsole built for regular wear',
      'True to size — check the size guide before ordering',
    ],
    care: 'Wipe clean with a soft, damp cloth. Air dry away from direct heat.',
    perfectFor: 'Everyday wear, clan gatherings, or as a distinctive gift for someone with tartan heritage.',
  },
  'Hats': {
    opening: (item) => `Top off your look with this ${item}, a classic shape finished in a clan pattern you can wear all year.`,
    details: [
      'Woven in an authentic tartan sett',
      'Comfortable, breathable construction',
      'Adjustable or true-to-size fit (see product options)',
      'A practical, everyday way to carry your heritage',
    ],
    care: 'Spot clean with a damp cloth. Do not machine wash.',
    perfectFor: 'Outdoor wear, clan events, or as a gift for someone with tartan roots.',
  },
  'Home Decor': {
    opening: (item) => `Bring a tartan into your home with this ${item}, a lasting way to display your heritage indoors.`,
    details: [
      'Printed or woven in an authentic tartan sett',
      'Made from quality materials built to last',
      'Adds a distinctive accent to any room',
      'A meaningful gift for family gatherings or housewarmings',
    ],
    care: 'Follow standard care for the material — spot clean fabric pieces, wipe hard surfaces with a soft cloth.',
    perfectFor: 'Living rooms, bedrooms, or as a housewarming gift for someone with tartan heritage.',
  },
  // Apparel product_types (Dresses, Leggings, Outerwear, Pants, Polos,
  // Shirts, Skirts, Sleepwear, Swimwear, T-Shirts) share one template shape,
  // same as gen_descriptions.py's '__apparel__' entry. Also used as the
  // fallback for any product_type with no dedicated template above.
  '__apparel__': {
    opening: (item) => `Wear your heritage with this ${item}, made for everyday comfort with a pattern that means something.`,
    details: [
      'Woven in an authentic tartan sett',
      'Soft, breathable fabric built for all-day wear',
      'Available in a full size range — see the size chart before ordering',
      'A natural choice for family matching looks',
    ],
    care: 'Machine wash cold, inside out. Tumble dry low or hang to dry. Do not iron directly on the print.',
    perfectFor: 'Everyday wear, family photos, clan gatherings, or as a gift for someone with tartan heritage.',
  },
};

function categoryTemplateFor(productType) {
  if (APPAREL_PRODUCT_TYPES.has(productType)) return CATEGORY_TEMPLATES['__apparel__'];
  return CATEGORY_TEMPLATES[productType] || CATEGORY_TEMPLATES['__apparel__'];
}

export function buildMergedBodyHtml(itemName, tartanNames, productType) {
  const itemLower = itemName.toLowerCase();
  // Normally a merge has 2+ tartans, but a known-bad-member exclusion (see
  // excludeKnownBadMembers) can leave exactly one (e.g. "Knitted Hoodie"
  // after Carlow is dropped) — handle that singular case explicitly so it
  // doesn't fall into the ">=3 tartans" branch and produce a stray ", and".
  const tartanSentence = tartanNames.length === 1
    ? `${tartanNames[0]} tartan`
    : tartanNames.length === 2
    ? `${tartanNames[0]} tartan and ${tartanNames[1]} tartan`
    : `${tartanNames.slice(0, -1).map((t) => `${t} tartan`).join(', ')}, and ${tartanNames[tartanNames.length - 1]} tartan`;

  const cat = categoryTemplateFor(productType);
  const detailsHtml = cat.details.map((d) => `<li>${d}</li>`).join('');

  return (
    `<p>${cat.opening(itemLower)} Available in ${tartanSentence} — choose yours below.</p>` +
    `<h3>Product Details</h3>` +
    `<ul>${detailsHtml}</ul>` +
    `<h3>Care Instructions</h3>` +
    `<p>${cat.care}</p>` +
    `<h3>Perfect For</h3>` +
    `<p>${cat.perfectFor}</p>` +
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
    body_html: buildMergedBodyHtml(itemName, members.map((m) => m.tartan), first.product_type),
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
      // Keep the in-memory newProduct object in sync with what we just wrote
      // to the server. mergeGroup calls verifyMerge(newProduct, ...) right
      // after this function returns, using this SAME object — without this,
      // verifyMerge would check the stale image_id (null) captured at
      // product-creation time instead of the value we just assigned, and
      // fail every merge with a false-negative regardless of whether the
      // PUT actually succeeded.
      variant.image_id = image.id;
      await new Promise((r) => setTimeout(r, 550));
    }
  }
}

export async function verifyMerge(newProduct, group) {
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
  //
  // This MUST be checked against a fresh GET, not the in-memory `newProduct`
  // parameter. assignVariantImages mutates `newProduct.variants[*].image_id`
  // directly (see the comment there) so that this same in-memory object can
  // be inspected without going stale — but that means checking image_id
  // against `newProduct` here would just be comparing that mutation against
  // itself: it can only ever fail if the earlier PUT request in
  // assignVariantImages already threw. Re-fetching from the server is what
  // makes this an actual verification of server state (the safety gate
  // mergeGroup relies on before deleting the source products), rather than a
  // check that always trivially passes.
  const { product: freshProduct } = await restGet(`/products/${newProduct.id}.json`);
  for (let i = 0; i < group.members.length; i++) {
    const member = group.members[i];
    const expectedImage = freshProduct.images[i];
    if (!expectedImage) {
      throw new Error(`Verification failed: no image at index ${i} for tartan "${member.tartan}"`);
    }
    const variantsForTartan = freshProduct.variants.filter((v) => v.option1 === member.tartan);
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

  // Delete the kept source products AND any excluded products from buildGroups
  // (duplicate-tartan drops and known-bad-member exclusions) — those never
  // got a variant or image of their own, but they still need to be removed
  // so nothing survives as an orphaned product.
  const sourceProducts = [...group.members.map((m) => m.product), ...(group.excludedSourceProducts || [])];
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

  const html2 = buildMergedBodyHtml('Pillow Cover', ['Saskatchewan', 'Yukon'], 'Home Decor');
  assert.ok(html2.includes('Saskatchewan tartan'), 'must contain "Saskatchewan tartan" for search');
  assert.ok(html2.includes('Yukon tartan'), 'must contain "Yukon tartan" for search');
  assert.ok(html2.includes('Bring a tartan into your home'), 'Home Decor category opening should be used');
  assert.ok(html2.includes('Adds a distinctive accent to any room'), 'Home Decor category details should be used');
  assert.ok(html2.includes('<h3>Perfect For</h3>'), 'must include a Perfect For section');
  assert.ok(html2.includes('housewarming gift'), 'Home Decor perfect-for copy should be used');

  const html3 = buildMergedBodyHtml('Bedding Set', ['Alberta', 'Antrim', 'Argyll'], 'Home Decor');
  for (const name of ['Alberta', 'Antrim', 'Argyll']) {
    assert.ok(html3.includes(`${name} tartan`), `must contain "${name} tartan" for search`);
  }

  // Category-awareness: an apparel product_type (via the shared __apparel__
  // template) and Accessories should each pull distinct, category-specific
  // copy while still satisfying the tartan-phrase requirement.
  const htmlApparel = buildMergedBodyHtml('T-Shirt', ['Gordon', 'Hunter'], 'T-Shirts');
  assert.ok(htmlApparel.includes('Gordon tartan') && htmlApparel.includes('Hunter tartan'), 'apparel body must name both tartans');
  assert.ok(htmlApparel.includes('Wear your heritage with this t-shirt'), 'apparel category opening should be used');
  assert.ok(htmlApparel.includes('see the size chart before ordering'), 'apparel category details should be used');
  assert.ok(htmlApparel.includes('Machine wash cold, inside out'), 'apparel category care instructions should be used');

  const htmlAccessories = buildMergedBodyHtml('Bow Tie', ['Bruce', 'Cameron'], 'Accessories');
  assert.ok(htmlAccessories.includes('Bruce tartan') && htmlAccessories.includes('Cameron tartan'), 'accessories body must name both tartans');
  assert.ok(htmlAccessories.includes('Finish any outfit with this bow tie'), 'Accessories category opening should be used');
  assert.ok(htmlAccessories.includes('Spot clean with a damp cloth. Avoid soaking'), 'Accessories category care instructions should be used');
  assert.ok(htmlAccessories.includes('Burns Night'), 'Accessories perfect-for copy should be used');

  // Unknown/unmapped product_type falls back to the apparel template rather
  // than throwing or silently omitting sections.
  const htmlUnknown = buildMergedBodyHtml('Gadget', ['Bruce', 'Cameron'], 'SomeUnmappedType');
  assert.ok(htmlUnknown.includes('Wear your heritage with this gadget'), 'unmapped product_type should fall back to the apparel template');

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
  assert.deepEqual(legGroup.excludedSourceProducts.map((p) => p.id), [2], 'the less specific duplicate should be recorded for deletion');

  // Tie-break: neither/both duplicate has a matching tag -> keep the first encountered.
  const tieProducts = [
    { id: 10, title: 'A Tartan Widget', tags: 'foo', options: [{ name: 'Title', values: ['Default Title'] }] },
    { id: 20, title: 'A Tartan Widget', tags: 'bar', options: [{ name: 'Title', values: ['Default Title'] }] },
    { id: 30, title: 'B Tartan Widget', tags: 'baz', options: [{ name: 'Title', values: ['Default Title'] }] },
  ];
  const tieGroups = buildGroups(tieProducts);
  assert.equal(tieGroups[0].members.find((m) => m.tartan === 'A').product.id, 10, 'tie-break keeps first-encountered duplicate');
  assert.deepEqual(tieGroups[0].excludedSourceProducts.map((p) => p.id), [20]);

  // Known-bad-member exclusion (the real "Knitted Hoodie" catalog bug:
  // product 10632330215726 has zero images and was never published). A
  // 2-member group should be allowed through with just 1 remaining member.
  const hoodieLikeProducts = [
    { id: 10632330215726, title: 'Carlow Tartan Knitted Hoodie', tags: 'clans-a-l', images: [], options: [{ name: 'Title', values: ['Default Title'] }] },
    { id: 999, title: 'Antrim Tartan Knitted Hoodie', tags: 'clans-a-l', images: [{ src: 'antrim.png' }], options: [{ name: 'Title', values: ['Default Title'] }] },
  ];
  const hoodieGroups = buildGroups(hoodieLikeProducts);
  assert.equal(hoodieGroups.length, 1, 'group should survive despite dropping below 2 members, due to known exclusion');
  const hoodieGroup = hoodieGroups[0];
  assert.equal(hoodieGroup.members.length, 1, 'only Antrim should remain as a real member');
  assert.equal(hoodieGroup.members[0].tartan, 'Antrim');
  assert.deepEqual(hoodieGroup.excludedSourceProducts.map((p) => p.id), [10632330215726], 'the known-bad product should be queued for deletion');
  assert.equal(hoodieGroup.hadKnownExclusion, true);

  // A group that never hits the known-bad-id list still needs 2+ members.
  const singleProduct = [
    { id: 1, title: 'Solo Tartan Gizmo', tags: '', options: [{ name: 'Title', values: ['Default Title'] }] },
  ];
  assert.equal(buildGroups(singleProduct).length, 0, 'a lone product with no group-mates is never a merge group');

  const bodyOneTartan = buildMergedBodyHtml('Knitted Hoodie', ['Antrim'], 'Outerwear');
  assert.ok(bodyOneTartan.includes('Antrim tartan'), 'single-tartan body must still name the tartan');
  assert.ok(!bodyOneTartan.includes(', and'), 'single-tartan body must not have a stray ", and" from the multi-tartan branch');

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

// One-off re-enrichment pass (Finding 2, Part B): the merge already ran and
// replaced each of the 222 original per-tartan products' rich,
// category-differentiated body_html with buildMergedBodyHtml's old
// category-blind generic template. This regenerates body_html for every
// already-merged live product using the fixed, category-aware
// buildMergedBodyHtml — a content-only PUT, no creates/deletes. Safe to
// re-run: it recomputes body_html fresh each time from title/options, so
// running it twice just rewrites the same (correct) content again.
//
// Merged products are identified the same way the merge leaves them: title
// starts with "Tartan " and there's a "Tartan" option — this doesn't require
// the original group data (which no longer exists; the source products were
// deleted), just the shape the merge produced.
function isMergedProduct(product) {
  return product.title.startsWith('Tartan ') && product.options.some((o) => o.name === 'Tartan');
}

// Shopify reformats body_html on save (observed: it inserts newlines between
// sibling <li> elements inside a <ul>), so a raw string comparison against
// what we generate will never match even when the content is identical.
// Normalize whitespace between tags on both sides before comparing so the
// "already up to date" skip actually works on a second run.
const normalizeHtmlForCompare = (html) => html.replace(/>\s+</g, '><').trim();

async function reenrich({ dryRun }) {
  const products = await fetchAllProducts();
  const targets = products.filter(isMergedProduct);
  console.log(`Found ${targets.length} merged products (title starts with "Tartan " and has a "Tartan" option).`);

  let updated = 0;
  let skipped = 0;
  for (const product of targets) {
    const itemName = product.title.replace(/^Tartan\s+/, '');
    const tartanOption = product.options.find((o) => o.name === 'Tartan');
    const tartanNames = [...new Set(tartanOption.values)];
    const productType = product.product_type;

    const newBodyHtml = buildMergedBodyHtml(itemName, tartanNames, productType);
    if (normalizeHtmlForCompare(newBodyHtml) === normalizeHtmlForCompare(product.body_html)) {
      console.log(`SKIP (already up to date): ${product.id} "${product.title}" [${productType}] (${tartanNames.length} tartans)`);
      skipped++;
      continue;
    }

    console.log(`${dryRun ? 'DRY-RUN would update' : 'Updating'}: ${product.id} "${product.title}" [${productType}] (${tartanNames.length} tartans: ${tartanNames.join(', ')})`);
    if (!dryRun) {
      await restRequest('PUT', `/products/${product.id}.json`, { product: { id: product.id, body_html: newBodyHtml } });
      await new Promise((r) => setTimeout(r, 550));
    }
    updated++;
  }

  console.log(`\nReenrich done: ${updated} ${dryRun ? 'would be updated' : 'updated'}, ${skipped} already up to date, ${targets.length} total merged products.`);
}

if (process.argv.includes('--reenrich')) {
  const dryRun = process.argv.includes('--dry-run');
  await reenrich({ dryRun });
  process.exit(0);
}
