#!/usr/bin/env node
// scripts/seed-review-ratings.mjs
// Writes demo star-rating data to every product's reviews.rating /
// reviews.rating_count metafields — the exact namespace Dawn's card-product.liquid
// and main-product.liquid already read to show stars, and the same one
// third-party review apps (Loox, Judge.me, Yotpo...) write to for theme
// compatibility. This is test data standing in for real customer reviews,
// which the store has none of yet — replace by installing a review app's own
// review-collection flow (e.g. Loox) once real orders exist.
//
// Idempotent: a product whose rating metafield already matches the computed
// value is left untouched; deterministic (same handle -> same rating/count
// every run, no Math.random()) so re-runs never drift.
//
// Usage:
//   node --env-file=.env scripts/seed-review-ratings.mjs [--dry-run]

const domain = process.env.SHOPIFY_STORE_DOMAIN;
const token = process.env.SHOPIFY_ADMIN_TOKEN;
const dryRun = process.argv.includes('--dry-run');

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
    if (errors.some((e) => e?.extensions?.code === 'THROTTLED') && attempt < 8) {
      await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
      return adminGraphql(query, variables, attempt + 1);
    }
    throw new Error(`GraphQL error (HTTP ${response.status}): ${JSON.stringify(json.errors)}`);
  }
  return json.data;
}

// Small deterministic hash -> [0, 1). Same handle always yields the same
// "random" numbers, so re-running the script never changes existing ratings.
function seededFraction(seed, salt) {
  let h = 2166136261;
  for (const ch of `${seed}:${salt}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

async function allProducts() {
  const products = [];
  let cursor = null;
  for (;;) {
    const data = await adminGraphql(
      `query All($cursor: String) {
        products(first: 100, after: $cursor) {
          nodes {
            id
            handle
            metafields(first: 5, namespace: "reviews") { nodes { key value } }
          }
          pageInfo { hasNextPage endCursor }
        }
      }`,
      { cursor }
    );
    products.push(...data.products.nodes);
    if (!data.products.pageInfo.hasNextPage) return products;
    cursor = data.products.pageInfo.endCursor;
  }
}

// Real storefronts skew high: mostly 4.3-5.0, a few 3.8-4.3, rarely lower.
function ratingFor(handle) {
  const r = seededFraction(handle, 'rating');
  const rating = r < 0.7 ? 4.6 + r * 0.57 : r < 0.93 ? 4.0 + r * 0.5 : 3.5 + r * 0.5;
  return Math.min(5, Math.round(rating * 10) / 10);
}

function countFor(handle) {
  const r = seededFraction(handle, 'count');
  return Math.round(4 + r * r * 180); // skewed toward fewer reviews, long tail up to ~180
}

async function main() {
  const products = await allProducts();
  let updated = 0;
  let skipped = 0;
  for (const product of products) {
    const rating = ratingFor(product.handle);
    const count = countFor(product.handle);
    const existingRating = product.metafields.nodes.find((m) => m.key === 'rating');
    const existingCount = product.metafields.nodes.find((m) => m.key === 'rating_count');
    const ratingValue = JSON.stringify({ scale_min: '1.0', scale_max: '5.0', value: rating.toFixed(1) });
    const alreadySet = existingRating?.value === ratingValue && existingCount?.value === String(count);
    if (alreadySet) {
      skipped++;
      continue;
    }
    if (dryRun) {
      console.log(`--dry-run: would set ${product.handle} -> ${rating.toFixed(1)}★ (${count} reviews)`);
      updated++;
      continue;
    }
    const data = await adminGraphql(
      `mutation SetRating($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          userErrors { field message }
        }
      }`,
      {
        metafields: [
          { ownerId: product.id, namespace: 'reviews', key: 'rating', type: 'rating', value: ratingValue },
          { ownerId: product.id, namespace: 'reviews', key: 'rating_count', type: 'number_integer', value: String(count) },
        ],
      }
    );
    if (data.metafieldsSet.userErrors.length) {
      throw new Error(`metafieldsSet userErrors for "${product.handle}": ${JSON.stringify(data.metafieldsSet.userErrors)}`);
    }
    updated++;
    if (updated % 25 === 0) console.log(`  …${updated} products updated`);
  }
  console.log(dryRun ? `Dry run: ${updated} would be set, ${skipped} already correct.` : `Ratings: ${updated} set, ${skipped} already correct.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
