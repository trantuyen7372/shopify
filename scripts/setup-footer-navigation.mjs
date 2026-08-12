#!/usr/bin/env node
// Provisions the tartan-shop footer navigation menus and placeholder
// pages via the Shopify Admin GraphQL API.
//
// Usage:
//   node --env-file=.env scripts/setup-footer-navigation.mjs [--dry-run]

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

const footerMenus = [
  {
    handle: 'footer-shop-by-category',
    title: 'Footer Shop By Category',
    items: [
      { title: 'Shop By Clan & Tartan', url: '/collections/clans-a-l' },
      { title: "Men's Tartan Collection", url: '/collections/men-shirts-tops' },
      { title: "Women's Tartan Collection", url: '/collections/women-shirts-tops' },
      { title: 'Tartan Flat Cap', url: '/collections/tartan-flat-caps' },
      { title: 'Tartan Polos', url: '/collections/tartan-polos' },
      { title: 'Tartan Tees', url: '/collections/tartan-tees' },
      { title: 'Home Decor', url: '/collections/home-decor' },
    ],
  },
  {
    handle: 'footer-customer-care',
    title: 'Footer Customer Care',
    items: [
      { title: 'FAQs', url: '/pages/faqs' },
      { title: 'Blog', url: '/blogs/news' },
      { title: 'About Us', url: '/pages/about-us' },
      { title: 'Contact Us', url: '/pages/contact-us' },
      { title: 'Order Tracking', url: '/pages/order-tracking' },
    ],
  },
];

const pagesToEnsure = [
  {
    handle: 'faqs',
    title: 'FAQs',
    body: '<p>Answers to common questions go here. Replace this placeholder with your real FAQ content.</p>',
  },
  {
    handle: 'order-tracking',
    title: 'Order Tracking',
    body: '<p>Enter your order number and email to track your shipment. Replace this placeholder with real tracking instructions or an app embed.</p>',
  },
];

async function getPrimaryDomainHost() {
  const data = await adminGraphql('query { shop { primaryDomain { host } } }');
  return data.shop.primaryDomain.host;
}

async function findMenuByHandle(handle) {
  const data = await adminGraphql(`
    query {
      menus(first: 50) {
        nodes { id handle title }
      }
    }
  `);
  return data.menus.nodes.find((m) => m.handle === handle) || null;
}

async function ensureMenu(menuDef, baseUrl) {
  const toMenuItemInput = createMenuItemBuilder(adminGraphql, baseUrl);
  const items = [];
  for (const node of menuDef.items) items.push(await toMenuItemInput(node));
  if (dryRun) {
    console.log(`--dry-run: menu "${menuDef.handle}" payload:`);
    console.log(JSON.stringify(items, null, 2));
    return;
  }
  const existing = await findMenuByHandle(menuDef.handle);
  if (existing) {
    const data = await adminGraphql(
      `
        mutation UpdateFooterMenu($id: ID!, $title: String!, $items: [MenuItemUpdateInput!]!) {
          menuUpdate(id: $id, title: $title, items: $items) {
            menu { id handle }
            userErrors { field message }
          }
        }
      `,
      { id: existing.id, title: menuDef.title, items }
    );
    const { userErrors, menu } = data.menuUpdate;
    if (userErrors.length) {
      throw new Error(`menuUpdate userErrors for "${menuDef.handle}": ${JSON.stringify(userErrors)}`);
    }
    console.log(`Updated menu ${menu.handle} (${menu.id})`);
    return;
  }
  const data = await adminGraphql(
    `
      mutation CreateFooterMenu($title: String!, $handle: String!, $items: [MenuItemCreateInput!]!) {
        menuCreate(title: $title, handle: $handle, items: $items) {
          menu { id handle }
          userErrors { field message }
        }
      }
    `,
    { title: menuDef.title, handle: menuDef.handle, items }
  );
  const { userErrors, menu } = data.menuCreate;
  if (userErrors.length) {
    throw new Error(`menuCreate userErrors for "${menuDef.handle}": ${JSON.stringify(userErrors)}`);
  }
  console.log(`Created menu ${menu.handle} (${menu.id})`);
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
  for (const menuDef of footerMenus) {
    await ensureMenu(menuDef, baseUrl);
  }
  await ensurePages();
  console.log(dryRun ? 'Dry run complete.' : 'Footer navigation setup complete.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
