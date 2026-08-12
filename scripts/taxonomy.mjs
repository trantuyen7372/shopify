// Three-level catalog taxonomy: the single source of truth shared by the
// seeding script and the navigation scripts.
//
// Level 1 = top-level menu entries, level 2 = department collections (already
// seeded by the first catalog pass), level 3 = product-type collections.
// Every collection is a smart collection whose rule is TAG = its own handle, so
// tagging a product with a handle files it into that collection.
//
// Leaf shape: { title, handle, type, price } — `type` becomes the Shopify
// product type, `price` the base price for its two generated products.

const shirt = (title, handle, price) => ({ title, handle, type: 'Shirts', price });
const tee = (title, handle, price) => ({ title, handle, type: 'T-Shirts', price });
const polo = (title, handle, price) => ({ title, handle, type: 'Polos', price });
const outer = (title, handle, price) => ({ title, handle, type: 'Outerwear', price });
const pants = (title, handle, price) => ({ title, handle, type: 'Pants', price });
const acc = (title, handle, price) => ({ title, handle, type: 'Accessories', price });
const hat = (title, handle, price) => ({ title, handle, type: 'Hats', price });
const sleep = (title, handle, price) => ({ title, handle, type: 'Sleepwear', price });
const dress = (title, handle, price) => ({ title, handle, type: 'Dresses', price });
const skirt = (title, handle, price) => ({ title, handle, type: 'Skirts', price });
const bag = (title, handle, price) => ({ title, handle, type: 'Bags', price });
const swim = (title, handle, price) => ({ title, handle, type: 'Swimwear', price });
const decor = (title, handle, price) => ({ title, handle, type: 'Home Decor', price });
const shoe = (title, handle, price) => ({ title, handle, type: 'Footwear', price });

// Leaves shared by the men's and women's menus — one collection, two parents.
export const SHARED = {
  tee: tee('T-Shirt', 'tartan-tees', '29.00'),
  cottonTee: tee('Cotton T-Shirt', 'cotton-t-shirt', '32.00'),
  longSleeveTee: tee('Long Sleeve T-Shirt', 'long-sleeve-t-shirt', '36.00'),
  sweatshirt: shirt('Sweatshirt', 'sweatshirt', '52.00'),
  zipperPolo: polo('Zipper Polo Shirt', 'zipper-polo-shirt', '49.00'),
  longSleevePolo: polo('Long Sleeve Polo Shirt', 'long-sleeve-polo-shirt', '52.00'),
  hawaiian: shirt('Cotton Hawaiian Shirt', 'hawaiian-shirt', '54.00'),
  hoodie: outer('Hoodie', 'hoodie', '69.00'),
  sherpaHoodie: outer('Sherpa Hoodie', 'sherpa-hoodie', '89.00'),
  knittedHoodie: outer('Knitted Hoodie', 'knitted-hoodie', '82.00'),
  bomber: outer('Bomber Jacket', 'bomber-jacket', '119.00'),
  baseball: outer('Baseball Jacket', 'baseball-jacket', '112.00'),
  padded: outer('Padded Jacket', 'padded-jacket', '129.00'),
  puffer: outer('Sleeveless Puffer Jacket', 'puffer-vest', '95.00'),
  parka: outer('Parka Jacket', 'parka-jacket', '149.00'),
  paddedCotton: outer('Padded Cotton Jacket', 'padded-cotton-jacket', '125.00'),
  lapel: outer('Unisex Lapel Jacket', 'lapel-jacket', '135.00'),
  jogger: pants('Jogger Pants', 'jogger-pants', '62.00'),
  pajamas: sleep('Pajamas', 'pajamas', '65.00'),
  scarf: acc('Ruffneck Scarf', 'ruffneck-scarf', '35.00'),
  beanie: hat('Beanies', 'beanies', '28.00'),
  bucket: hat('Bucket Hat', 'bucket-hat', '32.00'),
  bandana: acc('Bandanas', 'bandanas', '18.00'),
  watch: acc('Watches', 'tartan-watches', '99.00'),
  watchBand: acc('Watch Bands', 'watch-bands', '29.00'),
  denimCap: hat('Denim Classic Cap', 'denim-cap', '34.00'),
  flatCap: hat('Flat Cap', 'tartan-flat-caps', '42.00'),
};

export const TAXONOMY = [
  {
    title: 'Find Your Clans',
    url: '/collections/all',
    items: [
      { title: 'Clans A-L', handle: 'clans-a-l' },
      { title: 'Clans M-Y', handle: 'clans-m-y' },
      { title: 'Canada Province Tartan', handle: 'canada-province-tartan' },
      { title: 'Ireland County Tartan A-K', handle: 'ireland-county-tartan-a-k' },
      { title: 'Ireland County Tartan L-W', handle: 'ireland-county-tartan-l-w' },
    ],
  },
  {
    title: 'For Men',
    url: '/collections/all',
    items: [
      {
        title: 'Shirts & Tops',
        handle: 'men-shirts-tops',
        items: [
          SHARED.tee,
          SHARED.cottonTee,
          tee("2D Cotton Men's T-Shirt", '2d-mens-t-shirt', '34.00'),
          polo("Men's Polo Shirt", 'tartan-polos', '45.00'),
          SHARED.zipperPolo,
          SHARED.sweatshirt,
          shirt('Ugly Sweater', 'ugly-sweater', '58.00'),
          shirt('Ghillie Kilt Shirt', 'ghillie-kilt-shirt', '72.00'),
          SHARED.hawaiian,
          SHARED.longSleevePolo,
          SHARED.longSleeveTee,
          shirt('Long Sleeve Button Shirt', 'long-sleeve-button-shirt', '59.00'),
          shirt("Men's Tank Top", 'mens-tank-top', '26.00'),
        ],
      },
      {
        title: 'Outerwear & Jacket',
        handle: 'men-outerwear-jackets',
        items: [
          SHARED.hoodie,
          SHARED.sherpaHoodie,
          SHARED.knittedHoodie,
          SHARED.bomber,
          SHARED.baseball,
          SHARED.padded,
          SHARED.puffer,
          SHARED.parka,
          outer('Leather Bomber Jacket', 'leather-bomber-jacket', '189.00'),
          SHARED.paddedCotton,
          SHARED.lapel,
        ],
      },
      {
        title: 'Pants',
        handle: 'men-pants',
        items: [
          pants("Men's Shorts", 'mens-shorts', '42.00'),
          pants("Men's Board Shorts", 'mens-board-shorts', '46.00'),
          SHARED.jogger,
        ],
      },
      {
        title: "Clothing Accessories",
        handle: 'men-accessories',
        items: [
          hat('Classic Cap', 'classic-cap', '32.00'),
          SHARED.denimCap,
          SHARED.flatCap,
          SHARED.beanie,
          SHARED.bucket,
          acc('Classic Necktie', 'classic-necktie', '32.00'),
          acc('Bow Tie', 'bow-tie', '24.00'),
          SHARED.scarf,
          SHARED.watch,
          SHARED.watchBand,
          SHARED.bandana,
        ],
      },
      { title: 'Sleepwear', handle: 'men-sleepwear', items: [SHARED.pajamas] },
    ],
  },
  {
    title: 'For Women',
    url: '/collections/all',
    items: [
      {
        title: 'Shirts & Tops',
        handle: 'women-shirts-tops',
        items: [
          SHARED.tee,
          polo("Women's Polo Shirt", 'womens-polo-shirt', '45.00'),
          SHARED.cottonTee,
          tee("2D Women's T-Shirt", '2d-womens-t-shirt', '34.00'),
          SHARED.longSleeveTee,
          SHARED.zipperPolo,
          SHARED.longSleevePolo,
          shirt("Women's Casual Shirt", 'womens-casual-shirt', '55.00'),
          SHARED.hawaiian,
          shirt('Off Shoulder Sweater', 'off-shoulder-sweater', '62.00'),
          SHARED.sweatshirt,
          shirt('Loose Halter Neck Camisole', 'halter-neck-camisole', '38.00'),
          shirt('Racerback Tank', 'racerback-tank', '28.00'),
        ],
      },
      {
        title: 'Outerwear & Jacket',
        handle: 'women-outerwear-jackets',
        items: [
          SHARED.hoodie,
          SHARED.sherpaHoodie,
          outer('Borg Fleece Hoodie With Half Zip', 'borg-fleece-hoodie', '86.00'),
          outer('Cotton Hoodie', 'cotton-hoodie', '72.00'),
          SHARED.knittedHoodie,
          SHARED.bomber,
          SHARED.baseball,
          SHARED.padded,
          SHARED.puffer,
          SHARED.parka,
          SHARED.paddedCotton,
          SHARED.lapel,
        ],
      },
      {
        title: 'Bottoms',
        handle: 'women-bottoms',
        items: [
          pants('Leggings', 'leggings', '39.00'),
          pants("Women's Shorts", 'womens-shorts', '42.00'),
          skirt('Full Length Skirt', 'full-length-skirt', '75.00'),
          skirt('Pleated Mini Skirt', 'pleated-mini-skirt', '58.00'),
          skirt('Pleated Midi Skirt', 'pleated-midi-skirt', '69.00'),
          SHARED.jogger,
        ],
      },
      {
        title: 'Dresses',
        handle: 'women-dresses',
        items: [
          dress('Sleeveless Midi Dress', 'sleeveless-midi-dress', '89.00'),
          dress("Women's Casual Dress", 'womens-casual-dress', '79.00'),
          dress('Hoodie Dress', 'hoodie-dress', '85.00'),
          dress('Off Shoulder Long Dress', 'off-shoulder-long-dress', '95.00'),
          dress('Off Shoulder Lady Dress', 'off-shoulder-lady-dress', '92.00'),
        ],
      },
      {
        title: 'Handbags',
        handle: 'women-handbags',
        items: [
          bag('Canvas Bag', 'canvas-bag', '52.00'),
          bag('Leather Bag', 'leather-bag', '119.00'),
          bag('Leather Tote Bag', 'leather-tote-bag', '129.00'),
          bag('Saddle Bag', 'saddle-bag', '98.00'),
          bag('Shoulder Handbag', 'shoulder-handbag', '105.00'),
          bag('Luxury Leather Handbag', 'luxury-leather-handbag', '169.00'),
          bag('Round Satchel Bag', 'round-satchel-bag', '92.00'),
        ],
      },
      {
        title: 'Clothing Accessories',
        handle: 'women-accessories',
        items: [
          SHARED.denimCap,
          SHARED.scarf,
          SHARED.beanie,
          SHARED.bucket,
          hat('Winter Trapper Hat', 'winter-trapper-hat', '48.00'),
          SHARED.bandana,
          SHARED.watch,
          SHARED.watchBand,
          acc('Hair Scrunchie', 'hair-scrunchie', '14.00'),
          acc("Women's Leather Wallet", 'womens-leather-wallet', '58.00'),
        ],
      },
      { title: 'Sleepwear', handle: 'women-sleepwear', items: [SHARED.pajamas] },
      {
        title: 'Swimwear',
        handle: 'women-swimwear',
        items: [
          swim('Bikinis', 'bikinis', '54.00'),
          swim('Sarong', 'sarong', '38.00'),
        ],
      },
    ],
  },
  { title: 'New Arrivals', handle: 'new-arrivals' },
  {
    title: 'Home Decor',
    handle: 'home-decor',
    items: [
      decor('House Flag', 'house-flag', '38.00'),
      decor('Garden Flag', 'garden-flag', '28.00'),
      decor('Gonfalon', 'gonfalon', '46.00'),
      decor('Canvas Wall Art', 'canvas-wall-art', '75.00'),
      decor('Premium Quilt', 'premium-quilt', '135.00'),
      decor('Blanket', 'blanket', '85.00'),
      decor('Bedding Set', 'bedding-set', '159.00'),
      decor('Quilt Bed Set', 'quilt-bed-set', '175.00'),
      decor('Pillow Cover', 'pillow-cover', '32.00'),
      decor('Tablecloth', 'tablecloth', '48.00'),
      decor('Area Rug', 'area-rug', '129.00'),
      decor('Round Rug', 'round-rug', '99.00'),
      decor('Window Curtain', 'window-curtain', '58.00'),
      decor('Door Mat', 'door-mat', '36.00'),
      decor('Tapestry', 'tapestry', '62.00'),
      decor('Laundry Basket', 'laundry-basket', '44.00'),
    ],
  },
  {
    title: 'Footwears',
    handle: 'footwear',
    items: [
      shoe('Casual Sneakers', 'casual-sneakers', '89.00'),
      shoe('High Top Shoes', 'high-top-shoes', '95.00'),
      shoe('Leather Boots', 'leather-boots', '155.00'),
      shoe('Alpine Boots', 'alpine-boots', '165.00'),
      shoe('Slippers', 'tartan-slippers', '44.00'),
      shoe('Socks', 'socks', '16.00'),
    ],
  },
  { title: 'Blog', url: '/blogs/news' },
  { title: 'Tartan Club', url: '/pages/tartan-club' },
  { title: 'About Us', url: '/pages/about-us' },
  { title: 'Contact Us', url: '/pages/contact-us' },
];

// Walks the taxonomy and returns every collection node with its parent chain of
// collection handles (used both for menu building and for product tagging).
export function collectionNodes() {
  const out = new Map();
  const walk = (nodes, parents) => {
    for (const node of nodes) {
      const chain = node.handle ? [...parents, node.handle] : parents;
      if (node.handle) {
        const existing = out.get(node.handle);
        if (existing) {
          // A shared leaf (e.g. Hoodie) hangs under both departments — keep every
          // parent so its products stay filed under all of them.
          for (const parent of parents) {
            if (!existing.parents.includes(parent)) existing.parents.push(parent);
          }
        } else {
          out.set(node.handle, { ...node, parents: [...parents], items: undefined });
        }
      }
      if (node.items) walk(node.items, chain);
    }
  };
  walk(TAXONOMY, []);
  return [...out.values()];
}

// Leaves are the level-3 product-type collections that need generated products.
export function leafNodes() {
  return collectionNodes().filter((node) => node.type);
}
