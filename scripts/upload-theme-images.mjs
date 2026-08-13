#!/usr/bin/env node
// scripts/upload-theme-images.mjs
// Fills every empty image slot on the homepage. Generates one tartan PNG per
// slot, uploads it to Shopify Files, then rewrites templates/index.json with the
// resulting `shopify://shop_images/<file>` references.
//
// Slots covered: the hero banner and every card in the five multicolumn category
// grids. Press logos are deliberately skipped — those must be real, licensed
// outlet logos supplied by the merchant.
//
// Idempotent: a slot that already holds an image reference is left alone unless
// --force is passed.
//
// Usage:
//   node --env-file=.env scripts/upload-theme-images.mjs [--dry-run] [--force]

import { readFileSync, writeFileSync } from 'node:fs';
import { tartanPNG } from './tartan-png.mjs';
import { PALETTES } from './palettes.mjs';

const domain = process.env.SHOPIFY_STORE_DOMAIN;
const token = process.env.SHOPIFY_ADMIN_TOKEN;
const dryRun = process.argv.includes('--dry-run');
const force = process.argv.includes('--force');

if (!domain || !token) {
  console.error('Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_TOKEN env vars.');
  process.exit(1);
}

const API_VERSION = '2025-01';
const endpoint = `https://${domain}/admin/api/${API_VERSION}/graphql.json`;
const TEMPLATE = 'templates/index.json';
const PALETTE_NAMES = Object.keys(PALETTES);

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

async function uploadFile(filename, png) {
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
        filename,
        mimeType: 'image/png',
        httpMethod: 'POST',
        resource: 'FILE',
        fileSize: String(png.length),
      }],
    }
  );
  if (staged.stagedUploadsCreate.userErrors.length) {
    throw new Error(`stagedUploadsCreate userErrors for "${filename}": ${JSON.stringify(staged.stagedUploadsCreate.userErrors)}`);
  }
  const target = staged.stagedUploadsCreate.stagedTargets[0];
  const form = new FormData();
  for (const { name, value } of target.parameters) form.append(name, value);
  form.append('file', new Blob([png], { type: 'image/png' }), filename);
  const uploadResponse = await fetch(target.url, { method: 'POST', body: form });
  if (!uploadResponse.ok) {
    throw new Error(`staged upload failed for "${filename}": HTTP ${uploadResponse.status}`);
  }
  const created = await adminGraphql(
    `
      mutation CreateFile($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
          files { id fileStatus ... on MediaImage { image { url } } }
          userErrors { field message }
        }
      }
    `,
    { files: [{ originalSource: target.resourceUrl, contentType: 'IMAGE', filename }] }
  );
  if (created.fileCreate.userErrors.length) {
    throw new Error(`fileCreate userErrors for "${filename}": ${JSON.stringify(created.fileCreate.userErrors)}`);
  }
  const file = created.fileCreate.files[0];
  return resolveFilename(file.id, filename);
}

// A freshly created file is PROCESSING and has no image URL yet; poll until it
// is READY so the real stored filename (Shopify may de-duplicate names) is known.
async function resolveFilename(id, fallback, attempt = 0) {
  const data = await adminGraphql(
    'query File($id: ID!) { node(id: $id) { ... on MediaImage { fileStatus image { url } } } }',
    { id }
  );
  const node = data.node;
  if (node?.image?.url) {
    return decodeURIComponent(new URL(node.image.url).pathname.split('/').pop());
  }
  if (attempt >= 10) {
    console.warn(`File "${fallback}" still ${node?.fileStatus ?? 'unknown'} — assuming its name is unchanged.`);
    return fallback;
  }
  await new Promise((resolve) => setTimeout(resolve, 1500));
  return resolveFilename(id, fallback, attempt + 1);
}

function slug(text) {
  return String(text)
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Walks the homepage template and returns every image slot worth filling.
function collectSlots(template) {
  const slots = [];
  for (const [sectionId, section] of Object.entries(template.sections)) {
    if (section.type === 'image-banner') {
      slots.push({
        label: `hero-${slug(sectionId)}`,
        settings: section.settings,
        key: 'image',
        width: 1600,
        height: 900,
        threadPx: 5,
      });
      continue;
    }
    if (section.type === 'slideshow') {
      for (const [blockId, block] of Object.entries(section.blocks ?? {})) {
        slots.push({
          label: `hero-${slug(blockId)}`,
          settings: block.settings,
          key: 'image',
          width: 1600,
          height: 900,
          threadPx: 5,
        });
      }
      continue;
    }
    if (section.type !== 'multicolumn') continue;
    for (const [blockId, block] of Object.entries(section.blocks ?? {})) {
      slots.push({
        label: `category-${slug(block.settings?.title ?? blockId)}`,
        settings: block.settings,
        key: 'image',
        width: 800,
        height: 800,
        threadPx: 7,
      });
    }
  }
  return slots;
}

async function main() {
  const template = JSON.parse(readFileSync(TEMPLATE, 'utf8'));
  const slots = collectSlots(template);
  const pending = slots.filter((slot) => force || !slot.settings[slot.key]);
  console.log(`${slots.length} image slots on the homepage, ${pending.length} to fill.`);
  if (dryRun) {
    for (const slot of pending) console.log(`  would upload ${slot.label}.png (${slot.width}x${slot.height})`);
    console.log('Dry run complete.');
    return;
  }
  let index = 0;
  for (const slot of pending) {
    const palette = PALETTES[PALETTE_NAMES[index % PALETTE_NAMES.length]];
    const png = tartanPNG(palette, slot.width, slot.threadPx, slot.height);
    const filename = await uploadFile(`${slot.label}.png`, png);
    slot.settings[slot.key] = `shopify://shop_images/${filename}`;
    console.log(`  ${slot.label} -> ${filename}`);
    index++;
  }
  writeFileSync(TEMPLATE, `${JSON.stringify(template, null, 2)}\n`);
  console.log(`Updated ${TEMPLATE} with ${pending.length} image references.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
