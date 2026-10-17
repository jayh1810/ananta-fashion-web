import { api, type Product } from "@/lib/api";
import type { CartItem } from "@/lib/cart";

export type ServerCartLine = {
  lineKey?: string | null;
  variantId?: string | null;
  productId?: string | null;
  quantity: number;
  title: string;
  slug?: string | null;
  image?: string | null;
  price: number;
  compareAt?: number | null;
  siddhAddon?: boolean;
  siddhAddonName?: string | null;
  isFreeProduct?: boolean;
};

/** Saved account cart lines (GET /cart) that can become browser cart lines. */
export async function fetchServerCart(token: string): Promise<ServerCartLine[]> {
  const res = await api<{ items?: ServerCartLine[] }>("/cart", { token });
  return (res.items || []).filter(
    (l) => !!l.productId && !!l.slug && l.quantity > 0 && !!l.lineKey,
  );
}

/** Prices and stock are placeholders — run refreshCartFromCatalog() afterwards. */
export function serverLineToCartItem(line: ServerCartLine): CartItem {
  const upsellPart = (line.lineKey || "").split("::")[2] || "";
  const addonParentId = upsellPart.startsWith("upsell:")
    ? upsellPart.slice("upsell:".length) || null
    : null;
  const product: Product = {
    id: line.productId || "",
    slug: line.slug || "",
    title: line.title,
    image: line.image || "",
    price: line.price,
    compareAt: line.compareAt ?? line.price,
    reviews: 0,
    rating: 0,
    description: "",
    variantId: line.variantId || undefined,
    isFreeProduct: !!line.isFreeProduct,
    siddhAddonSelected: !!line.siddhAddon,
    siddhAddonName: line.siddhAddonName || null,
    ...(addonParentId ? { isAddonUpsell: true, addonParentId } : {}),
  };
  return { product, quantity: line.quantity };
}

export async function loadServerCart(token: string): Promise<CartItem[]> {
  return (await fetchServerCart(token)).map(serverLineToCartItem);
}
