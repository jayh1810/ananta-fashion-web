import type { Product } from "@/lib/api";
import { api } from "@/lib/api";

/** Overlay free flags from a seed list (e.g. SSR page-1) onto a longer cached list. */
export function mergeFreeProductFlags(
  list: Product[],
  seed: Product[],
): Product[] {
  if (!list.length || !seed.length) return list;
  const byId = new Map(seed.map((p) => [p.id, p]));
  let changed = false;
  const next = list.map((p) => {
    const s = byId.get(p.id);
    if (!s) return p;
    const isFree = !!s.isFreeProduct;
    if (!!p.isFreeProduct === isFree) return p;
    changed = true;
    return { ...p, isFreeProduct: isFree };
  });
  return changed ? next : list;
}

/**
 * Overlay live commerce fields (stock / soldOut / price / free) from a fresher
 * seed onto a session-cached collection list so Sold Out does not stick.
 */
export function mergeLiveCatalogFields(
  list: Product[],
  seed: Product[],
): Product[] {
  if (!list.length || !seed.length) return list;
  const byId = new Map(seed.map((p) => [p.id, p]));
  let changed = false;
  const next = list.map((p) => {
    const s = byId.get(p.id);
    if (!s) return p;
    const soldOut = !!s.soldOut;
    const stock = s.stock;
    const isFree = !!s.isFreeProduct;
    const price = s.price;
    const compareAt = s.compareAt;
    if (
      !!p.soldOut === soldOut &&
      p.stock === stock &&
      !!p.isFreeProduct === isFree &&
      p.price === price &&
      p.compareAt === compareAt
    ) {
      return p;
    }
    changed = true;
    return {
      ...p,
      soldOut,
      stock,
      isFreeProduct: isFree,
      price,
      compareAt,
    };
  });
  return changed ? next : list;
}

/** Apply admin free-gift IDs to every product in a grid/list. */
export function applyFreeProductIdSet(
  list: Product[],
  freeIds: Set<string>,
): Product[] {
  if (!list.length) return list;
  let changed = false;
  const next = list.map((p) => {
    const isFree = freeIds.has(p.id);
    if (!!p.isFreeProduct === isFree) return p;
    changed = true;
    return { ...p, isFreeProduct: isFree };
  });
  return changed ? next : list;
}

/**
 * Live free-product IDs from public settings (already on production).
 * Returns null if the request failed so callers do not wipe badges on errors.
 */
export async function fetchFreeProductIdSet(): Promise<Set<string> | null> {
  try {
    const res = await api<{
      freeProducts?: { productIds?: unknown };
    }>("/settings");
    const ids = res.freeProducts?.productIds;
    if (!Array.isArray(ids)) return new Set();
    return new Set(
      ids.map((id) => String(id || "").trim()).filter(Boolean),
    );
  } catch {
    return null;
  }
}
