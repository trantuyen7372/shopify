#!/usr/bin/env node
// Provisions the tartan-shop "main-menu" navigation tree and placeholder
// pages via the Shopify Admin GraphQL API.
//
// Usage:
//   node --env-file=.env scripts/setup-navigation.mjs [--dry-run]

import { createMenuItemBuilder } from './menu-items.mjs';

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
  const toMenuItemInput = createMenuItemBuilder(adminGraphql, baseUrl);
  const items = [];
  for (const node of menuTree) items.push(await toMenuItemInput(node));
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
