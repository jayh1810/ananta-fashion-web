import type { Product } from "@/lib/api";

export type CollectionScrollCache = {
  productBasePath: string;
  products: Product[];
  page: number;
  total: number;
  pages: number;
  scrollY: number;
  /** Product clicked before leaving — preferred restore target. */
  anchorSlug?: string | null;
  savedAt: number;
};

/** Lightweight fallback when the full list does not fit in sessionStorage. */
export type CollectionScrollMeta = {
  productBasePath: string;
  page: number;
  total: number;
  pages: number;
  scrollY: number;
  anchorSlug?: string | null;
  savedAt: number;
};

const memory = new Map<string, CollectionScrollCache>();
const STORAGE_PREFIX = "aa:col-scroll:";
const META_PREFIX = "aa:col-meta:";
const TTL_MS = 45 * 60 * 1000;

function compactProduct(p: Product): Product {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    image: p.image,
    images: p.images?.slice?.(0, 1),
    price: p.price,
    compareAt: p.compareAt,
    reviews: p.reviews,
    rating: p.rating,
    badge: p.badge,
    soldOut: p.soldOut,
    description: "",
    shortDescription: p.shortDescription,
    variantId: p.variantId,
    stock: p.stock,
    isBestSeller: p.isBestSeller,
    highlightTags: p.highlightTags,
    isFreeProduct: p.isFreeProduct,
    showCashbackRibbon: p.showCashbackRibbon,
    cashbackRibbon: p.cashbackRibbon,
    extraOfferLabel: p.extraOfferLabel,
  } as Product;
}

function isFresh(savedAt: number) {
  return Date.now() - savedAt <= TTL_MS;
}

export function saveCollectionScrollCache(
  cacheKey: string,
  entry: Omit<CollectionScrollCache, "savedAt">,
) {
  const full: CollectionScrollCache = {
    ...entry,
    products: entry.products.map(compactProduct),
    anchorSlug: entry.anchorSlug ?? null,
    savedAt: Date.now(),
  };
  memory.set(cacheKey, full);
  if (typeof window === "undefined") return;

  const meta: CollectionScrollMeta = {
    productBasePath: full.productBasePath,
    page: full.page,
    total: full.total,
    pages: full.pages,
    scrollY: full.scrollY,
    anchorSlug: full.anchorSlug,
    savedAt: full.savedAt,
  };
  try {
    sessionStorage.setItem(META_PREFIX + cacheKey, JSON.stringify(meta));
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.setItem(STORAGE_PREFIX + cacheKey, JSON.stringify(full));
  } catch {
    // Quota — memory + meta still allow soft-nav B and hard-nav A.
  }
}

export function readCollectionScrollCache(
  cacheKey: string,
  productBasePath: string,
): CollectionScrollCache | null {
  const match = (entry: CollectionScrollCache | null) => {
    if (!entry) return null;
    if (entry.productBasePath !== productBasePath) return null;
    if (!isFresh(entry.savedAt)) return null;
    if (!Array.isArray(entry.products) || entry.products.length === 0)
      return null;
    return entry;
  };

  const fromMem = match(memory.get(cacheKey) || null);
  if (fromMem) return fromMem;

  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CollectionScrollCache;
    const ok = match(parsed);
    if (ok) {
      memory.set(cacheKey, ok);
      return ok;
    }
    sessionStorage.removeItem(STORAGE_PREFIX + cacheKey);
  } catch {
    /* ignore */
  }
  return null;
}

export function readCollectionScrollMeta(
  cacheKey: string,
  productBasePath: string,
): CollectionScrollMeta | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(META_PREFIX + cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CollectionScrollMeta;
    if (parsed.productBasePath !== productBasePath) return null;
    if (!isFresh(parsed.savedAt)) return null;
    if (!parsed.page || parsed.page < 2) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Update only scroll / anchor without rewriting the product list. */
export function patchCollectionScrollPosition(
  cacheKey: string,
  patch: { scrollY: number; anchorSlug?: string | null },
) {
  const existing = memory.get(cacheKey);
  if (existing) {
    existing.scrollY = patch.scrollY;
    if (patch.anchorSlug !== undefined) {
      existing.anchorSlug = patch.anchorSlug;
    }
    existing.savedAt = Date.now();
    memory.set(cacheKey, existing);
  }
  if (typeof window === "undefined") return;
  try {
    const raw = sessionStorage.getItem(META_PREFIX + cacheKey);
    if (raw) {
      const meta = JSON.parse(raw) as CollectionScrollMeta;
      meta.scrollY = patch.scrollY;
      if (patch.anchorSlug !== undefined) meta.anchorSlug = patch.anchorSlug;
      meta.savedAt = Date.now();
      sessionStorage.setItem(META_PREFIX + cacheKey, JSON.stringify(meta));
    }
  } catch {
    /* ignore */
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + cacheKey);
    if (raw) {
      const full = JSON.parse(raw) as CollectionScrollCache;
      full.scrollY = patch.scrollY;
      if (patch.anchorSlug !== undefined) full.anchorSlug = patch.anchorSlug;
      full.savedAt = Date.now();
      sessionStorage.setItem(STORAGE_PREFIX + cacheKey, JSON.stringify(full));
      memory.set(cacheKey, full);
    }
  } catch {
    /* ignore */
  }
}
