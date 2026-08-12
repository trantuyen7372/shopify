// Shared menu-item builder for the setup-*navigation scripts.
//
// Menu items declared as plain paths ('/collections/men-pants') are resolved to
// resource-linked Shopify menu items (type COLLECTION / PAGE / BLOG + resourceId)
// rather than absolute HTTP links. Resource-linked items render as relative
// storefront URLs, so they keep the visitor on whatever host is serving the
// theme — including `shopify theme dev` previews, where an absolute link to the
// .myshopify.com domain would jump out of the preview. Unrecognised paths fall
// back to an absolute HTTP link.

const RESOURCE_TYPES = [
  { prefix: '/collections/', type: 'COLLECTION', field: 'collections' },
  { prefix: '/pages/', type: 'PAGE', field: 'pages' },
  { prefix: '/blogs/', type: 'BLOG', field: 'blogs' },
];

export function createMenuItemBuilder(adminGraphql, baseUrl) {
  const cache = new Map();

  async function resolveId(field, handle) {
    const key = `${field}:${handle}`;
    if (cache.has(key)) return cache.get(key);
    const data = await adminGraphql(
      `query FindResource($q: String!) { ${field}(first: 1, query: $q) { nodes { id } } }`,
      { q: `handle:${handle}` }
    );
    const id = data[field].nodes[0]?.id ?? null;
    cache.set(key, id);
    return id;
  }

  return async function toMenuItemInput(node) {
    const input = { title: node.title };
    // Taxonomy nodes carry a bare collection handle; menu-only nodes carry a path.
    const url = node.url ?? `/collections/${node.handle}`;
    // '/collections/all' is the built-in all-products page, not a real collection.
    if (url === '/collections/all') {
      input.type = 'CATALOG';
    } else {
      const match = RESOURCE_TYPES.find((r) => url.startsWith(r.prefix));
      const handle = match ? url.slice(match.prefix.length) : null;
      const resourceId = match && handle ? await resolveId(match.field, handle) : null;
      if (resourceId) {
        input.type = match.type;
        input.resourceId = resourceId;
      } else {
        if (match) {
          console.warn(`No ${match.type} found for "${url}" — falling back to an absolute link.`);
        }
        input.type = 'HTTP';
        input.url = `${baseUrl}${url}`;
      }
    }
    if (node.items) {
      input.items = [];
      for (const child of node.items) input.items.push(await toMenuItemInput(child));
    }
    return input;
  };
}
