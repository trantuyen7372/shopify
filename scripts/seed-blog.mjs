#!/usr/bin/env node
// scripts/seed-blog.mjs
// Fills the "news" blog with demo articles so the homepage journal section shows
// real posts instead of Dawn's onboarding placeholders. Each article gets a
// generated tartan cover image uploaded to Shopify Files.
//
// Idempotent: an article whose handle already exists is skipped.
//
// Usage:
//   node --env-file=.env scripts/seed-blog.mjs [--dry-run]

import { tartanPNG } from './tartan-png.mjs';
import { PALETTES } from './palettes.mjs';

const domain = process.env.SHOPIFY_STORE_DOMAIN;
const token = process.env.SHOPIFY_ADMIN_TOKEN;
const dryRun = process.argv.includes('--dry-run');

if (!domain || !token) {
  console.error('Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_TOKEN env vars.');
  process.exit(1);
}

const API_VERSION = '2025-01';
const endpoint = `https://${domain}/admin/api/${API_VERSION}/graphql.json`;
const BLOG_HANDLE = 'news';
const AUTHOR = 'The Tartan Desk';

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

const ARTICLES = [
  {
    handle: 'how-to-read-a-tartan-sett',
    title: 'How to Read a Tartan Sett',
    palette: 'highlandGreen',
    summary: 'The repeating block of colour that defines every tartan, and how to spot one at a glance.',
    body: `<p>A sett is the repeating block of coloured threads that defines a tartan. Read it once and the whole cloth makes sense: the sequence runs out to a pivot, mirrors back, and repeats across both the warp and the weft.</p>
<p>Because the same sequence runs in both directions, every crossing point blends two colours into a third. That is why a two-colour tartan still looks like it holds four or five shades.</p>
<p>Next time you pick up a scarf, find one full repeat and count the bands. The rest of the pattern is that count, over and over.</p>`,
  },
  {
    handle: 'choosing-a-tartan-for-everyday-wear',
    title: 'Choosing a Tartan for Everyday Wear',
    palette: 'coastalNavy',
    summary: 'Scale, contrast and colour temperature matter more than the name on the label.',
    body: `<p>The name on the label matters less than three practical things: the scale of the repeat, the contrast between bands, and how warm or cool the ground colour is.</p>
<p>A small repeat with low contrast reads almost as a solid from across a room, which makes it easy to wear daily. A large, high-contrast repeat is a statement piece — beautiful, but it wants to be the only pattern you have on.</p>
<p>If you are buying your first piece, start with a cool, muted ground and save the bright reds for when you know what you like.</p>`,
  },
  {
    handle: 'caring-for-wool-and-brushed-cotton',
    title: 'Caring for Wool and Brushed Cotton',
    palette: 'peatBrown',
    summary: 'Cool water, gentle detergent, and drying flat will outlast any fabric trick.',
    body: `<p>Wool and brushed cotton both last far longer than most people expect, provided they are washed cool and dried flat.</p>
<p>Use a gentle detergent, skip the fabric softener — it coats the fibres and dulls the weave — and never wring a wool piece. Press the water out between two towels instead.</p>
<p>Store folded rather than hung. A heavy jacket on a thin hanger will stretch at the shoulders within a season.</p>`,
  },
  {
    handle: 'tartan-in-the-modern-home',
    title: 'Tartan in the Modern Home',
    palette: 'midnightWatch',
    summary: 'One patterned piece per room is usually the right amount.',
    body: `<p>Tartan reads as traditional, but it sits happily in a plain modern room as long as it is the only pattern present.</p>
<p>Pick one piece per room — a throw over a chair, a runner down a table, a single cushion — and let everything around it stay flat in colour.</p>
<p>If you want two, keep them in the same colour family and vary the scale: a large repeat on the larger object, a small one on the smaller.</p>`,
  },
];

async function findBlog() {
  const data = await adminGraphql('query Blogs { blogs(first: 20) { nodes { id handle } } }');
  const blog = data.blogs.nodes.find((b) => b.handle === BLOG_HANDLE);
  if (!blog) throw new Error(`Blog "${BLOG_HANDLE}" not found.`);
  return blog;
}

async function existingHandles(blogId) {
  const data = await adminGraphql(
    'query Articles($id: ID!) { blog(id: $id) { articles(first: 50) { nodes { handle } } } }',
    { id: blogId }
  );
  return new Set(data.blog.articles.nodes.map((a) => a.handle));
}

async function uploadCover(article) {
  const png = tartanPNG(PALETTES[article.palette], 1200, 6, 800);
  const filename = `journal-${article.handle}.png`;
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
      input: [{ filename, mimeType: 'image/png', httpMethod: 'POST', resource: 'FILE', fileSize: String(png.length) }],
    }
  );
  if (staged.stagedUploadsCreate.userErrors.length) {
    throw new Error(`stagedUploadsCreate userErrors: ${JSON.stringify(staged.stagedUploadsCreate.userErrors)}`);
  }
  const target = staged.stagedUploadsCreate.stagedTargets[0];
  const form = new FormData();
  for (const { name, value } of target.parameters) form.append(name, value);
  form.append('file', new Blob([png], { type: 'image/png' }), filename);
  const uploadResponse = await fetch(target.url, { method: 'POST', body: form });
  if (!uploadResponse.ok) throw new Error(`staged upload failed for "${filename}": HTTP ${uploadResponse.status}`);
  return target.resourceUrl;
}

async function main() {
  const blog = await findBlog();
  const existing = await existingHandles(blog.id);
  let created = 0;
  let skipped = 0;
  for (const article of ARTICLES) {
    if (existing.has(article.handle)) {
      skipped++;
      continue;
    }
    if (dryRun) {
      console.log(`--dry-run: would create article "${article.handle}"`);
      created++;
      continue;
    }
    const imageUrl = await uploadCover(article);
    const data = await adminGraphql(
      `
        mutation CreateArticle($article: ArticleCreateInput!) {
          articleCreate(article: $article) {
            article { id handle }
            userErrors { field message }
          }
        }
      `,
      {
        article: {
          blogId: blog.id,
          title: article.title,
          handle: article.handle,
          body: article.body,
          summary: article.summary,
          author: { name: AUTHOR },
          image: { url: imageUrl, altText: `${article.title} — tartan illustration` },
          isPublished: true,
        },
      }
    );
    const { userErrors, article: made } = data.articleCreate;
    if (userErrors.length) throw new Error(`articleCreate userErrors for "${article.handle}": ${JSON.stringify(userErrors)}`);
    console.log(`Created article "${made.handle}"`);
    created++;
  }
  console.log(`Articles: ${created} created, ${skipped} skipped.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
