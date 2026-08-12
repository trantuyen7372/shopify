#!/usr/bin/env node
// Provisions the tartan-shop "main-menu" navigation tree and placeholder
// pages via the Shopify Admin GraphQL API.
//
// Usage:
//   node --env-file=.env scripts/setup-navigation.mjs [--dry-run]

import { createMenuItemBuilder } from './menu-items.mjs';
import { TAXONOMY } from './taxonomy.mjs';

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

// The menu mirrors the shared catalog taxonomy, so a collection can never
// appear in the nav without existing in the catalog.
const menuTree = TAXONOMY;

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
