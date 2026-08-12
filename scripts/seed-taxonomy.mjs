#!/usr/bin/env node
// scripts/seed-taxonomy.mjs
// Expands the demo catalog to the full three-level taxonomy in taxonomy.mjs:
// every collection in the tree exists as a TAG=handle smart collection, and each
// level-3 leaf gets two generated tartan products so no menu entry is a dead end.
//
// Idempotent: existing collections and products are left untouched.
//
// Usage:
//   node --env-file=.env scripts/seed-taxonomy.mjs [--dry-run] [--verify]

import { tartanPNG } from './tartan-png.mjs';
import { collectionNodes, leafNodes } from './taxonomy.mjs';
import { PALETTES } from './palettes.mjs';

const domain = process.env.SHOPIFY_STORE_DOMAIN;
const token = process.env.SHOPIFY_ADMIN_TOKEN;
const dryRun = process.argv.includes('--dry-run');
const verifyOnly = process.argv.includes('--verify');

if (!domain || !token) {
  console.error('Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_TOKEN env vars.');
  process.exit(1);
}

const API_VERSION = '2025-01';
const endpoint = `https://${domain}/admin/api/${API_VERSION}/graphql.json`;

async function adminGraphql(query, variables, attempt = 0) {
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
    const errors = Array.isArray(json.errors) ? json.errors : [json.errors];
    const throttled = errors.some((e) => e?.extensions?.code === 'THROTTLED');
    if (throttled && attempt < 8) {
      await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
      return adminGraphql(query, variables, attempt + 1);
    }
    throw new Error(`GraphQL error (HTTP ${response.status}): ${JSON.stringify(json.errors)}`);
  }
  return json.data;
}

// Names drive both the product titles and which clan/region collection each
// product lands in, so seeding the leaves also fills the clan collections.
const NAME_POOL = [
  { name: 'Armstrong', group: 'clans-a-l' }, { name: 'Buchanan', group: 'clans-a-l' },
  { name: 'Cameron', group: 'clans-a-l' }, { name: 'Douglas', group: 'clans-a-l' },
  { name: 'Elliot', group: 'clans-a-l' }, { name: 'Ferguson', group: 'clans-a-l' },
  { name: 'Gordon', group: 'clans-a-l' }, { name: 'Hamilton', group: 'clans-a-l' },
  { name: 'Innes', group: 'clans-a-l' }, { name: 'Johnstone', group: 'clans-a-l' },
  { name: 'Keith', group: 'clans-a-l' }, { name: 'Lindsay', group: 'clans-a-l' },
  { name: 'MacAlister', group: 'clans-m-y' }, { name: 'MacBean', group: 'clans-m-y' },
  { name: 'MacKinnon', group: 'clans-m-y' }, { name: 'Maxwell', group: 'clans-m-y' },
  { name: 'Munro', group: 'clans-m-y' }, { name: 'Napier', group: 'clans-m-y' },
  { name: 'Ogilvie', group: 'clans-m-y' }, { name: 'Ramsay', group: 'clans-m-y' },
  { name: 'Scott', group: 'clans-m-y' }, { name: 'Sutherland', group: 'clans-m-y' },
  { name: 'Urquhart', group: 'clans-m-y' }, { name: 'Wallace', group: 'clans-m-y' },
  { name: 'Alberta', group: 'canada-province-tartan' }, { name: 'Manitoba', group: 'canada-province-tartan' },
  { name: 'Ontario', group: 'canada-province-tartan' }, { name: 'Quebec', group: 'canada-province-tartan' },
  { name: 'Saskatchewan', group: 'canada-province-tartan' }, { name: 'Yukon', group: 'canada-province-tartan' },
  { name: 'Antrim', group: 'ireland-county-tartan-a-k' }, { name: 'Carlow', group: 'ireland-county-tartan-a-k' },
  { name: 'Clare', group: 'ireland-county-tartan-a-k' }, { name: 'Galway', group: 'ireland-county-tartan-a-k' },
  { name: 'Kildare', group: 'ireland-county-tartan-a-k' }, { name: 'Kilkenny', group: 'ireland-county-tartan-a-k' },
  { name: 'Leitrim', group: 'ireland-county-tartan-l-w' }, { name: 'Longford', group: 'ireland-county-tartan-l-w' },
  { name: 'Meath', group: 'ireland-county-tartan-l-w' }, { name: 'Roscommon', group: 'ireland-county-tartan-l-w' },
  { name: 'Sligo', group: 'ireland-county-tartan-l-w' }, { name: 'Wexford', group: 'ireland-county-tartan-l-w' },
];

const SIZED_TYPES = new Set([
  'Shirts', 'T-Shirts', 'Polos', 'Outerwear', 'Pants', 'Sleepwear', 'Dresses', 'Skirts', 'Swimwear',
]);
const SIZES = ['S', 'M', 'L', 'XL'];
const PALETTE_NAMES = Object.keys(PALETTES);
const PER_LEAF = 2;

function kebab(text) {
  return text
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function describe(source, leaf) {
  return `A ${leaf.title.toLowerCase()} woven in the ${source.name} tartan, made for everyday wear and finished to last.`;
}

// Deterministic: the same leaf always produces the same two products.
export function generateProducts() {
  const products = [];
  const leaves = leafNodes();
  let cursor = 0;
  for (const leaf of leaves) {
    for (let i = 0; i < PER_LEAF; i++) {
      const source = NAME_POOL[cursor % NAME_POOL.length];
      const palette = PALETTE_NAMES[cursor % PALETTE_NAMES.length];
      cursor++;
      const title = `${source.name} Tartan ${leaf.title}`;
      const tags = [leaf.handle, ...leaf.parents, source.group];
      if (cursor % 9 === 0) tags.push('new-arrivals');
      products.push({
        handle: kebab(`${source.name}-${leaf.handle}`),
        title,
        type: leaf.type,
        price: (Number(leaf.price) + i * 6).toFixed(2),
        sizes: SIZED_TYPES.has(leaf.type),
        palette,
        tags: [...new Set(tags)],
        description: describe(source, leaf),
      });
    }
  }
  return products;
}

function productSetInput(p) {
  const options = p.sizes
    ? [{ name: 'Size', position: 1, values: SIZES.map((name) => ({ name })) }]
    : [{ name: 'Title', position: 1, values: [{ name: 'Default Title' }] }];
  const variants = p.sizes
    ? SIZES.map((size) => ({ price: p.price, optionValues: [{ optionName: 'Size', name: size }] }))
    : [{ price: p.price, optionValues: [{ optionName: 'Title', name: 'Default Title' }] }];
  return {
    title: p.title,
    handle: p.handle,
    descriptionHtml: `<p>${p.description}</p>`,
    productType: p.type,
    tags: p.tags,
    status: 'ACTIVE',
    productOptions: options,
    variants,
  };
}

function validate(products) {
  const handles = new Set();
  for (const p of products) {
    if (handles.has(p.handle)) throw new Error(`duplicate product handle: ${p.handle}`);
    handles.add(p.handle);
    if (!PALETTES[p.palette]) throw new Error(`unknown palette "${p.palette}" on ${p.handle}`);
  }
  const collectionHandles = new Set(collectionNodes().map((c) => c.handle));
  for (const p of products) {
    for (const tag of p.tags) {
      if (!collectionHandles.has(tag)) throw new Error(`product ${p.handle} tag "${tag}" has no collection`);
    }
  }
  for (const leaf of leafNodes()) {
    const count = products.filter((p) => p.tags.includes(leaf.handle)).length;
    if (count < 2) throw new Error(`leaf ${leaf.handle} would have ${count} products (<2)`);
  }
}

async function getOnlineStorePublicationId() {
  const data = await adminGraphql('query { publications(first: 20) { nodes { id name } } }');
  const pub = data.publications.nodes.find((p) => p.name === 'Online Store');
  if (!pub) throw new Error('Online Store publication not found. Check the app has read_publications scope.');
  return pub.id;
}

async function publish(id, publicationId) {
  const data = await adminGraphql(
    `
      mutation Publish($id: ID!, $input: [PublicationInput!]!) {
        publishablePublish(id: $id, input: $input) {
          userErrors { field message }
        }
      }
    `,
    { id, input: [{ publicationId }] }
  );
  if (data.publishablePublish.userErrors.length) {
    throw new Error(`publishablePublish userErrors: ${JSON.stringify(data.publishablePublish.userErrors)}`);
  }
}

// One paginated sweep beats a per-handle lookup when the catalog is this large.
async function existingHandles(field) {
  const handles = new Set();
  let cursor = null;
  for (;;) {
    const data = await adminGraphql(
      `query All($cursor: String) {
        ${field}(first: 250, after: $cursor) {
          nodes { handle }
          pageInfo { hasNextPage endCursor }
        }
      }`,
      { cursor }
    );
    for (const node of data[field].nodes) handles.add(node.handle);
    if (!data[field].pageInfo.hasNextPage) return handles;
    cursor = data[field].pageInfo.endCursor;
  }
}

async function ensureCollections(publicationId) {
  const existing = await existingHandles('collections');
  let created = 0;
  let skipped = 0;
  for (const c of collectionNodes()) {
    if (existing.has(c.handle)) {
      skipped++;
      continue;
    }
    const data = await adminGraphql(
      `
        mutation CreateCollection($input: CollectionInput!) {
          collectionCreate(input: $input) {
            collection { id handle }
            userErrors { field message }
          }
        }
      `,
      {
        input: {
          title: c.title,
          handle: c.handle,
          ruleSet: {
            appliedDisjunctively: false,
            rules: [{ column: 'TAG', relation: 'EQUALS', condition: c.handle }],
          },
        },
      }
    );
    const { userErrors, collection } = data.collectionCreate;
    if (userErrors.length) throw new Error(`collectionCreate userErrors for "${c.handle}": ${JSON.stringify(userErrors)}`);
    await publish(collection.id, publicationId);
    console.log(`Created collection "${collection.handle}"`);
    created++;
  }
  console.log(`Collections: ${created} created, ${skipped} skipped.`);
}

async function attachImage(productId, product) {
  const png = tartanPNG(PALETTES[product.palette]);
  const staged = await adminGraphql(
    `
      mutation Stage($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets { url resourceUrl parameters { name value } }
          userErrors { field message }
        }
      }
    `,
    {
      input: [{
        filename: `${product.handle}.png`,
        mimeType: 'image/png',
        httpMethod: 'POST',
        resource: 'IMAGE',
        fileSize: String(png.length),
      }],
    }
  );
  if (staged.stagedUploadsCreate.userErrors.length) {
    throw new Error(`stagedUploadsCreate userErrors for "${product.handle}": ${JSON.stringify(staged.stagedUploadsCreate.userErrors)}`);
  }
  const target = staged.stagedUploadsCreate.stagedTargets[0];
  const form = new FormData();
  for (const { name, value } of target.parameters) form.append(name, value);
  form.append('file', new Blob([png], { type: 'image/png' }), `${product.handle}.png`);
  const uploadResponse = await fetch(target.url, { method: 'POST', body: form });
  if (!uploadResponse.ok) {
    throw new Error(`staged upload failed for "${product.handle}": HTTP ${uploadResponse.status}`);
  }
  const media = await adminGraphql(
    `
      mutation Attach($productId: ID!, $media: [CreateMediaInput!]!) {
        productCreateMedia(productId: $productId, media: $media) {
          mediaUserErrors { field message }
        }
      }
    `,
    {
      productId,
      media: [{ originalSource: target.resourceUrl, alt: product.title, mediaContentType: 'IMAGE' }],
    }
  );
  if (media.productCreateMedia.mediaUserErrors.length) {
    throw new Error(`productCreateMedia userErrors for "${product.handle}": ${JSON.stringify(media.productCreateMedia.mediaUserErrors)}`);
  }
}

async function ensureProducts(products, publicationId) {
  const existing = await existingHandles('products');
  let created = 0;
  let skipped = 0;
  for (const p of products) {
    if (existing.has(p.handle)) {
      skipped++;
      continue;
    }
    const data = await adminGraphql(
      `
        mutation CreateProduct($input: ProductSetInput!) {
          productSet(input: $input, synchronous: true) {
            product { id handle }
            userErrors { field message }
          }
        }
      `,
      { input: productSetInput(p) }
    );
    const { userErrors, product } = data.productSet;
    if (userErrors.length) throw new Error(`productSet userErrors for "${p.handle}": ${JSON.stringify(userErrors)}`);
    await attachImage(product.id, p);
    await publish(product.id, publicationId);
    created++;
    if (created % 10 === 0) console.log(`  …${created} products created`);
  }
  console.log(`Products: ${created} created, ${skipped} skipped.`);
}

async function verify(products) {
  let failures = 0;
  for (const c of collectionNodes()) {
    const data = await adminGraphql(
      'query VerifyCollection($q: String!) { collections(first: 1, query: $q) { nodes { handle productsCount { count } } } }',
      { q: `handle:${c.handle}` }
    );
    const node = data.collections.nodes.find((n) => n.handle === c.handle);
    const count = node ? node.productsCount.count : 0;
    if (count < 2) {
      console.error(`FAIL collection ${c.handle}: ${count} products (<2)`);
      failures++;
    }
  }
  const existing = await existingHandles('products');
  for (const p of products) {
    if (!existing.has(p.handle)) {
      console.error(`FAIL product ${p.handle}: not found`);
      failures++;
    }
  }
  if (failures) throw new Error(`Verification failed: ${failures} problem(s).`);
  console.log(`Verification passed: ${collectionNodes().length} collections have >=2 products; ${products.length} products present.`);
}

async function main() {
  const products = generateProducts();
  validate(products);
  if (dryRun) {
    console.log(`--dry-run: ${collectionNodes().length} collections, ${products.length} products.`);
    for (const p of products.slice(0, 5)) console.log(JSON.stringify(productSetInput(p)));
    console.log('Dry run complete.');
    return;
  }
  if (verifyOnly) {
    await verify(products);
    return;
  }
  const publicationId = await getOnlineStorePublicationId();
  await ensureCollections(publicationId);
  await ensureProducts(products, publicationId);
  console.log('Taxonomy seeding complete. Run with --verify to check results.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
