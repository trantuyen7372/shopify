# Demo Catalog Seeding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seed 24 smart collections and 40 tartan demo products (with procedurally generated plaid images) into the dev store via Admin GraphQL, then re-point every `/collections/all` placeholder link in the nav, footer, and homepage at the real collections.

**Architecture:** One pure module `scripts/tartan-png.mjs` (zero-dep PNG encoder + tartan renderer) consumed by one idempotent ops script `scripts/seed-catalog.mjs` (catalog data + Admin GraphQL flow, same conventions as the two existing `setup-*.mjs` scripts). Link re-pointing is then plain edits to the two existing nav scripts (re-run against the store) and `templates/index.json`.

**Tech Stack:** Node 20+ (built-ins only: `zlib`, `fetch`, `FormData`, `Blob`), Shopify Admin GraphQL API `2025-01`, Shopify CLI (`shopify theme dev`), Playwright MCP for QA.

**Spec:** `docs/superpowers/specs/2026-07-14-demo-catalog-seeding-design.md`

## Global Constraints

- **Zero npm dependencies** — no `package.json`, no `node_modules`. Node built-ins only.
- Admin API version `2025-01`; credentials from gitignored `.env` (`SHOPIFY_STORE_DOMAIN`, `SHOPIFY_ADMIN_TOKEN`); run scripts as `node --env-file=.env scripts/<name>.mjs`.
- All scripts idempotent (look up by handle, skip if exists) and fail hard on any GraphQL `userErrors`.
- Images are deterministic: same palette in → byte-identical PNG out. No `Math.random()`, no timestamps.
- All product names/descriptions are original copy; never copy text from any reference site.
- Every one of the 24 collections must end with ≥ 2 products; `/collections/all` may remain ONLY on the three top-level mega-menu parents (Find Your Clans / For Men / For Women).
- Dev store: `nongsanhaiduong.myshopify.com`. It is a dev store — live mutations are expected and safe here.

---

### Task 1: Tartan PNG generator module

**Files:**
- Create: `scripts/tartan-png.mjs`

**Interfaces:**
- Consumes: nothing (pure module, no side effects at import).
- Produces: `encodePNG(width, height, pixelAt) -> Buffer` where `pixelAt(x, y)` returns `[r, g, b]`; `tartanPNG(sett, size = 800, threadPx = 6) -> Buffer` where `sett` is `[{ color: '#rrggbb', count: <threads> }, ...]`. Task 2/3's `seed-catalog.mjs` imports `tartanPNG` via `import { tartanPNG } from './tartan-png.mjs'`.

- [x] **Step 1: Write the module**

```js
// scripts/tartan-png.mjs
// Procedural tartan-plaid PNG generation, zero dependencies.
// A tartan sett is a sequence of colored thread bands; it is mirrored for
// symmetry, rendered identically in warp (x) and weft (y), and blended
// where bands cross with a 2/2 twill pattern — like woven cloth.
import { deflateSync } from 'node:zlib';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

export function encodePNG(width, height, pixelAt) {
  const raw = Buffer.alloc(height * (1 + width * 3));
  let offset = 0;
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0; // filter type: None
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixelAt(x, y);
      raw[offset++] = r;
      raw[offset++] = g;
      raw[offset++] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function hexToRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

export function tartanPNG(sett, size = 800, threadPx = 6) {
  // Mirror the sett (excluding the endpoints to avoid doubled bands).
  const bands = [...sett, ...sett.slice(1, -1).reverse()];
  const threads = bands.flatMap((band) => Array(band.count).fill(hexToRgb(band.color)));
  const threadAt = (px) => threads[Math.floor(px / threadPx) % threads.length];
  return encodePNG(size, size, (x, y) => {
    const warp = threadAt(x);
    const weft = threadAt(y);
    return (x + y) % 4 < 2 ? warp : weft; // 2/2 twill weave
  });
}
```

- [x] **Step 2: Run the structural test (decode what we encoded)**

```bash
cd /Users/duka/Work/Gin/Lucas/shopify && node --input-type=module -e "
import { tartanPNG } from './scripts/tartan-png.mjs';
import { inflateSync } from 'node:zlib';
import assert from 'node:assert';
const sett = [
  { color: '#1f4d36', count: 24 }, { color: '#0d2b1d', count: 6 },
  { color: '#b3202c', count: 4 }, { color: '#0d2b1d', count: 6 },
  { color: '#274e6d', count: 16 },
];
const png = tartanPNG(sett, 200, 4);
assert.deepStrictEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'PNG signature');
assert.strictEqual(png.readUInt32BE(16), 200, 'IHDR width');
assert.strictEqual(png.readUInt32BE(20), 200, 'IHDR height');
assert.strictEqual(png.toString('ascii', 37, 41), 'IDAT', 'IDAT chunk position');
const idatLen = png.readUInt32BE(33);
const raw = inflateSync(png.subarray(41, 41 + idatLen));
assert.strictEqual(raw.length, 200 * (1 + 200 * 3), 'decoded scanline byte count');
const again = tartanPNG(sett, 200, 4);
assert.ok(png.equals(again), 'deterministic output');
console.log('tartan-png structural test OK');
"
```

Expected: `tartan-png structural test OK`

- [x] **Step 3: Visual check — write an 800px sample and look at it**

```bash
node --input-type=module -e "
import { tartanPNG } from './scripts/tartan-png.mjs';
import { writeFileSync } from 'node:fs';
writeFileSync(process.env.OUT, tartanPNG([
  { color: '#1f4d36', count: 24 }, { color: '#0d2b1d', count: 6 },
  { color: '#b3202c', count: 4 }, { color: '#0d2b1d', count: 6 },
  { color: '#274e6d', count: 16 },
]));
" # with OUT=<scratchpad>/tartan-sample.png
sips -g pixelWidth -g pixelHeight <scratchpad>/tartan-sample.png
```

Expected: `pixelWidth: 800`, `pixelHeight: 800`. Then **Read the PNG file with the Read tool** and confirm it visually reads as a tartan plaid (crossing color bands with twill texture), not stripes or noise.

- [x] **Step 4: Commit**

```bash
git add scripts/tartan-png.mjs
git commit -m "feat: add zero-dep procedural tartan PNG generator"
```

---

### Task 2: Catalog data + validation + dry-run skeleton

**Files:**
- Create: `scripts/seed-catalog.mjs`

**Interfaces:**
- Consumes: `tartanPNG` from Task 1 (imported now, used live in Task 3).
- Produces: module-internal `PALETTES`, `COLLECTIONS` (24 entries `{ handle, title }`), `PRODUCTS` (40 entries `{ handle, title, type, price, sizes, palette, tags, description }`), `validateCatalog()`, `productSetInput(p)`, `adminGraphql(query, variables)`. Task 3 extends this same file with the live mutation flow.

- [x] **Step 1: Write the script with full catalog data**

```js
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
```

- [x] **Step 2: Run dry-run to verify data validates and payloads print**

```bash
node --env-file=.env scripts/seed-catalog.mjs --dry-run
```

Expected: 24 collection lines (each showing ≥ 2 products), 40 product JSON payloads, then `Dry run complete.` — exit code 0. If `validateCatalog` throws, fix the data table (do not weaken the validation).

- [x] **Step 3: Commit**

```bash
git add scripts/seed-catalog.mjs
git commit -m "feat: add demo catalog data and dry-run for seed script"
```

---

### Task 3: Live seeding flow (collections, products, images, publish)

**Files:**
- Modify: `scripts/seed-catalog.mjs` (extend Task 2's file: add live functions, replace `main()`)

**Interfaces:**
- Consumes: everything from Task 2, plus `tartanPNG(sett)` from Task 1.
- Produces: a complete, idempotent live run plus a `--verify` mode used by Task 4. No exports.

- [x] **Step 1: Add the live-flow functions above `main()`**

```js
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

async function ensureCollections(publicationId) {
  let created = 0;
  let skipped = 0;
  for (const c of COLLECTIONS) {
    const existing = await adminGraphql(
      'query FindCollection($q: String!) { collections(first: 1, query: $q) { nodes { id handle } } }',
      { q: `handle:${c.handle}` }
    );
    if (existing.collections.nodes.length) {
      console.log(`Collection "${c.handle}" already exists, skipping.`);
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
    console.log(`Created collection "${collection.handle}" (${collection.id})`);
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

async function ensureProducts(publicationId) {
  let created = 0;
  let skipped = 0;
  for (const p of PRODUCTS) {
    const existing = await adminGraphql(
      'query FindProduct($q: String!) { products(first: 1, query: $q) { nodes { id handle } } }',
      { q: `handle:${p.handle}` }
    );
    if (existing.products.nodes.length) {
      console.log(`Product "${p.handle}" already exists, skipping.`);
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
    console.log(`Created product "${product.handle}" (${product.id})`);
    created++;
  }
  console.log(`Products: ${created} created, ${skipped} skipped.`);
}

async function verify() {
  let failures = 0;
  for (const c of COLLECTIONS) {
    const data = await adminGraphql(
      'query VerifyCollection($q: String!) { collections(first: 1, query: $q) { nodes { handle productsCount { count } } } }',
      { q: `handle:${c.handle}` }
    );
    const node = data.collections.nodes[0];
    const count = node ? node.productsCount.count : 0;
    if (count < 2) {
      console.error(`FAIL collection ${c.handle}: ${count} products (<2)`);
      failures++;
    } else {
      console.log(`ok collection ${c.handle}: ${count} products`);
    }
  }
  for (const p of PRODUCTS) {
    const data = await adminGraphql(
      'query VerifyProduct($q: String!) { products(first: 1, query: $q) { nodes { handle onlineStoreUrl media(first: 1) { nodes { id } } } } }',
      { q: `handle:${p.handle}` }
    );
    const node = data.products.nodes[0];
    if (!node) {
      console.error(`FAIL product ${p.handle}: not found`);
      failures++;
    } else if (!node.onlineStoreUrl) {
      console.error(`FAIL product ${p.handle}: not published to Online Store`);
      failures++;
    } else if (!node.media.nodes.length) {
      console.error(`FAIL product ${p.handle}: no image`);
      failures++;
    } else {
      console.log(`ok product ${p.handle}`);
    }
  }
  if (failures) throw new Error(`Verification failed: ${failures} problem(s).`);
  console.log('Verification passed: all collections have >=2 products; all products published with images.');
}
```

- [x] **Step 2: Replace `main()` with the full flow**

```js
async function main() {
  validateCatalog();
  if (verifyOnly) {
    await verify();
    return;
  }
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
  const publicationId = await getOnlineStorePublicationId();
  await ensureCollections(publicationId);
  await ensureProducts(publicationId);
  console.log('Catalog seeding complete. Run with --verify to check results.');
}
```

- [x] **Step 3: Re-run dry-run to confirm nothing regressed**

```bash
node --env-file=.env scripts/seed-catalog.mjs --dry-run
```

Expected: same output as Task 2 Step 2 — 24 collections, 40 payloads, `Dry run complete.`, exit 0, **no network mutations**.

- [x] **Step 4: Commit**

```bash
git add scripts/seed-catalog.mjs
git commit -m "feat: add live seeding flow with images and channel publishing"
```

**API notes for the implementer:**
- If the publications query rejects the `name` field on this API version, use `publications(first: 20) { nodes { id catalog { title } } }` and match `catalog.title === 'Online Store'`.
- If any call fails with an access/permission error, the custom app token lacks a scope. The app needs `write_products` and `write_publications` (plus existing scopes). Fix in Admin → Settings → Apps and sales channels → Develop apps → [the app] → Configuration, then reinstall/regenerate the token and update `.env`. Report this to the user if it happens — do not silently skip.

---

### Task 4: Live run against the dev store + verification + idempotency

**Files:** none (runs Task 3's script; code changes only if live errors reveal bugs — fix in `scripts/seed-catalog.mjs` and commit fixes).

- [x] **Step 1: Live run**

```bash
node --env-file=.env scripts/seed-catalog.mjs
```

Expected: `Collections: 24 created, 0 skipped.` … `Products: 40 created, 0 skipped.` … `Catalog seeding complete.` (If a partial earlier run happened, skipped counts > 0 are fine.) On any `userErrors`, fix the root cause and re-run — idempotency makes re-runs safe.

- [x] **Step 2: Verify via API**

```bash
node --env-file=.env scripts/seed-catalog.mjs --verify
```

Expected: `ok` for all 24 collections and 40 products, ending `Verification passed…`. Smart-collection membership can lag a few seconds after seeding — if collection counts fail immediately after Step 1, wait ~30 seconds and re-run `--verify` before debugging.

- [x] **Step 3: Idempotency re-run**

```bash
node --env-file=.env scripts/seed-catalog.mjs
```

Expected: `Collections: 0 created, 24 skipped.` and `Products: 0 created, 40 skipped.`

- [x] **Step 4: Commit (only if fixes were needed)**

```bash
git add scripts/seed-catalog.mjs
git commit -m "fix: <describe live-run fix>"
```

---

### Task 5: Re-point header & footer nav links, re-run nav scripts

**Files:**
- Modify: `scripts/setup-navigation.mjs:36-80` (the `menuTree` array)
- Modify: `scripts/setup-footer-navigation.mjs:41-47` (the `footer-shop-by-category` items)

**Interfaces:**
- Consumes: collection handles created in Task 4 (they must exist live before re-running these scripts).
- Produces: updated live menus in the store; later tasks assume header/footer links resolve to populated collections.

- [x] **Step 1: Replace `menuTree` in `scripts/setup-navigation.mjs` with:**

```js
const menuTree = [
  {
    title: 'Find Your Clans',
    url: '/collections/all',
    items: [
      { title: 'Clans A-L', url: '/collections/clans-a-l' },
      { title: 'Clans M-Y', url: '/collections/clans-m-y' },
      { title: 'Canada Province Tartan', url: '/collections/canada-province-tartan' },
      { title: 'Ireland County Tartan A-K', url: '/collections/ireland-county-tartan-a-k' },
      { title: 'Ireland County Tartan L-W', url: '/collections/ireland-county-tartan-l-w' },
    ],
  },
  {
    title: 'For Men',
    url: '/collections/all',
    items: [
      { title: 'Shirts & Tops', url: '/collections/men-shirts-tops' },
      { title: 'Outerwear & Jacket', url: '/collections/men-outerwear-jackets' },
      { title: 'Pants', url: '/collections/men-pants' },
      { title: 'Clothing Accessories', url: '/collections/men-accessories' },
      { title: 'Sleepwear', url: '/collections/men-sleepwear' },
    ],
  },
  {
    title: 'For Women',
    url: '/collections/all',
    items: [
      { title: 'Shirts & Tops', url: '/collections/women-shirts-tops' },
      { title: 'Outerwear & Jacket', url: '/collections/women-outerwear-jackets' },
      { title: 'Bottoms', url: '/collections/women-bottoms' },
      { title: 'Dresses', url: '/collections/women-dresses' },
      { title: 'Handbags', url: '/collections/women-handbags' },
      { title: 'Clothing Accessories', url: '/collections/women-accessories' },
      { title: 'Sleepwear', url: '/collections/women-sleepwear' },
      { title: 'Swimwear', url: '/collections/women-swimwear' },
    ],
  },
  { title: 'New Arrivals', url: '/collections/new-arrivals' },
  { title: 'Home Decor', url: '/collections/home-decor' },
  { title: 'Footwears', url: '/collections/footwear' },
  { title: 'Blog', url: '/blogs/news' },
  { title: 'Tartan Club', url: '/pages/tartan-club' },
  { title: 'About Us', url: '/pages/about-us' },
  { title: 'Contact Us', url: '/pages/contact-us' },
];
```

The three top-level `/collections/all` parents are **intentional** (spec §4): after seeding, "all" is a legitimate populated shop-all page.

- [x] **Step 2: Update the `footer-shop-by-category` items in `scripts/setup-footer-navigation.mjs` to:**

```js
      { title: 'Shop By Clan & Tartan', url: '/collections/clans-a-l' },
      { title: "Men's Tartan Collection", url: '/collections/men-shirts-tops' },
      { title: "Women's Tartan Collection", url: '/collections/women-shirts-tops' },
      { title: 'Tartan Flat Cap', url: '/collections/tartan-flat-caps' },
      { title: 'Tartan Polos', url: '/collections/tartan-polos' },
      { title: 'Tartan Tees', url: '/collections/tartan-tees' },
      { title: 'Home Decor', url: '/collections/home-decor' },
```

(Leave the `footer-customer-care` menu untouched — it links pages, not collections.)

- [x] **Step 3: Dry-run both scripts**

```bash
node --env-file=.env scripts/setup-navigation.mjs --dry-run
node --env-file=.env scripts/setup-footer-navigation.mjs --dry-run
```

Expected: printed payloads show the new `/collections/<handle>` URLs; only the three top-level parents still contain `/collections/all`.

- [x] **Step 4: Live-run both scripts**

```bash
node --env-file=.env scripts/setup-navigation.mjs
node --env-file=.env scripts/setup-footer-navigation.mjs
```

Expected: `Updated menu main-menu (…)` / footer script reports menus updated (its idempotent re-run path updates existing menus) with no `userErrors`. Existing pages report "already exists, skipping."

- [x] **Step 5: Commit**

```bash
git add scripts/setup-navigation.mjs scripts/setup-footer-navigation.mjs
git commit -m "feat: point header and footer nav at seeded collections"
```

---

### Task 6: Re-point homepage links in `templates/index.json`

**Files:**
- Modify: `templates/index.json`

**Interfaces:**
- Consumes: collection handles from Task 4.
- Produces: a homepage whose every link targets a populated collection; Task 7 QA depends on this.

- [x] **Step 1: Apply this exact link mapping** (each row is a JSON settings edit; everything else in the file stays untouched):

| Section → block | Setting | New value |
|---|---|---|
| `image_banner` → `button` | `button_label_1` | `"Shop New Arrivals"` |
| `image_banner` → `button` | `button_link_1` | `"shopify://collections/new-arrivals"` |
| `image_banner` → `button` | `button_link_2` | `"shopify://collections/clans-a-l"` |
| `clan_finder` → `clan-a-l` | `link` | `"/collections/clans-a-l"` |
| `clan_finder` → `clan-m-y` | `link` | `"/collections/clans-m-y"` |
| `clan_finder` → `canada-province` | `link` | `"/collections/canada-province-tartan"` |
| `clan_finder` → `ireland-a-k` | `link` | `"/collections/ireland-county-tartan-a-k"` |
| `clan_finder` → `ireland-l-w` | `link` | `"/collections/ireland-county-tartan-l-w"` |
| `featured_collection` (settings) | `title` | `"New Arrivals"` |
| `featured_collection` (settings) | `collection` | `"new-arrivals"` |
| `category_grid_apparel` → `c1` (Tartan T-Shirt) | `link` | `"/collections/tartan-tees"` |
| `category_grid_apparel` → `c2` (Tartan Polo Shirt) | `link` | `"/collections/tartan-polos"` |
| `category_grid_apparel` → `c3` (Women's Polo Shirt) | `link` | `"/collections/tartan-polos"` |
| `category_grid_apparel` → `c4` (Tartan Sweatshirt) | `link` | `"/collections/men-shirts-tops"` |
| `category_grid_apparel` → `c5` (Long Sleeve Button Shirts) | `link` | `"/collections/men-shirts-tops"` |
| `category_grid_apparel` → `c6` (Women's Casual Shirt) | `link` | `"/collections/women-shirts-tops"` |
| `category_grid_apparel` → `c7` (Tartan Hawaiian Shirt) | `link` | `"/collections/men-shirts-tops"` |
| `category_grid_hoodies` → `c1`, `c2`, `c3`, `c7` | `link` | `"/collections/men-outerwear-jackets"` |
| `category_grid_hoodies` → `c4`, `c5`, `c6`, `c8` | `link` | `"/collections/women-outerwear-jackets"` |
| `category_grid_dresses` → `c1`–`c5` | `link` | `"/collections/women-dresses"` |
| `category_grid_dresses` → `c6`, `c7` (skirts) | `link` | `"/collections/women-bottoms"` |
| `category_grid_decor` → `c1`–`c8` | `link` | `"/collections/home-decor"` |
| `category_grid_accessories` → `c1` (Tartan Classic Cap) | `link` | `"/collections/tartan-flat-caps"` |
| `category_grid_accessories` → `c2` (Tartan Beanies) | `link` | `"/collections/men-accessories"` |
| `category_grid_accessories` → `c3`–`c6` (bags) | `link` | `"/collections/women-handbags"` |
| `category_grid_accessories` → `c7` (Tartan Umbrellas) | `link` | `"/collections/women-accessories"` |

- [x] **Step 2: Validate**

```bash
python3 -c "import json; json.load(open('templates/index.json')); print('valid JSON')"
grep -c '/collections/all' templates/index.json
```

Expected: `valid JSON` and grep count `0` (grep exits 1 when count is 0 — that is the pass condition).

- [x] **Step 3: Commit**

```bash
git add templates/index.json
git commit -m "feat: point homepage links at seeded collections"
```

---

### Task 7: Live browser QA (theme dev + real pointer clicks)

**Files:** none (QA task; any bug found gets fixed and committed where it lives).

**Process constraint (from project memory, non-negotiable):** use REAL pointer-based clicks via Playwright MCP `browser_click` — never JS `.click()`/`dispatchEvent()` — because JS-triggered clicks bypass hit-testing and have already masked a real bug in Phase 3.

- [x] **Step 1: Start the live preview**

```bash
shopify theme dev
```

Run in background; wait for the local preview URL (default `http://127.0.0.1:9292`). This also syncs the Task 6 `templates/index.json` change to the development theme.

- [x] **Step 2: Homepage checks (Playwright, real clicks)**

1. Navigate to `http://127.0.0.1:9292`. Confirm the featured-collection section is titled "New Arrivals" and shows 8 product cards **with tartan images and prices** (not placeholder SVGs).
2. Click the banner button "Shop New Arrivals" → lands on `/collections/new-arrivals` with 12 products.
3. Back; click the clan-finder tile "Clans A-L" → `/collections/clans-a-l`, non-empty grid.
4. Back; click one category card per grid (e.g. "Tartan T-Shirt" → `/collections/tartan-tees` with 2 products; "Premium Quilts" → `/collections/home-decor` with 4 products).

- [x] **Step 3: Header mega menu checks**

1. Open "Find Your Clans" mega menu; click "Ireland County Tartan A-K" → 4 products.
2. Open "For Men"; click "Pants" → 2 products.
3. Open "For Women"; click "Dresses" → 2 products.
4. Click top-level "New Arrivals" → 12 products; "Footwears" → 2 products.

- [x] **Step 4: Product page check**

Click the "Gordon Tartan Trousers" card from `/collections/men-pants` → product page shows: tartan image, price `$79.00`, and a Size picker with S / M / L / XL. Select size "L" and click "Add to cart" → cart drawer/notification shows the item.

- [x] **Step 5: Footer check**

Scroll to footer; click "Tartan Polos" under Shop By Category → `/collections/tartan-polos` with 2 products.

- [x] **Step 6: No-stray-placeholder check**

On the homepage, evaluate `[...document.querySelectorAll('a[href*="/collections/all"]')].map(a => a.textContent.trim())`. Expected: only the three top-level mega-menu parents ("Find Your Clans", "For Men", "For Women"). Anything else is a missed link — fix it and re-check.

- [x] **Step 7: Report**

Summarize QA results (pass/fail per step, screenshots of homepage and one product page). Fix and commit any bugs found; re-run the failed check after each fix.
