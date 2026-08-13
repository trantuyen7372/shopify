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
    handle: 'footer-information',
    title: 'Footer Information',
    items: [
      { title: 'Shipping Policy', url: '/pages/shipping-policy' },
      { title: 'Privacy Policy', url: '/pages/privacy-policy' },
      { title: 'Terms Of Service', url: '/pages/terms-of-service' },
      { title: 'Refund Policy', url: '/pages/refund-policy' },
      { title: 'Return Policy', url: '/pages/return-policy' },
      // Shopify auto-generates this at the store root; it is not a page or
      // collection, so it stays a plain absolute link.
      { title: 'Sitemap', url: '/sitemap.xml' },
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

// These are starting templates, not finished legal documents. Shopify's own
// /policies/* URLs stay 404 until the merchant fills them in under Settings →
// Policies, which is why these are ordinary pages rather than links to those.
// Every policy page carries a visible disclaimer for the same reason: generic
// template language should never be mistaken for reviewed legal text.
const LEGAL_DISCLAIMER =
  '<p><em>This is a starting template, not legal advice. Replace the bracketed placeholders with your real details and have the final text reviewed before launch.</em></p>';

const policyPages = [
  {
    handle: 'shipping-policy',
    title: 'Shipping Policy',
    body: `
      <h2>Processing time</h2>
      <p>Orders are processed within 1–2 business days. You will receive a shipping confirmation email with tracking as soon as your order ships.</p>
      <h2>Shipping methods and rates</h2>
      <ul>
        <li>Standard shipping: 5–7 business days</li>
        <li>Expedited shipping: 2–3 business days</li>
      </ul>
      <p>Exact rates are calculated at checkout based on destination and order weight.</p>
      <h2>International shipping</h2>
      <p>We ship to [list of countries]. International orders may be subject to customs fees and import duties charged by the destination country; these are the customer's responsibility.</p>
      <h2>Delays</h2>
      <p>Occasionally a shipment is delayed by weather, customs, or carrier volume beyond our control. Contact us at [support email] if your order hasn't arrived within the expected window.</p>
      ${LEGAL_DISCLAIMER}
    `,
  },
  {
    handle: 'privacy-policy',
    title: 'Privacy Policy',
    body: `
      <p>[Store Name] ("we", "us") operates this website. This policy explains what personal information we collect, how we use it, and the choices you have.</p>
      <h2>Information we collect</h2>
      <ul>
        <li>Contact and order details you provide at checkout (name, address, email, phone).</li>
        <li>Payment information, processed directly by our payment provider — we do not store full card numbers.</li>
        <li>Device and usage data (browser type, pages visited) collected automatically via cookies.</li>
      </ul>
      <h2>How we use it</h2>
      <p>To fulfil and ship orders, respond to support requests, prevent fraud, and — where you've opted in — send marketing emails.</p>
      <h2>Sharing</h2>
      <p>We share information with service providers who help us run the store (payment processing, shipping, email) under their own privacy obligations. We do not sell personal information.</p>
      <h2>Your rights</h2>
      <p>You can request access to, correction of, or deletion of your personal information by contacting us at [privacy email]. Depending on where you live, additional rights may apply under laws such as the GDPR or CCPA.</p>
      <h2>Cookies</h2>
      <p>We use cookies for cart functionality, analytics, and (where enabled) advertising. You can control cookies through your browser settings.</p>
      <h2>Changes to this policy</h2>
      <p>We may update this policy from time to time; the date below reflects the latest revision.</p>
      <p>Last updated: [date]</p>
      ${LEGAL_DISCLAIMER}
    `,
  },
  {
    handle: 'terms-of-service',
    title: 'Terms Of Service',
    body: `
      <p>These terms govern your use of [Store Name] (the "Site") and any purchase made through it. By using the Site, you agree to these terms.</p>
      <h2>Use of the site</h2>
      <p>You agree to use the Site only for lawful purposes and not to attempt to disrupt its operation or access data you're not authorised to access.</p>
      <h2>Products and pricing</h2>
      <p>We reserve the right to change prices, descriptions, and availability at any time. We make reasonable efforts to display products and pricing accurately but do not warrant that all information is error-free.</p>
      <h2>Orders</h2>
      <p>Receipt of an order confirmation does not guarantee acceptance — we may cancel an order for reasons including stock unavailability, pricing errors, or suspected fraud, in which case you will be refunded in full.</p>
      <h2>Intellectual property</h2>
      <p>All content on this Site — text, graphics, logos, and images — is owned by [Store Name] or its licensors and may not be reproduced without permission.</p>
      <h2>Limitation of liability</h2>
      <p>To the maximum extent permitted by law, [Store Name] is not liable for indirect, incidental, or consequential damages arising from use of the Site or products purchased through it.</p>
      <h2>Governing law</h2>
      <p>These terms are governed by the laws of [jurisdiction], without regard to conflict-of-law principles.</p>
      <h2>Changes</h2>
      <p>We may update these terms at any time; continued use of the Site after changes constitutes acceptance of the revised terms.</p>
      ${LEGAL_DISCLAIMER}
    `,
  },
  {
    handle: 'refund-policy',
    title: 'Refund Policy',
    body: `
      <h2>Eligibility</h2>
      <p>Refunds are available for items returned within 30 days of delivery, in unworn condition with original tags attached.</p>
      <h2>How refunds work</h2>
      <p>Once we receive and inspect your return, we'll email you to confirm approval. Approved refunds are issued to your original payment method within 5–10 business days.</p>
      <h2>Non-refundable items</h2>
      <ul>
        <li>Gift cards</li>
        <li>Items marked "Final Sale"</li>
        <li>Items returned outside the 30-day window</li>
      </ul>
      <h2>Damaged or incorrect items</h2>
      <p>If an item arrives damaged or isn't what you ordered, contact us at [support email] within 7 days of delivery with a photo, and we'll arrange a replacement or full refund at no cost to you.</p>
      <h2>Late or missing refunds</h2>
      <p>If it's been more than 10 business days since your return was approved, check with your bank or card provider first — processing times vary. If it still hasn't posted, contact us.</p>
      ${LEGAL_DISCLAIMER}
    `,
  },
  {
    handle: 'return-policy',
    title: 'Return Policy',
    body: `
      <h2>Return window</h2>
      <p>You have 30 days from the delivery date to start a return. Items must be unworn, unwashed, and have original tags attached.</p>
      <h2>How to start a return</h2>
      <p>Email [support email] with your order number and the item(s) you'd like to return. We'll send you a return shipping label and instructions.</p>
      <h2>Who pays for return shipping</h2>
      <p>Return shipping is free for defective or incorrect items. For all other returns, a flat [return shipping fee] is deducted from your refund unless you're exchanging for a different size or colour.</p>
      <h2>Exchanges</h2>
      <p>The fastest way to exchange an item is to return the original and place a new order for the item you want — this guarantees the replacement is in stock.</p>
      <h2>Final sale items</h2>
      <p>Items marked "Final Sale" at checkout cannot be returned or exchanged.</p>
      ${LEGAL_DISCLAIMER}
    `,
  },
];

const pagesToEnsure = [
  ...policyPages,
  {
    handle: 'faqs',
    title: 'FAQs',
    body: `
      <h2>How long does shipping take?</h2>
      <p>Standard orders arrive in 5–7 business days after processing; see our <a href="/pages/shipping-policy">Shipping Policy</a> for full details.</p>
      <h2>What sizes do you carry?</h2>
      <p>Most apparel runs S–XL. Each product page lists the exact size run and a size guide where available.</p>
      <h2>Can I return an item?</h2>
      <p>Yes — unworn items with tags attached can be returned within 30 days. See our <a href="/pages/return-policy">Return Policy</a> for the full process.</p>
      <h2>Do you ship internationally?</h2>
      <p>See our <a href="/pages/shipping-policy">Shipping Policy</a> for the current list of countries and rates.</p>
      <h2>How do I track my order?</h2>
      <p>You'll receive a tracking link by email once your order ships. You can also check status on our <a href="/pages/order-tracking">Order Tracking</a> page.</p>
      <p><em>Replace these with your store's real, frequently-asked questions before launch.</em></p>
    `,
  },
  {
    handle: 'order-tracking',
    title: 'Order Tracking',
    body: `
      <p>Enter your order number and the email address used at checkout to see your shipment status.</p>
      <p>Tracking updates can take 24–48 hours to appear after a carrier first scans your package. If tracking hasn't updated after that window, contact us at [support email] with your order number.</p>
      <p><em>Replace this placeholder with real tracking instructions or an order-tracking app embed before launch.</em></p>
    `,
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
  // Pages first: the menu builder resolves each page link to its resource id, so
  // a page that does not exist yet would fall back to an absolute HTTP link.
  await ensurePages();
  for (const menuDef of footerMenus) {
    await ensureMenu(menuDef, baseUrl);
  }
  console.log(dryRun ? 'Dry run complete.' : 'Footer navigation setup complete.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
