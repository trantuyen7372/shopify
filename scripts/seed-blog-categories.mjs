#!/usr/bin/env node
// scripts/seed-blog-categories.mjs
// Creates the five category blogs the "Blog" mega-menu entry in taxonomy.mjs
// points to (Holiday, Culture, History, Fashion, How To) and seeds each with
// two short original articles carrying a generated tartan cover image, so the
// dropdown never opens onto an empty blog.
//
// Idempotent: an existing blog or article handle is left untouched.
//
// Usage:
//   node --env-file=.env scripts/seed-blog-categories.mjs [--dry-run]

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

// Each blog matches a Blog dropdown child in taxonomy.mjs; every blog gets two
// short, original articles so the dropdown never opens onto an empty page.
const BLOGS = [
  {
    handle: 'holiday',
    title: 'Holiday',
    articles: [
      {
        handle: 'hosting-in-tartan-for-the-holidays',
        title: 'Hosting in Tartan for the Holidays',
        palette: 'royalRed',
        summary: 'A tartan table runner and a few cushions do most of the seasonal work.',
        body: '<p>A table dressed for the holidays does not need much: one tartan runner, a matching cushion or two, and candlelight. The pattern reads as festive on its own, so resist the urge to add more than that.</p><p>If you are hosting more than once this season, pick a tartan in a colourway that also works past New Year — a deep green or navy carries through winter long after the red-and-gold pieces go back in the box.</p>',
      },
      {
        handle: 'a-tartan-gift-wrapping-guide',
        title: 'A Tartan Gift-Wrapping Guide',
        palette: 'mapleRed',
        summary: 'Plain paper, a tartan ribbon, and a sprig of something green.',
        body: '<p>Wrap the box in plain kraft or white paper, then let a length of tartan ribbon do the decorating. It reads as considered rather than themed, and it works whether the paper underneath is red, green, or brown.</p><p>Tuck a sprig of evergreen under the bow if you have it. That is the whole guide.</p>',
      },
    ],
  },
  {
    handle: 'culture',
    title: 'Culture',
    articles: [
      {
        handle: 'what-a-clan-tartan-actually-means',
        title: 'What a Clan Tartan Actually Means',
        palette: 'highlandGreen',
        summary: 'Most clan tartans as we know them today are Victorian, not medieval.',
        body: '<p>The idea that every Scottish clan has always had one fixed tartan is mostly a nineteenth-century invention. Before that, weavers used whatever dyes were local, and colour more often marked a region than a family name.</p><p>The Victorian era formalised hundreds of "clan" setts, many recorded for the first time in tartan pattern books rather than handed down for centuries. That history does not make the tartans less real today — it just means the tradition is younger, and more designed, than the romance suggests.</p>',
      },
      {
        handle: 'tartan-beyond-scotland',
        title: 'Tartan Beyond Scotland',
        palette: 'emeraldIrish',
        summary: 'Ireland, Canada and beyond each developed their own tartan traditions.',
        body: '<p>Tartan is not exclusively Scottish. Ireland has its own county tartans, formally registered the same way Scottish clan tartans are. Canadian provinces each carry an official sett, several designed within living memory to mark confederation anniversaries.</p><p>The common thread is not nationality — it is the idea of a repeating, registered pattern standing in for a place or a people.</p>',
      },
    ],
  },
  {
    handle: 'history',
    title: 'History',
    articles: [
      {
        handle: 'the-tartan-ban-and-its-repeal',
        title: 'The Tartan Ban and Its Repeal',
        palette: 'midnightWatch',
        summary: 'Tartan was legally banned in Scotland for 36 years after the 1745 rising.',
        body: '<p>After the Jacobite rising of 1745, the Dress Act of 1746 banned Highland dress, tartan included, for anyone other than the military. It stayed in force for thirty-six years.</p><p>When the ban was repealed in 1782, tartan came back not as everyday Highland wear but as a symbol — worn deliberately, and increasingly by people with no Highland background at all. That shift from clothing to symbol is most of why tartan means what it means today.</p>',
      },
      {
        handle: 'how-weaving-technology-changed-the-sett',
        title: 'How Weaving Technology Changed the Sett',
        palette: 'coastalNavy',
        summary: 'The jacquard loom made complex, multi-colour setts cheap to produce at scale.',
        body: '<p>Early tartans were limited by what a hand loom and natural dyes could do — usually two to four colours, repeated simply. The jacquard loom, mechanised through the nineteenth century, made complex multi-colour setts affordable to weave at scale for the first time.</p><p>That is a large part of why the elaborate, many-coloured tartans we associate with formal clan dress mostly date from after 1820, not before it.</p>',
      },
    ],
  },
  {
    handle: 'fashion',
    title: 'Fashion',
    articles: [
      {
        handle: 'pairing-tartan-with-solid-colours',
        title: 'Pairing Tartan with Solid Colours',
        palette: 'urbanGrey',
        summary: 'Pull one colour out of the sett and repeat it in a plain piece nearby.',
        body: '<p>The easiest way to wear tartan without it fighting the rest of an outfit is to pull one colour out of the sett and repeat it in something plain — a solid sweater in the same green, a belt in the same red.</p><p>Keep everything else neutral. Tartan is already doing the pattern work; a second pattern nearby competes with it rather than complementing it.</p>',
      },
      {
        handle: 'tartan-through-the-decades',
        title: 'Tartan Through the Decades',
        palette: 'roseBlush',
        summary: 'From punk safety pins to 90s grunge, tartan keeps getting reclaimed.',
        body: '<p>Tartan has been reinvented by nearly every fashion movement that touched it. Punk paired it with safety pins in the late 1970s specifically to needle its establishment associations. Grunge flannel in the early 1990s stripped it back down to comfort and anti-fashion.</p><p>Each revival reads the same cloth differently — proof the pattern carries whatever meaning the wearer puts on it.</p>',
      },
    ],
  },
  {
    handle: 'how-to',
    title: 'How To',
    articles: [
      {
        handle: 'how-to-tie-a-tartan-scarf',
        title: 'How to Tie a Tartan Scarf',
        palette: 'ochreGold',
        summary: 'The drape knot works with almost any scarf weight and needs no practice.',
        body: '<p>Drape the scarf around your neck so one side hangs noticeably longer than the other. Loop the longer end around the shorter one once, then let both ends fall loose.</p><p>That single loop — the drape knot — works with almost any scarf weight and needs no practice to get right, which is why it is the one worth learning first.</p>',
      },
      {
        handle: 'how-to-spot-real-wool',
        title: 'How to Spot Real Wool',
        palette: 'peatBrown',
        summary: 'The burn test and the crease test both work in under a minute.',
        body: '<p>Two quick checks: pull a few loose fibres and hold a lit match near them for a second — wool singes and smells faintly of burnt hair rather than melting into a bead, which is what most synthetics do.</p><p>Or just crease the fabric hard between two fingers and let go. Wool springs back within a few seconds; polyester and rayon tend to hold the crease.</p>',
      },
    ],
  },
];

async function findBlogs() {
  const data = await adminGraphql('query Blogs { blogs(first: 20) { nodes { id handle } } }');
  return new Map(data.blogs.nodes.map((b) => [b.handle, b.id]));
}

async function createBlog(blog) {
  const data = await adminGraphql(
    `
      mutation CreateBlog($blog: BlogCreateInput!) {
        blogCreate(blog: $blog) {
          blog { id handle }
          userErrors { field message }
        }
      }
    `,
    { blog: { handle: blog.handle, title: blog.title } }
  );
  if (data.blogCreate.userErrors.length) {
    throw new Error(`blogCreate userErrors for "${blog.handle}": ${JSON.stringify(data.blogCreate.userErrors)}`);
  }
  return data.blogCreate.blog.id;
}

async function existingArticleHandles(blogId) {
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
    { input: [{ filename, mimeType: 'image/png', httpMethod: 'POST', resource: 'FILE', fileSize: String(png.length) }] }
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

async function createArticle(blogId, article) {
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
        blogId,
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
  if (data.articleCreate.userErrors.length) {
    throw new Error(`articleCreate userErrors for "${article.handle}": ${JSON.stringify(data.articleCreate.userErrors)}`);
  }
  return data.articleCreate.article.handle;
}

async function main() {
  if (dryRun) {
    for (const blog of BLOGS) {
      console.log(`--dry-run: blog "${blog.handle}" (${blog.title}) with ${blog.articles.length} articles`);
      for (const a of blog.articles) console.log(`    ${a.handle}`);
    }
    console.log('Dry run complete.');
    return;
  }

  const existingBlogs = await findBlogs();
  let blogsCreated = 0;
  let articlesCreated = 0;
  let articlesSkipped = 0;

  for (const blog of BLOGS) {
    let blogId = existingBlogs.get(blog.handle);
    if (!blogId) {
      blogId = await createBlog(blog);
      console.log(`Created blog "${blog.handle}"`);
      blogsCreated++;
    } else {
      console.log(`Blog "${blog.handle}" already exists, skipping creation.`);
    }
    const existingArticles = await existingArticleHandles(blogId);
    for (const article of blog.articles) {
      if (existingArticles.has(article.handle)) {
        articlesSkipped++;
        continue;
      }
      const handle = await createArticle(blogId, article);
      console.log(`  Created article "${handle}" in "${blog.handle}"`);
      articlesCreated++;
    }
  }
  console.log(`Blogs: ${blogsCreated} created, ${BLOGS.length - blogsCreated} skipped.`);
  console.log(`Articles: ${articlesCreated} created, ${articlesSkipped} skipped.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
