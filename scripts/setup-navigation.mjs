#!/usr/bin/env node
// Provisions the tartan-shop "main-menu" navigation tree and placeholder
// pages via the Shopify Admin GraphQL API.
//
// Usage:
//   node --env-file=.env scripts/setup-navigation.mjs [--dry-run]

const domain = process.env.SHOPIFY_STORE_DOMAIN;
const token = process.env.SHOPIFY_ADMIN_TOKEN;
const dryRun = process.argv.includes('--dry-run');

if (!domain || !token) {
  console.error('Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_TOKEN env vars.');
  process.exit(1);
}

const API_VERSION = '2025-01';
const endpoint = `https://${domain}/admin/api/${API_VERSION}/graphql.json`;

async function adminGraphql(query, variables) {
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
    throw new Error(`GraphQL error: ${JSON.stringify(json.errors)}`);
  }
  return json.data;
}

const menuTree = [
  {
    title: 'Find Your Clans',
    url: '/collections/all',
    items: [
      { title: 'Clans A-L', url: '/collections/all' },
      { title: 'Clans M-Y', url: '/collections/all' },
      { title: 'Canada Province Tartan', url: '/collections/all' },
      { title: 'Ireland County Tartan A-K', url: '/collections/all' },
      { title: 'Ireland County Tartan L-W', url: '/collections/all' },
    ],
  },
  {
    title: 'For Men',
    url: '/collections/all',
    items: [
      { title: 'Shirts & Tops', url: '/collections/all' },
      { title: 'Outerwear & Jacket', url: '/collections/all' },
      { title: 'Pants', url: '/collections/all' },
      { title: 'Clothing Accessories', url: '/collections/all' },
      { title: 'Sleepwear', url: '/collections/all' },
    ],
  },
  {
    title: 'For Women',
    url: '/collections/all',
    items: [
      { title: 'Shirts & Tops', url: '/collections/all' },
      { title: 'Outerwear & Jacket', url: '/collections/all' },
      { title: 'Bottoms', url: '/collections/all' },
      { title: 'Dresses', url: '/collections/all' },
      { title: 'Handbags', url: '/collections/all' },
      { title: 'Clothing Accessories', url: '/collections/all' },
      { title: 'Sleepwear', url: '/collections/all' },
      { title: 'Swimwear', url: '/collections/all' },
    ],
  },
  { title: 'New Arrivals', url: '/collections/all' },
  { title: 'Home Decor', url: '/collections/all' },
  { title: 'Footwears', url: '/collections/all' },
  { title: 'Blog', url: '/blogs/news' },
  { title: 'Tartan Club', url: '/pages/tartan-club' },
  { title: 'About Us', url: '/pages/about-us' },
  { title: 'Contact Us', url: '/pages/contact-us' },
];

const pagesToEnsure = [
  {
    handle: 'tartan-club',
    title: 'Tartan Club',
    body: '<p>Join the Tartan Club loyalty program for early access to new arrivals and member-only offers.</p>',
  },
  {
    handle: 'about-us',
    title: 'About Us',
    body: '<p>We design original tartan-inspired apparel and home goods. Replace this placeholder with your brand story.</p>',
  },
  {
    handle: 'contact-us',
    title: 'Contact Us',
    body: '<p>Get in touch with our team using the form below.</p>',
    templateSuffix: 'contact',
  },
];

function toMenuItemInput(node, baseUrl) {
  const input = {
    title: node.title,
    type: 'HTTP',
    url: `${baseUrl}${node.url}`,
  };
  if (node.items) {
    input.items = node.items.map((child) => toMenuItemInput(child, baseUrl));
  }
  return input;
}

async function getPrimaryDomainHost() {
  const data = await adminGraphql('query { shop { primaryDomain { host } } }');
  return data.shop.primaryDomain.host;
}

async function findMainMenu() {
  const data = await adminGraphql(`
    query {
      menus(first: 20) {
        nodes { id handle title }
      }
    }
  `);
  const menu = data.menus.nodes.find((m) => m.handle === 'main-menu');
  if (!menu) {
    throw new Error('Could not find a menu with handle "main-menu". Check Admin > Online Store > Navigation.');
  }
  return menu;
}

async function updateMainMenu(menu, baseUrl) {
  const items = menuTree.map((node) => toMenuItemInput(node, baseUrl));
  if (dryRun) {
    console.log('--dry-run: menuUpdate items payload:');
    console.log(JSON.stringify(items, null, 2));
    return;
  }
  const data = await adminGraphql(
    `
      mutation UpdateMainMenu($id: ID!, $title: String!, $items: [MenuItemUpdateInput!]!) {
        menuUpdate(id: $id, title: $title, items: $items) {
          menu { id handle }
          userErrors { field message }
        }
      }
    `,
    { id: menu.id, title: menu.title, items }
  );
  const { userErrors, menu: updatedMenu } = data.menuUpdate;
  if (userErrors.length) {
    throw new Error(`menuUpdate userErrors: ${JSON.stringify(userErrors)}`);
  }
  console.log(`Updated menu ${updatedMenu.handle} (${updatedMenu.id})`);
}

async function ensurePages() {
  for (const page of pagesToEnsure) {
    const existing = await adminGraphql(
      'query FindPage($query: String!) { pages(first: 1, query: $query) { nodes { id handle } } }',
      { query: `handle:${page.handle}` }
    );
    if (existing.pages.nodes.length) {
      console.log(`Page "${page.handle}" already exists, skipping.`);
      continue;
    }
    if (dryRun) {
      console.log(`--dry-run: would create page "${page.handle}"`);
      continue;
    }
    const data = await adminGraphql(
      `
        mutation CreatePage($page: PageCreateInput!) {
          pageCreate(page: $page) {
            page { id handle }
            userErrors { field message }
          }
        }
      `,
      {
        page: {
          title: page.title,
          handle: page.handle,
          body: page.body,
          templateSuffix: page.templateSuffix,
          isPublished: true,
        },
      }
    );
    const { userErrors, page: created } = data.pageCreate;
    if (userErrors.length) {
      throw new Error(`pageCreate userErrors for "${page.handle}": ${JSON.stringify(userErrors)}`);
    }
    console.log(`Created page "${created.handle}" (${created.id})`);
  }
}

async function main() {
  const baseUrl = `https://${await getPrimaryDomainHost()}`;
  const menu = await findMainMenu();
  await updateMainMenu(menu, baseUrl);
  await ensurePages();
  console.log(dryRun ? 'Dry run complete.' : 'Navigation setup complete.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
