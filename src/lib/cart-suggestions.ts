import type { Product } from "@/lib/api";
import { api } from "@/lib/api";

/** Shared cart / checkout “You may also like” ranking. Free admin gifts first. */
export function pickCartSuggestions(
  products: Product[],
  cartIds: Set<string>,
  shortfall: number,
  limit = 4,
): Product[] {
  const available = products.filter(
    (p) =>
      !p.soldOut &&
      (p.stock == null || p.stock > 0) &&
      !cartIds.has(p.id) &&
      (p.isFreeProduct || p.price > 0),
  );

  const freeFirst = (list: Product[]) =>
    [...list].sort((a, b) => {
      const af = a.isFreeProduct ? 0 : 1;
      const bf = b.isFreeProduct ? 0 : 1;
      return af - bf;
    });

  if (shortfall <= 0) {
    return freeFirst(available).slice(0, limit);
  }

  return freeFirst(
    [...available].sort((a, b) => {
      // Keep free gifts ahead even when unlocking COD/wallet.
      if (!!a.isFreeProduct !== !!b.isFreeProduct) {
        return a.isFreeProduct ? -1 : 1;
      }
      const unit = (p: Product) => (p.isFreeProduct ? 0 : p.price);
      const score = (p: Product) => {
        const price = unit(p);
        return price >= shortfall
          ? price - shortfall
          : 1_000_000 + (shortfall - price);
      };
      return score(a) - score(b);
    }),
  ).slice(0, limit);
}

/** Cart line price when adding from upsell — free base is ₹0. */
export function cartAddProductFromSuggestion(p: Product): Product {
  if (!p.isFreeProduct) return p;
  return {
    ...p,
    price: 0,
    compareAt: Math.max(p.compareAt || 0, p.price || 0),
    isFreeProduct: true,
  };
}

const POOL_TTL_MS = 60_000;
let poolCache: { at: number; products: Product[] } | null = null;
let poolInflight: Promise<Product[]> | null = null;

function dedupeProducts(list: Product[]) {
  const seen = new Set<string>();
  return list.filter((p) => {
    if (!p?.id || seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}

/** Home/bestsellers rarely include free gifts — load them explicitly for cart upsells. */
export async function loadCartSuggestionPool(): Promise<Product[]> {
  const now = Date.now();
  if (poolCache && now - poolCache.at < POOL_TTL_MS) {
    return poolCache.products;
  }
  if (poolInflight) return poolInflight;

  poolInflight = (async () => {
    const [home, free] = await Promise.all([
      api<{ bestsellers?: Product[]; promoted?: Product[] }>("/home").catch(
        () => ({ bestsellers: [] as Product[], promoted: [] as Product[] }),
      ),
      api<{ data?: Product[] }>("/products/free-gifts").catch(() => ({
        data: [] as Product[],
      })),
    ]);

    let next: Product[] = dedupeProducts([
      ...(free.data || []),
      ...(home.promoted || []),
      ...(home.bestsellers || []),
    ]);

    const paidCount = next.filter((p) => !p.isFreeProduct).length;
    if (paidCount < 6) {
      try {
        const more = await api<{ data: Product[] }>("/products?limit=12");
        next = dedupeProducts([...next, ...(more.data || [])]);
      } catch {
        /* ignore */
      }
    }

    poolCache = { at: Date.now(), products: next };
    return next;
  })().finally(() => {
    poolInflight = null;
  });

  return poolInflight;
}
