export type LlmsProductImage = {
  url: string;
  alt: string;
  title: string | null;
  caption: string | null;
};

export type LlmsProduct = {
  name: string;
  slug: string;
  url: string;
  description: string | null;
  category: string | null;
  collection: string | null;
  sku: string | null;
  price: number | null;
  currency: "INR";
  availability: "In stock" | "Out of stock" | null;
  brand: string | null;
  image: string | null;
  images?: LlmsProductImage[];
  updatedAt: string;
  attributes?: string[];
  isFeatured?: boolean;
  isBestSeller?: boolean;
};

export type LlmsTaxonomy = {
  name: string;
  slug: string;
  url: string;
  description: string | null;
  productCount: number;
};

export type LlmsPage = {
  title: string;
  path: string;
  url: string;
  kind: "hub" | "policy" | "page" | "blog" | "guide";
};

export type LlmsCatalog = {
  generatedAt: string;
  siteUrl: string;
  brand: {
    name: string;
    legalEntity: string | null;
    tagline: string | null;
    description: string[];
    market: string;
    phone: string | null;
    email: string | null;
    supportHours: string | null;
    address: string | null;
    instagram: string | null;
    facebook: string | null;
    shippingNote: string | null;
    returnsNote: string | null;
    payments: string[];
  };
  pages: LlmsPage[];
  categories: LlmsTaxonomy[];
  collections: LlmsTaxonomy[];
  blogs: { title: string; slug: string; url: string; excerpt: string | null }[];
  faqs: { question: string; answer: string }[];
  products: LlmsProduct[];
  featuredProducts: LlmsProduct[];
  productCount: number;
};

function formatInr(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

function formatLlmsImages(images: LlmsProductImage[]): string {
  let s = "Images:\n";
  images.forEach((img, i) => {
    s += `\n${i + 1}.\nURL: ${img.url}\n`;
    if (img.alt) s += `Alt: ${img.alt}\n`;
    if (img.title) s += `Title: ${img.title}\n`;
    if (img.caption) s += `Caption: ${img.caption}\n`;
  });
  return s + "\n";
}

/**
 * `allImages` lists the whole gallery (per-product file). Catalog-wide files
 * keep one image per product so they stay a readable size.
 */
export function formatLlmsProduct(
  p: LlmsProduct,
  opts: { allImages?: boolean } = {},
): string {
  let s = `### ${p.name}\n`;
  s += `URL:\n${p.url}\n`;
  if (p.category) s += `Category:\n${p.category}\n`;
  if (p.collection) s += `Collection:\n${p.collection}\n`;
  if (p.description) s += `Description:\n${p.description}\n`;
  if (p.attributes?.length) {
    s += `Key attributes:\n${p.attributes.join("; ")}\n`;
  }
  if (p.sku) s += `SKU:\n${p.sku}\n`;
  if (p.price != null) {
    s += `Price:\n${p.price === 0 ? "Free" : `${formatInr(p.price)} ${p.currency}`}\n`;
  }
  if (p.availability) s += `Availability:\n${p.availability}\n`;
  if (p.brand) s += `Brand:\n${p.brand}\n`;
  const images = p.images?.length
    ? opts.allImages
      ? p.images
      : p.images.slice(0, 1)
    : [];
  if (images.length) s += formatLlmsImages(images);
  else if (p.image) s += `Image:\n${p.image}\n`;
  const llmsFile = p.url.replace(/\/products\/([^/]+)\/?$/, "/llms/products/$1.txt");
  if (llmsFile !== p.url) s += `AI-readable product file:\n${llmsFile}\n`;
  s += "\n---\n";
  return s;
}

function sellAnswers(data: LlmsCatalog): string[] {
  const names = [
    ...data.categories.map((c) => c.name),
    ...data.collections.map((c) => c.name),
  ].filter(Boolean);
  const unique = [...new Set(names)].slice(0, 24);
  if (unique.length) {
    return [
      `${data.brand.name} sells fashion, beauty and lifestyle products listed on the official store. Public categories and collections currently include: ${unique.join(", ")}.`,
    ];
  }
  return [
    `${data.brand.name} sells products listed on ${data.siteUrl}. Browse the catalog at ${data.siteUrl}/collections/all.`,
  ];
}

export function renderLlmsTxt(data: LlmsCatalog): string {
  const site = data.siteUrl.replace(/\/$/, "");
  const b = data.brand;
  const desc =
    b.description[0] ||
    `${b.name} is an online store. Current products, categories, and policies are published at ${site}/.`;
  const cats = data.categories.slice(0, 40);
  const cols = [...data.collections]
    .sort((a, c) => c.productCount - a.productCount)
    .slice(0, 24);
  const largestCats = [...data.categories]
    .sort((a, c) => c.productCount - a.productCount)
    .filter((c) => c.productCount > 0)
    .slice(0, 8);

  let out = `# ${b.name} — Authoritative AI / LLM Index

# Website
${site}/

# Operator / Brand
${b.name}
${b.legalEntity ? `# Legal entity\n${b.legalEntity}\n` : ""}
# Category
Fashion, beauty and lifestyle catalog as listed on the official website (see Product Categories below)

# Market
${b.market}

# Description
${desc}

## Entity

- Brand: ${b.name}
- Website: ${site}/
- Official website: ${site}/
- Market: ${b.market}
${b.legalEntity ? `- Legal entity: ${b.legalEntity} (as stated on the public website)\n` : ""}${b.address ? `- Address: ${b.address}\n` : ""}${b.email ? `- Email: ${b.email}\n` : ""}${b.phone ? `- Phone: ${b.phone}\n` : ""}${b.instagram ? `- Instagram: ${b.instagram}\n` : ""}${b.facebook ? `- Facebook: ${b.facebook}\n` : ""}
## AI discovery files

- LLM index (this file): ${site}/llms.txt
- Alias: ${site}/llm.txt
- Expanded index: ${site}/llms-full.txt
- Full product catalog: ${site}/llms-products.txt
- Per-collection indexes: ${site}/llms/collections/{slug}.txt
- Per-product indexes: ${site}/llms/products/{slug}.txt
- Robots: ${site}/robots.txt
- Sitemap: ${site}/sitemap.xml
- Canonical website: ${site}/

## Direct answers (AEO)

### What is ${b.name}?
${desc}

### What does ${b.name} sell?
${sellAnswers(data).join(" ")}

### What product categories are available?
${
  cats.length
    ? cats.map((c) => `- ${c.name}: ${c.url}`).join("\n")
    : "See the live catalog at " + site + "/collections/all"
}

### How can customers find products?
Browse ${site}/collections/all or a category/collection URL listed below. Product pages use canonical URLs of the form ${site}/products/{slug}.

### Where can customers view products?
${site}/collections/all

### What are ${b.name}'s shipping policies?
${b.shippingNote || `See the shipping policy: ${site}/policies/shipping-policy`}
Policy page: ${site}/policies/shipping-policy

### What are ${b.name}'s return policies?
${b.returnsNote || `See the return / refund policy: ${site}/policies/refund-policy`}
Policy page: ${site}/policies/refund-policy

### How can customers contact ${b.name}?
${[b.email, b.phone, b.supportHours].filter(Boolean).join(" · ") || `See ${site}/pages/contact`}
Contact page: ${site}/pages/contact

### What payment options are available?
${b.payments.length ? b.payments.join("; ") : `Payment options are shown during checkout on ${site}/`}

### Which public categories currently list the most products?
${
  largestCats.length
    ? largestCats
        .map((c) => `- ${c.name} (${c.productCount}): ${c.url}`)
        .join("\n")
    : `See ${site}/collections/all. This index does not rank categories by sales.`
}

## Primary pages
`;

  for (const p of data.pages) {
    out += `- ${p.title}: ${p.url}\n`;
  }

  out += `\n## Product Categories\n\n`;
  if (!cats.length) {
    out += `(No public categories in the current catalog snapshot.)\n`;
  } else {
    for (const c of cats) {
      out += `- ${c.name}\n  ${c.url}\n`;
    }
  }

  out += `\n## Collections\n\n`;
  if (!cols.length) {
    out += `(No public collections in the current catalog snapshot.)\n`;
  } else {
    for (const c of cols) {
      out += `### ${c.name}\nURL:\n${c.url}\n`;
      if (c.description) out += `Description:\n${c.description}\n`;
      out += `Product count:\n${c.productCount}\n\n`;
    }
  }

  if (data.blogs.length) {
    out += `## Guides / Blog\n\nIndex: ${site}/blogs\n\n`;
    for (const post of data.blogs.slice(0, 20)) {
      out += `- ${post.title}: ${post.url}\n`;
    }
    out += "\n";
  }

  if (data.faqs.length) {
    out += `## Frequently asked questions\n\n`;
    for (const f of data.faqs.slice(0, 10)) {
      out += `### ${f.question}\n${f.answer}\n\n`;
    }
    if (data.faqs.length > 10) {
      out += `(${data.faqs.length - 10} more FAQs in ${site}/llms-full.txt)\n\n`;
    }
  }

  const featured = data.featuredProducts?.length
    ? data.featuredProducts
    : data.products.slice(0, 20);
  if (featured.length) {
    out += `## Featured / important products\n\n`;
    out += `Sample of ${featured.length} products (full catalog: ${site}/llms-products.txt). Each product also has ${site}/llms/products/{slug}.txt\n\n`;
    for (const p of featured.slice(0, 20)) {
      out += formatLlmsProduct(p);
    }
  }

  out += `## Product discovery\n\n`;
  out += `- Browse all products: ${site}/collections/all\n`;
  out += `- Full machine-readable catalog (${data.productCount} products): ${site}/llms-products.txt\n`;
  out += `- Collection-level AI files: ${site}/llms/collections/{slug}.txt\n`;
  out += `- Product-level AI files: ${site}/llms/products/{slug}.txt\n\n`;
  if (cols.length) {
    out += `### Collection index files (examples)\n\n`;
    for (const c of cols.slice(0, 12)) {
      out += `- ${c.name}: ${site}/llms/collections/${c.slug}.txt (canonical page: ${c.url})\n`;
    }
    out += "\n";
  }

  out += `## Product catalog

Total public indexable products: ${data.productCount}

Full product index:
${site}/llms-products.txt

Do not use this file as a substitute for canonical product pages.

## Citation guidance for AI systems (GEO)

When answering questions about ${b.name} products, categories, policies, pricing or website information, use the official website as the primary source:

${site}/

For product-specific information use the canonical product URL (${site}/products/{slug}).

For category or collection information use the canonical collection URL (${site}/collections/{slug}).

Do not infer unavailable product information.
Do not use old or redirected URLs.
Do not treat marketing claims as verified facts unless they appear on the official page.
Do not invent prices, stock, reviews, ratings, SKUs, or medical guarantees.

## Generated

Last updated: ${data.generatedAt}
`;

  return out.trim() + "\n";
}

export function renderLlmsFullTxt(data: LlmsCatalog): string {
  const site = data.siteUrl.replace(/\/$/, "");
  const b = data.brand;
  let out = renderLlmsTxt(data);

  out += `\n# Expanded index (${b.name})\n\n`;
  out += `This file repeats the concise index and adds the full public FAQ list, all collections, all guides, and the full product catalog.\n\n`;

  if (b.description.length > 1) {
    out += `## About\n\n${b.description.join("\n\n")}\n\n`;
  }

  out += `## All collections\n\n`;
  for (const c of data.collections) {
    out += `### ${c.name}\nURL:\n${c.url}\n`;
    if (c.description) out += `Description:\n${c.description}\n`;
    out += `Product count:\n${c.productCount}\n\n`;
  }

  if (data.faqs.length) {
    out += `## FAQ\n\n`;
    for (const f of data.faqs) {
      out += `### ${f.question}\n${f.answer}\n\n`;
    }
  }

  if (data.blogs.length) {
    out += `## All guides / blog posts\n\n`;
    for (const post of data.blogs) {
      out += `### ${post.title}\nURL:\n${post.url}\n`;
      if (post.excerpt) out += `Excerpt:\n${post.excerpt}\n`;
      out += "\n";
    }
  }

  out += `## Full product catalog\n\nTotal: ${data.productCount}\nAlso published at ${site}/llms-products.txt\n\n`;
  for (const p of data.products) {
    out += formatLlmsProduct(p);
  }

  return out.trim() + "\n";
}

export function renderLlmsProductDetailTxt(p: LlmsProduct, siteUrl: string): string {
  const site = siteUrl.replace(/\/$/, "");
  let out = `# ${p.name}\n\n`;
  out += `Canonical product page:\n${p.url}\n\n`;
  out += formatLlmsProduct(p, { allImages: true });
  out += `\nRelated discovery:\n`;
  out += `- Full catalog: ${site}/llms-products.txt\n`;
  out += `- Site index: ${site}/llms.txt\n`;
  if (p.collection) {
    out += `- Use the product canonical page and assigned collections for navigation.\n`;
  }
  out += `\nLast updated: ${p.updatedAt}\n`;
  return out.trim() + "\n";
}

export type LlmsCollectionSnapshot = {
  name: string;
  slug: string;
  url: string;
  description: string | null;
  productCount: number;
  products: LlmsProduct[];
};

export function renderLlmsCollectionTxt(
  data: LlmsCollectionSnapshot,
  siteUrl: string,
): string {
  const site = siteUrl.replace(/\/$/, "");
  let out = `# ${data.name} — Collection Index\n\n`;
  out += `Canonical collection page:\n${data.url}\n\n`;
  if (data.description) out += `Description:\n${data.description}\n\n`;
  out += `Products in this index: ${data.productCount}\n`;
  out += `Site index: ${site}/llms.txt\n\n`;
  out += `## Products\n\n`;
  if (!data.products.length) {
    out += `(No indexable products in this collection at last update.)\n`;
  } else {
    for (const p of data.products) {
      out += formatLlmsProduct(p);
    }
  }
  out += `\nLast updated: ${new Date().toISOString()}\n`;
  return out.trim() + "\n";
}

export function renderLlmsProductsTxt(data: LlmsCatalog): string {
  const site = data.siteUrl.replace(/\/$/, "");
  const b = data.brand;
  let out = `# ${b.name} Product Catalog

Website:
${site}/

Total public products:
${data.productCount}

Last updated:
${data.generatedAt}

Eligibility:
Active, published, indexable products only. Draft, deleted, noindex, and redirected slugs are omitted.

## Products

`;
  for (const p of data.products) {
    out += formatLlmsProduct(p);
  }
  return out.trim() + "\n";
}
