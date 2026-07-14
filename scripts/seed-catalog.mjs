#!/usr/bin/env node
// scripts/seed-catalog.mjs
// Seeds the demo tartan catalog: 24 tag-rule smart collections + 40 products
// with generated tartan images, published to the Online Store channel.
//
// Usage:
//   node --env-file=.env scripts/seed-catalog.mjs [--dry-run] [--verify]

import { tartanPNG } from './tartan-png.mjs';

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
    const throttled = json.errors.some((e) => e.extensions?.code === 'THROTTLED');
    if (throttled && attempt < 5) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return adminGraphql(query, variables, attempt + 1);
    }
    throw new Error(`GraphQL error: ${JSON.stringify(json.errors)}`);
  }
  return json.data;
}

// Original tartan colorways (setts are mirrored by tartanPNG).
const PALETTES = {
  highlandGreen: [
    { color: '#1f4d36', count: 24 }, { color: '#0d2b1d', count: 6 },
    { color: '#b3202c', count: 4 }, { color: '#0d2b1d', count: 6 },
    { color: '#274e6d', count: 16 },
  ],
  royalRed: [
    { color: '#a11d29', count: 26 }, { color: '#1c3a24', count: 10 },
    { color: '#e8b830', count: 3 }, { color: '#1e2f4d', count: 10 },
    { color: '#f2ede3', count: 4 },
  ],
  coastalNavy: [
    { color: '#16324f', count: 26 }, { color: '#5b88a5', count: 8 },
    { color: '#f2ede3', count: 3 }, { color: '#5b88a5', count: 8 },
    { color: '#0c1f33', count: 12 },
  ],
  heatherPurple: [
    { color: '#5a4470', count: 24 }, { color: '#8d8296', count: 8 },
    { color: '#3d7a52', count: 5 }, { color: '#8d8296', count: 8 },
    { color: '#2e2140', count: 12 },
  ],
  peatBrown: [
    { color: '#5c4632', count: 24 }, { color: '#c8a165', count: 8 },
    { color: '#8a3324', count: 4 }, { color: '#c8a165', count: 8 },
    { color: '#33261a', count: 14 },
  ],
  emeraldIrish: [
    { color: '#1a6b3c', count: 26 }, { color: '#e8b830', count: 4 },
    { color: '#f2ede3', count: 3 }, { color: '#e8b830', count: 4 },
    { color: '#0e4023', count: 14 },
  ],
  mapleRed: [
    { color: '#b3202c', count: 24 }, { color: '#f2ede3', count: 6 },
    { color: '#1c3a24', count: 8 }, { color: '#f2ede3', count: 6 },
    { color: '#701318', count: 12 },
  ],
  urbanGrey: [
    { color: '#4a4f54', count: 26 }, { color: '#b9bec3', count: 8 },
    { color: '#b3202c', count: 3 }, { color: '#b9bec3', count: 8 },
    { color: '#25282c', count: 14 },
  ],
  roseBlush: [
    { color: '#c98a97', count: 24 }, { color: '#7a2f42', count: 8 },
    { color: '#f2e6dc', count: 4 }, { color: '#7a2f42', count: 8 },
    { color: '#a05666', count: 12 },
  ],
  ochreGold: [
    { color: '#c9962e', count: 24 }, { color: '#5c4632', count: 8 },
    { color: '#1e2f4d', count: 5 }, { color: '#5c4632', count: 8 },
    { color: '#8f6a1f', count: 12 },
  ],
  coastalTeal: [
    { color: '#1f6f6b', count: 26 }, { color: '#cfae63', count: 6 },
    { color: '#16324f', count: 8 }, { color: '#cfae63', count: 6 },
    { color: '#0f423f', count: 12 },
  ],
  midnightWatch: [
    { color: '#1e2f4d', count: 24 }, { color: '#1c3a24', count: 20 },
    { color: '#0b1220', count: 6 }, { color: '#1c3a24', count: 20 },
    { color: '#16233a', count: 10 },
  ],
};

const COLLECTIONS = [
  { handle: 'clans-a-l', title: 'Clans A-L' },
  { handle: 'clans-m-y', title: 'Clans M-Y' },
  { handle: 'canada-province-tartan', title: 'Canada Province Tartan' },
  { handle: 'ireland-county-tartan-a-k', title: 'Ireland County Tartan A-K' },
  { handle: 'ireland-county-tartan-l-w', title: 'Ireland County Tartan L-W' },
  { handle: 'men-shirts-tops', title: "Men's Shirts & Tops" },
  { handle: 'men-outerwear-jackets', title: "Men's Outerwear & Jackets" },
  { handle: 'men-pants', title: "Men's Pants" },
  { handle: 'men-accessories', title: "Men's Accessories" },
  { handle: 'men-sleepwear', title: "Men's Sleepwear" },
  { handle: 'women-shirts-tops', title: "Women's Shirts & Tops" },
  { handle: 'women-outerwear-jackets', title: "Women's Outerwear & Jackets" },
  { handle: 'women-bottoms', title: "Women's Bottoms" },
  { handle: 'women-dresses', title: "Women's Dresses" },
  { handle: 'women-handbags', title: "Women's Handbags" },
  { handle: 'women-accessories', title: "Women's Accessories" },
  { handle: 'women-sleepwear', title: "Women's Sleepwear" },
  { handle: 'women-swimwear', title: "Women's Swimwear" },
  { handle: 'new-arrivals', title: 'New Arrivals' },
  { handle: 'home-decor', title: 'Home Decor' },
  { handle: 'footwear', title: 'Footwear' },
  { handle: 'tartan-flat-caps', title: 'Tartan Flat Caps' },
  { handle: 'tartan-polos', title: 'Tartan Polos' },
  { handle: 'tartan-tees', title: 'Tartan Tees' },
];

const PRODUCTS = [
  // --- Men ---
  { handle: 'macleod-tartan-flannel-shirt', title: 'MacLeod Tartan Flannel Shirt', type: 'Shirts', price: '59.00', sizes: true, palette: 'ochreGold', tags: ['clans-m-y', 'men-shirts-tops', 'new-arrivals'], description: 'A brushed-cotton flannel shirt in the bold MacLeod sett, cut for everyday comfort.' },
  { handle: 'fraser-tartan-polo', title: 'Fraser Tartan Polo', type: 'Polos', price: '45.00', sizes: true, palette: 'royalRed', tags: ['clans-a-l', 'tartan-polos', 'men-shirts-tops'], description: 'A pique polo with Fraser tartan trim at the collar and placket.' },
  { handle: 'murray-tartan-wool-overcoat', title: 'Murray Tartan Wool Overcoat', type: 'Outerwear', price: '179.00', sizes: true, palette: 'highlandGreen', tags: ['clans-m-y', 'men-outerwear-jackets'], description: 'A tailored wool-blend overcoat in a deep Murray green, fully lined for winter.' },
  { handle: 'buchanan-tartan-bomber-jacket', title: 'Buchanan Tartan Bomber Jacket', type: 'Outerwear', price: '129.00', sizes: true, palette: 'ochreGold', tags: ['clans-a-l', 'men-outerwear-jackets', 'new-arrivals'], description: 'A modern bomber in the vivid Buchanan sett with ribbed cuffs and hem.' },
  { handle: 'gordon-tartan-trousers', title: 'Gordon Tartan Trousers', type: 'Pants', price: '79.00', sizes: true, palette: 'highlandGreen', tags: ['clans-a-l', 'men-pants'], description: 'Classic straight-leg trousers in the Gordon tartan with a flat front.' },
  { handle: 'wallace-tartan-golf-pants', title: 'Wallace Tartan Golf Pants', type: 'Pants', price: '85.00', sizes: true, palette: 'royalRed', tags: ['clans-m-y', 'men-pants'], description: 'Lightweight stretch golf pants in the striking Wallace red tartan.' },
  { handle: 'cameron-tartan-scarf', title: 'Cameron Tartan Scarf', type: 'Accessories', price: '35.00', sizes: false, palette: 'royalRed', tags: ['clans-a-l', 'men-accessories'], description: 'A soft lambswool scarf woven in the Cameron clan tartan.' },
  { handle: 'stewart-tartan-flat-cap', title: 'Stewart Tartan Flat Cap', type: 'Hats', price: '42.00', sizes: false, palette: 'royalRed', tags: ['clans-m-y', 'men-accessories', 'tartan-flat-caps'], description: 'A traditional flat cap in a Stewart-inspired red sett with quilted lining.' },
  { handle: 'macdonald-tartan-pajama-set', title: 'MacDonald Tartan Pajama Set', type: 'Sleepwear', price: '65.00', sizes: true, palette: 'midnightWatch', tags: ['clans-m-y', 'men-sleepwear'], description: 'A two-piece brushed-cotton pajama set in the MacDonald tartan.' },
  { handle: 'douglas-tartan-lounge-pants', title: 'Douglas Tartan Lounge Pants', type: 'Sleepwear', price: '48.00', sizes: true, palette: 'urbanGrey', tags: ['clans-a-l', 'men-sleepwear'], description: 'Relaxed-fit lounge pants in the grey Douglas tartan with a drawstring waist.' },
  // --- Women ---
  { handle: 'campbell-tartan-blouse', title: 'Campbell Tartan Blouse', type: 'Shirts', price: '55.00', sizes: true, palette: 'highlandGreen', tags: ['clans-a-l', 'women-shirts-tops', 'new-arrivals'], description: 'A relaxed button-front blouse in the Campbell tartan with a soft drape.' },
  { handle: 'heather-tartan-tee', title: 'Heather Tartan Tee', type: 'T-Shirts', price: '29.00', sizes: true, palette: 'heatherPurple', tags: ['tartan-tees', 'women-shirts-tops'], description: 'A soft jersey tee with a heather-purple tartan chest panel.' },
  { handle: 'mackenzie-tartan-cape-coat', title: 'MacKenzie Tartan Cape Coat', type: 'Outerwear', price: '149.00', sizes: true, palette: 'midnightWatch', tags: ['clans-m-y', 'women-outerwear-jackets'], description: 'A sweeping cape coat in the MacKenzie tartan with concealed front fastening.' },
  { handle: 'antrim-tartan-quilted-jacket', title: 'Antrim Tartan Quilted Jacket', type: 'Outerwear', price: '119.00', sizes: true, palette: 'emeraldIrish', tags: ['ireland-county-tartan-a-k', 'women-outerwear-jackets', 'new-arrivals'], description: 'A diamond-quilted jacket in the County Antrim tartan with a corduroy collar.' },
  { handle: 'kerry-tartan-pleated-skirt', title: 'Kerry Tartan Pleated Skirt', type: 'Skirts', price: '69.00', sizes: true, palette: 'emeraldIrish', tags: ['ireland-county-tartan-a-k', 'women-bottoms'], description: 'A knife-pleated midi skirt in the County Kerry tartan.' },
  { handle: 'lindsay-tartan-leggings', title: 'Lindsay Tartan Leggings', type: 'Leggings', price: '39.00', sizes: true, palette: 'roseBlush', tags: ['clans-a-l', 'women-bottoms'], description: 'High-waisted stretch leggings in a blush Lindsay tartan print.' },
  { handle: 'rose-tartan-wrap-dress', title: 'Rose Tartan Wrap Dress', type: 'Dresses', price: '95.00', sizes: true, palette: 'roseBlush', tags: ['clans-m-y', 'women-dresses', 'new-arrivals'], description: 'A true wrap dress in the Rose tartan with a self-tie waist.' },
  { handle: 'galway-tartan-shift-dress', title: 'Galway Tartan Shift Dress', type: 'Dresses', price: '89.00', sizes: true, palette: 'emeraldIrish', tags: ['ireland-county-tartan-a-k', 'women-dresses'], description: 'A clean-lined shift dress in the County Galway tartan.' },
  { handle: 'ontario-tartan-crossbody-bag', title: 'Ontario Tartan Crossbody Bag', type: 'Bags', price: '75.00', sizes: false, palette: 'mapleRed', tags: ['canada-province-tartan', 'women-handbags'], description: 'A compact crossbody bag in the Ontario provincial tartan with leather trim.' },
  { handle: 'alberta-tartan-tote-bag', title: 'Alberta Tartan Tote Bag', type: 'Bags', price: '59.00', sizes: false, palette: 'ochreGold', tags: ['canada-province-tartan', 'women-handbags', 'new-arrivals'], description: 'A roomy everyday tote in the green-and-gold Alberta tartan.' },
  { handle: 'mayo-tartan-shawl', title: 'Mayo Tartan Shawl', type: 'Accessories', price: '49.00', sizes: false, palette: 'emeraldIrish', tags: ['ireland-county-tartan-l-w', 'women-accessories'], description: 'A generous woven shawl in the County Mayo tartan with fringed edges.' },
  { handle: 'sinclair-tartan-beret', title: 'Sinclair Tartan Beret', type: 'Hats', price: '38.00', sizes: false, palette: 'royalRed', tags: ['clans-m-y', 'women-accessories'], description: 'A structured wool beret in the red Sinclair tartan.' },
  { handle: 'tipperary-tartan-nightgown', title: 'Tipperary Tartan Nightgown', type: 'Sleepwear', price: '52.00', sizes: true, palette: 'coastalTeal', tags: ['ireland-county-tartan-l-w', 'women-sleepwear'], description: 'A soft flannel nightgown in the County Tipperary tartan.' },
  { handle: 'ferguson-tartan-pajama-set', title: 'Ferguson Tartan Pajama Set', type: 'Sleepwear', price: '68.00', sizes: true, palette: 'coastalNavy', tags: ['clans-a-l', 'women-sleepwear'], description: 'A piped two-piece pajama set in the navy Ferguson tartan.' },
  { handle: 'iona-tartan-trim-one-piece', title: 'Iona Tartan-Trim One-Piece', type: 'Swimwear', price: '64.00', sizes: true, palette: 'coastalTeal', tags: ['women-swimwear', 'new-arrivals'], description: 'A sculpting one-piece swimsuit with Iona tartan trim at the neckline.' },
  { handle: 'islay-tartan-swim-shorts', title: 'Islay Tartan Swim Shorts', type: 'Swimwear', price: '46.00', sizes: true, palette: 'coastalNavy', tags: ['women-swimwear'], description: 'Quick-dry swim shorts in a navy Islay tartan print.' },
  // --- Home, footwear & category extras ---
  { handle: 'british-columbia-tartan-throw-blanket', title: 'British Columbia Tartan Throw Blanket', type: 'Home Decor', price: '85.00', sizes: false, palette: 'coastalTeal', tags: ['canada-province-tartan', 'home-decor'], description: 'A brushed throw blanket in the British Columbia provincial tartan.' },
  { handle: 'bruce-tartan-cushion-cover', title: 'Bruce Tartan Cushion Cover', type: 'Home Decor', price: '32.00', sizes: false, palette: 'royalRed', tags: ['clans-a-l', 'home-decor', 'new-arrivals'], description: 'A zippered cushion cover in the Bruce tartan, sized for 45cm inserts.' },
  { handle: 'quebec-tartan-table-runner', title: 'Quebec Tartan Table Runner', type: 'Home Decor', price: '38.00', sizes: false, palette: 'mapleRed', tags: ['canada-province-tartan', 'home-decor'], description: 'A woven table runner in the Quebec provincial tartan.' },
  { handle: 'highland-tartan-slippers', title: 'Highland Tartan Slippers', type: 'Footwear', price: '44.00', sizes: false, palette: 'highlandGreen', tags: ['footwear'], description: 'Cushioned indoor slippers in a highland green tartan with a memory-foam footbed.' },
  { handle: 'moffat-tartan-ankle-boots', title: 'Moffat Tartan Ankle Boots', type: 'Footwear', price: '135.00', sizes: false, palette: 'urbanGrey', tags: ['clans-m-y', 'footwear', 'new-arrivals'], description: 'Heeled ankle boots with Moffat tartan panels and a side zip.' },
  { handle: 'harris-tartan-flat-cap', title: 'Harris Tartan Flat Cap', type: 'Hats', price: '40.00', sizes: false, palette: 'peatBrown', tags: ['clans-a-l', 'tartan-flat-caps'], description: 'A classic flat cap in an earthy Harris tartan weave.' },
  { handle: 'donegal-tartan-flat-cap', title: 'Donegal Tartan Flat Cap', type: 'Hats', price: '44.00', sizes: false, palette: 'peatBrown', tags: ['ireland-county-tartan-a-k', 'tartan-flat-caps'], description: 'A flat cap in the County Donegal tartan with a satin lining.' },
  { handle: 'elliot-tartan-polo', title: 'Elliot Tartan Polo', type: 'Polos', price: '45.00', sizes: true, palette: 'coastalNavy', tags: ['clans-a-l', 'tartan-polos', 'women-shirts-tops', 'new-arrivals'], description: 'A slim-fit polo with Elliot tartan trim, cut for women.' },
  { handle: 'graham-tartan-tee', title: 'Graham Tartan Tee', type: 'T-Shirts', price: '29.00', sizes: true, palette: 'urbanGrey', tags: ['clans-a-l', 'tartan-tees', 'men-shirts-tops'], description: 'A crew-neck tee with a Graham tartan pocket detail.' },
  { handle: 'limerick-tartan-scarf', title: 'Limerick Tartan Scarf', type: 'Accessories', price: '36.00', sizes: false, palette: 'emeraldIrish', tags: ['ireland-county-tartan-l-w', 'women-accessories'], description: 'A featherweight scarf in the County Limerick tartan.' },
  { handle: 'waterford-tartan-wrap-coat', title: 'Waterford Tartan Wrap Coat', type: 'Outerwear', price: '139.00', sizes: true, palette: 'midnightWatch', tags: ['ireland-county-tartan-l-w', 'women-outerwear-jackets', 'new-arrivals'], description: 'A belted wrap coat in the County Waterford tartan.' },
  { handle: 'nova-scotia-tartan-hoodie', title: 'Nova Scotia Tartan Hoodie', type: 'Outerwear', price: '72.00', sizes: true, palette: 'coastalNavy', tags: ['canada-province-tartan', 'men-outerwear-jackets', 'new-arrivals'], description: 'A fleece-lined hoodie in the blue Nova Scotia provincial tartan.' },
  { handle: 'manitoba-tartan-duffle-bag', title: 'Manitoba Tartan Duffle Bag', type: 'Bags', price: '95.00', sizes: false, palette: 'mapleRed', tags: ['canada-province-tartan', 'men-accessories'], description: 'A weekender duffle in the Manitoba tartan with reinforced handles.' },
  { handle: 'argyll-tartan-curtain-panel', title: 'Argyll Tartan Curtain Panel', type: 'Home Decor', price: '58.00', sizes: false, palette: 'highlandGreen', tags: ['clans-a-l', 'home-decor'], description: 'A lined curtain panel in the Argyll district tartan.' },
];

const SIZES = ['S', 'M', 'L', 'XL'];

function validateCatalog() {
  const collectionHandles = new Set(COLLECTIONS.map((c) => c.handle));
  if (collectionHandles.size !== COLLECTIONS.length) throw new Error('duplicate collection handle');
  const productHandles = new Set();
  for (const p of PRODUCTS) {
    if (productHandles.has(p.handle)) throw new Error(`duplicate product handle: ${p.handle}`);
    productHandles.add(p.handle);
    if (!PALETTES[p.palette]) throw new Error(`unknown palette "${p.palette}" on ${p.handle}`);
    for (const tag of p.tags) {
      if (!collectionHandles.has(tag)) throw new Error(`product ${p.handle} tag "${tag}" has no collection`);
    }
  }
  for (const c of COLLECTIONS) {
    const count = PRODUCTS.filter((p) => p.tags.includes(c.handle)).length;
    if (count < 2) throw new Error(`collection ${c.handle} would have ${count} products (<2)`);
  }
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

async function main() {
  validateCatalog();
  if (dryRun) {
    console.log(`--dry-run: would ensure ${COLLECTIONS.length} smart collections:`);
    for (const c of COLLECTIONS) {
      const count = PRODUCTS.filter((p) => p.tags.includes(c.handle)).length;
      console.log(`  ${c.handle} ("${c.title}") — rule TAG=${c.handle} — ${count} products`);
    }
    console.log(`--dry-run: would ensure ${PRODUCTS.length} products:`);
    for (const p of PRODUCTS) {
      console.log(JSON.stringify(productSetInput(p)));
    }
    console.log('Dry run complete.');
    return;
  }
  throw new Error('Live seeding not implemented yet (Task 3).');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
