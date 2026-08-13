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
    body: `
      <p>Tartan Club is our loyalty program for regular customers. Membership is free, and every purchase earns points toward your next order.</p>
      <h2>How it works</h2>
      <ul>
        <li>Earn 1 point for every dollar spent, tracked automatically on your account.</li>
        <li>Redeem 100 points for a $5 reward, stackable on any order.</li>
        <li>Members see new arrivals and restocks a day before everyone else.</li>
      </ul>
      <h2>Membership tiers</h2>
      <p><strong>Highland (0+ points)</strong> — free to join, earns on every order.<br>
      <strong>Clan (500+ points)</strong> — free shipping on all orders, birthday reward.<br>
      <strong>Chieftain (1,500+ points)</strong> — everything in Clan, plus first access to limited setts and an annual gift.</p>
      <p>Points are calculated automatically when you check out while signed in. There is nothing else to activate — creating an account is enough to start earning.</p>
      <p><em>This page describes the intended program; replace the specifics above (point values, tier thresholds) with your actual configuration before launch.</em></p>
    `,
  },
  {
    handle: 'about-us',
    title: 'About Us',
    body: `
      <p>We make tartan-inspired apparel and home goods for people who want their heritage in daily use, not folded away in a drawer.</p>
      <h2>What we do</h2>
      <p>Every piece we sell starts from a sett — the repeating colour sequence that gives a tartan its identity. We work through clan, regional and provincial patterns, translating each one into clothing, accessories and home textiles that hold up to actual wear.</p>
      <h2>How we work</h2>
      <p>We keep the catalog focused: a smaller number of well-made styles across sizes, rather than a wide range of one-off pieces. Fabric choices favour natural fibres — wool, brushed cotton — because they wear better and age better than synthetics.</p>
      <h2>Where we're headed</h2>
      <p>We're expanding the catalog gradually, prioritising patterns and categories our customers ask for. If there's a tartan or a product you'd like to see, our <a href="/pages/contact-us">contact page</a> reaches the team directly.</p>
      <p><em>This is placeholder brand copy — replace it with your store's real story, founding details, and any information specific to your business before launch.</em></p>
    `,
  },
  {
    handle: 'contact-us',
    title: 'Contact Us',
    body: `
      <p>Questions about an order, a product, or a tartan you can't find in the catalog? Send us a message using the form below and we'll get back to you within one business day.</p>
      <p>For order-specific questions, include your order number so we can look it up quickly.</p>
      <p><em>Replace this intro text and connect the contact form to your real support inbox before launch.</em></p>
    `,
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
      'query FindPage($query: String!) { pages(first: 1, query: $query) { nodes { id handle body } } }',
      { query: `handle:${page.handle}` }
    );
    const found = existing.pages.nodes[0];
    if (found) {
      if (found.body === page.body) {
        console.log(`Page "${page.handle}" already up to date, skipping.`);
        continue;
      }
      if (dryRun) {
        console.log(`--dry-run: would update page "${page.handle}" body`);
        continue;
      }
      const updateData = await adminGraphql(
        `
          mutation UpdatePage($id: ID!, $page: PageUpdateInput!) {
            pageUpdate(id: $id, page: $page) {
              page { id handle }
              userErrors { field message }
            }
          }
        `,
        { id: found.id, page: { title: page.title, body: page.body } }
      );
      const { userErrors: updateErrors, page: updated } = updateData.pageUpdate;
      if (updateErrors.length) {
        throw new Error(`pageUpdate userErrors for "${page.handle}": ${JSON.stringify(updateErrors)}`);
      }
      console.log(`Updated page "${updated.handle}" (${updated.id})`);
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
