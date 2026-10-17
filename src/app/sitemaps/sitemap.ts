import type { MetadataRoute } from "next";
import { absoluteUrl, SEO_API_URL, SITE_URL, SITEMAP_PRODUCT_PAGE_SIZE } from "@/lib/seo";

/**
 * Production sitemap for the storefront
 * ----------------------------------------
 * Priority order (as emitted after sort):
 *   1. Homepage
 *   2. Important static / policy / hub pages
 *   3. Collections & categories
 *   4. Products
 *   5. Blog posts
 *
 * Data source: Nest API `GET /seo/sitemap` (Prisma-backed).
 * Swap `fetchSitemapInventory()` if you move to Sanity / Shopify / etc.
 *
 * Only canonical path URLs — never query strings.
 */

const BASE_URL = SITE_URL;

type SlugRow = {
  slug: string;
  updatedAt?: string | Date | null;
};

type SitemapInventory = {
  products: SlugRow[];
  categories: SlugRow[];
  collections: SlugRow[];
  blogs: SlugRow[];
  /** CMS pages — policies vs marketing pages are routed below */
  pages: SlugRow[];
};

type SitemapEntry = MetadataRoute.Sitemap[number];

const POLICY_SLUGS = new Set([
  "privacy-policy",
  "terms-of-service",
  "refund-policy",
  "shipping-policy",
  "return-policy",
  "cancellation-policy",
]);

/** Known high-value static routes (always included even if CMS is empty). */
const STATIC_HUBS: {
  path: string;
  priority: number;
  changeFrequency: NonNullable<SitemapEntry["changeFrequency"]>;
}[] = [
  // 1) Homepage
  { path: "/", priority: 1.0, changeFrequency: "daily" },

  // 2) Important static / trust / content hubs
  { path: "/pages/contact", priority: 0.8, changeFrequency: "monthly" },
  { path: "/policies/privacy-policy", priority: 0.8, changeFrequency: "yearly" },
  { path: "/policies/terms-of-service", priority: 0.8, changeFrequency: "yearly" },
  { path: "/policies/shipping-policy", priority: 0.8, changeFrequency: "yearly" },
  { path: "/policies/refund-policy", priority: 0.8, changeFrequency: "yearly" },
  { path: "/pages/track-order", priority: 0.8, changeFrequency: "monthly" },
  { path: "/blogs", priority: 0.8, changeFrequency: "weekly" },
  { path: "/llms.txt", priority: 0.4, changeFrequency: "daily" },
  { path: "/llm.txt", priority: 0.35, changeFrequency: "daily" },
  { path: "/llms-full.txt", priority: 0.3, changeFrequency: "daily" },
  { path: "/llms-products.txt", priority: 0.3, changeFrequency: "daily" },

  // Catalog hubs (also covered via API collections; kept for resilience)
  { path: "/collections/all", priority: 0.9, changeFrequency: "daily" },
  { path: "/collections/bestsellers", priority: 0.9, changeFrequency: "daily" },
  { path: "/brands", priority: 0.8, changeFrequency: "weekly" },
];

function toDate(value?: string | Date | null): Date {
  if (!value) return new Date();
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function urlEntry(
  path: string,
  opts: {
    lastModified?: string | Date | null;
    changeFrequency: NonNullable<SitemapEntry["changeFrequency"]>;
    priority: number;
  },
): SitemapEntry {
  const clean = path.split("?")[0].split("#")[0] || "/";
  return {
    url: clean.startsWith("http") ? clean : absoluteUrl(clean),
    lastModified: toDate(opts.lastModified),
    changeFrequency: opts.changeFrequency,
    priority: opts.priority,
  };
}

function isPolicySlug(slug: string): boolean {
  if (POLICY_SLUGS.has(slug)) return true;
  return /policy|privacy|terms|refund|shipping|return|cancellation/i.test(slug);
}

/**
 * ---------------------------------------------------------------------------
 * DATA ADAPTERS — replace these if the CMS / commerce stack changes
 * ---------------------------------------------------------------------------
 *
 * Current: NestJS + Prisma → GET `${SEO_API_URL}/seo/sitemap`
 *
 * Prisma (direct, if sitemap runs in a Node route with DB access):
 *   const products = await prisma.product.findMany({
 *     where: { deletedAt: null, status: "ACTIVE" },
 *     select: { slug: true, updatedAt: true },
 *   });
 *
 * Sanity:
 *   const products = await sanityClient.fetch(
 *     `*[_type == "product" && defined(slug.current)]{ "slug": slug.current, "updatedAt": _updatedAt }`
 *   );
 *
 * Shopify Storefront API:
 *   // paginate products { handle, updatedAt } and collections { handle, updatedAt }
 *
 * Custom REST:
 *   fetch(`${BASE_URL}/api/internal/sitemap-inventory`)
 */
async function fetchSitemapMeta(): Promise<{
  productCount: number;
  pageSize: number;
  productPages: number;
}> {
  const fallback = {
    productCount: 0,
    pageSize: SITEMAP_PRODUCT_PAGE_SIZE,
    productPages: 1,
  };
  try {
    const res = await fetch(`${SEO_API_URL}/seo/sitemap?part=meta`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return fallback;
    const data = (await res.json()) as {
      productCount?: number;
      pageSize?: number;
      productPages?: number;
    };
    const pageSize = data.pageSize || SITEMAP_PRODUCT_PAGE_SIZE;
    const productCount = Number(data.productCount) || 0;
    return {
      productCount,
      pageSize,
      productPages:
        data.productPages ||
        Math.max(1, Math.ceil(productCount / pageSize) || 1),
    };
  } catch {
    return fallback;
  }
}

async function fetchSitemapInventory(): Promise<SitemapInventory> {
  const empty: SitemapInventory = {
    products: [],
    categories: [],
    collections: [],
    blogs: [],
    pages: [],
  };

  try {
    const res = await fetch(`${SEO_API_URL}/seo/sitemap?part=hubs`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return empty;
    const data = (await res.json()) as Partial<SitemapInventory> & {
      static?: string[];
    };
    return {
      products: data.products || [],
      categories: data.categories || [],
      collections: data.collections || [],
      blogs: data.blogs || [],
      pages: data.pages || [],
    };
  } catch {
    return empty;
  }
}

/** Brand pages with live products (GET /brands only returns those). */
async function fetchSitemapBrands(): Promise<SlugRow[]> {
  try {
    const res = await fetch(`${SEO_API_URL}/brands`, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const data = (await res.json()) as { slug?: string; productCount?: number }[];
    return Array.isArray(data)
      ? data
          .filter((b) => b.slug && (b.productCount ?? 0) > 0)
          .map((b) => ({ slug: b.slug! }))
      : [];
  } catch {
    return [];
  }
}

async function fetchSitemapProducts(
  page: number,
  limit: number,
): Promise<SlugRow[]> {
  try {
    const params = new URLSearchParams({
      part: "products",
      page: String(page),
      limit: String(limit),
    });
    const res = await fetch(`${SEO_API_URL}/seo/sitemap?${params}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      products?: SlugRow[];
      page?: number;
      categories?: unknown;
    };
    // Legacy GET /seo/sitemap ignored `part` and returned the full dump.
    if (data.categories && data.page === undefined) {
      return page > 0 ? [] : data.products || [];
    }
    return data.products || [];
  } catch {
    return [];
  }
}

function dedupeByUrl(entries: MetadataRoute.Sitemap): MetadataRoute.Sitemap {
  const seen = new Set<string>();
  const out: MetadataRoute.Sitemap = [];
  for (const e of entries) {
    if (!e.url || seen.has(e.url)) continue;
    seen.add(e.url);
    out.push(e);
  }
  return out;
}

/** Stable sort: higher priority first, then URL — easier to inspect in GSC. */
function sortEntries(entries: MetadataRoute.Sitemap): MetadataRoute.Sitemap {
  return [...entries].sort((a, b) => {
    const pa = a.priority ?? 0;
    const pb = b.priority ?? 0;
    if (pb !== pa) return pb - pa;
    return a.url.localeCompare(b.url);
  });
}

async function hubSitemap(): Promise<MetadataRoute.Sitemap> {
  const inventory = await fetchSitemapInventory();
  const urls: MetadataRoute.Sitemap = [];

  // —— 1 & 2: Homepage + important static pages ——
  for (const hub of STATIC_HUBS) {
    urls.push(
      urlEntry(hub.path, {
        changeFrequency: hub.changeFrequency,
        priority: hub.priority,
        lastModified: new Date(),
      }),
    );
  }

  // —— CMS pages (policies + marketing) ——
  for (const page of inventory.pages) {
    if (!page.slug?.trim()) continue;
    const slug = page.slug.trim();
    const path = isPolicySlug(slug) ? `/policies/${slug}` : `/pages/${slug}`;
    // Skip if already covered by STATIC_HUBS
    if (STATIC_HUBS.some((h) => h.path === path)) continue;
    urls.push(
      urlEntry(path, {
        lastModified: page.updatedAt,
        changeFrequency: isPolicySlug(slug) ? "yearly" : "monthly",
        priority: 0.8,
      }),
    );
  }

  // —— 3: Collections & categories (storefront uses /collections/[slug]) ——
  const collectionSlugs = new Map<string, SlugRow>();
  for (const row of [...inventory.collections, ...inventory.categories]) {
    if (!row.slug?.trim()) continue;
    const slug = row.slug.trim();
    const prev = collectionSlugs.get(slug);
    if (!prev) {
      collectionSlugs.set(slug, row);
      continue;
    }
    // Prefer newer lastModified when both category + collection share a slug
    if (toDate(row.updatedAt) > toDate(prev.updatedAt)) {
      collectionSlugs.set(slug, row);
    }
  }

  for (const [slug, row] of collectionSlugs) {
    const path = `/collections/${slug}`;
    if (STATIC_HUBS.some((h) => h.path === path)) continue;
    // Bestsellers / all already at 0.9; other collections 0.85
    const priority =
      slug === "bestsellers" || slug === "all" || slug === "new-arrivals"
        ? 0.9
        : 0.85;
    urls.push(
      urlEntry(path, {
        lastModified: row.updatedAt,
        changeFrequency: "weekly",
        priority,
      }),
    );
  }

  // —— 4: Brand pages ——
  for (const row of await fetchSitemapBrands()) {
    urls.push(
      urlEntry(`/brands/${row.slug}`, {
        changeFrequency: "weekly",
        priority: 0.8,
      }),
    );
  }

  // Products live in segmented sitemaps (id >= 1) so this file stays under Google's 50k limit.

  // —— 5: Blogs / guides ——
  for (const post of inventory.blogs) {
    if (!post.slug?.trim()) continue;
    urls.push(
      urlEntry(`/blogs/${post.slug.trim()}`, {
        lastModified: post.updatedAt,
        changeFrequency: "weekly",
        priority: 0.75,
      }),
    );
  }

  return sortEntries(dedupeByUrl(urls));
}

async function productSitemap(page: number): Promise<MetadataRoute.Sitemap> {
  const products = await fetchSitemapProducts(page, SITEMAP_PRODUCT_PAGE_SIZE);
  const urls: MetadataRoute.Sitemap = [];
  for (const product of products) {
    if (!product.slug?.trim()) continue;
    urls.push(
      urlEntry(`/products/${product.slug.trim()}`, {
        lastModified: product.updatedAt,
        changeFrequency: "daily",
        priority: 0.9,
      }),
    );
  }
  return sortEntries(dedupeByUrl(urls));
}

/** Sitemap index: 0 = hubs, 1+ = product pages of 10,000. */
export async function generateSitemaps() {
  const meta = await fetchSitemapMeta();
  const productPages = Math.max(1, meta.productPages || 1);
  return Array.from({ length: 1 + productPages }, (_, id) => ({ id }));
}

export default async function sitemap(props?: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const raw = props?.id ? await props.id : "0";
  const id = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(id) || id <= 0) return hubSitemap();
  return productSitemap(id - 1);
}

/** Exported for debugging / docs */
export const sitemapBase = SITE_URL || BASE_URL;
