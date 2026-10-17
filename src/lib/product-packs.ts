import type { Product } from "@/lib/api";

export type ProductPack = NonNullable<Product["variantOptions"]>[number];

/** Real pack rows only — excludes Shopify “Default Title” single-SKU placeholders. */
export function getProductPacks(product: Product): ProductPack[] {
  return (product.variantOptions || []).filter((p) => {
    if (!p?.label || typeof p.price !== "number" || p.price <= 0) return false;
    if (/^default(\s+title)?$/i.test(p.label.trim())) return false;
    return true;
  });
}

/**
 * Pack of 2 / Pack of 3 → units for Siddh plate pricing.
 * Falls back to 1 when the label is not a pack.
 */
export function packQuantityFromLabel(label?: string | null): number {
  const s = String(label || "").trim();
  if (!s) return 1;
  const packOf = s.match(/pack\s*of\s*(\d+)/i);
  if (packOf) {
    return Math.max(1, Math.min(99, parseInt(packOf[1], 10) || 1));
  }
  const pcs = s.match(/\b(\d+)\s*(?:pc|pcs|piece|pieces|unit|units)\b/i);
  if (pcs) {
    return Math.max(1, Math.min(99, parseInt(pcs[1], 10) || 1));
  }
  return 1;
}

/** Cart / checkout: add-on fee baked into a parent line (Pack of N → N × unit). */
export function getCartAddonBreakdown(product: {
  title?: string | null;
  price?: number;
  siddhAddonSelected?: boolean | null;
  siddhAddonPrice?: number | null;
  siddhAddonUnits?: number | null;
  siddhAddonName?: string | null;
  siddhAddonHeading?: string | null;
  siddhAddonEnabled?: boolean | null;
}) {
  const unit =
    typeof product.siddhAddonPrice === "number" && product.siddhAddonPrice > 0
      ? product.siddhAddonPrice
      : 0;
  const units = Math.max(
    1,
    typeof product.siddhAddonUnits === "number" && product.siddhAddonUnits > 0
      ? product.siddhAddonUnits
      : packQuantityFromLabel(product.title),
  );
  const selected = !!product.siddhAddonSelected && unit > 0;
  const perParentQty = unit * units;
  const baseUnitPrice = Math.max(
    0,
    (typeof product.price === "number" ? product.price : 0) -
      (selected ? perParentQty : 0),
  );
  return {
    available:
      !!product.siddhAddonEnabled &&
      unit > 0,
    selected,
    unit,
    units,
    perParentQty,
    baseUnitPrice,
    name:
      product.siddhAddonName?.trim() ||
      product.siddhAddonHeading?.trim() ||
      "Add-on product",
    heading: product.siddhAddonHeading?.trim() || null,
  };
}

/**
 * Linked add-on upsell pricing:
 * - First `addonComboQty` units → combo / offer price
 * - Extra units (via +) → catalog / original price
 */
export function getAddonUpsellPricing(
  product: {
    price?: number;
    compareAt?: number;
    addonComboPrice?: number | null;
    addonCatalogPrice?: number | null;
    addonComboQty?: number | null;
  },
  quantity: number,
) {
  const qty = Math.max(0, Math.floor(quantity));
  const comboPrice = Math.max(
    0,
    typeof product.addonComboPrice === "number" && product.addonComboPrice > 0
      ? product.addonComboPrice
      : typeof product.price === "number"
        ? product.price
        : 0,
  );
  const catalogPrice = Math.max(
    comboPrice,
    typeof product.addonCatalogPrice === "number" &&
      product.addonCatalogPrice > 0
      ? product.addonCatalogPrice
      : typeof product.compareAt === "number" && product.compareAt > 0
        ? product.compareAt
        : comboPrice,
  );
  const comboQty = Math.min(
    qty,
    Math.max(
      0,
      typeof product.addonComboQty === "number" && product.addonComboQty > 0
        ? Math.floor(product.addonComboQty)
        : qty,
    ),
  );
  const extraQty = Math.max(0, qty - comboQty);
  const lineTotal = comboQty * comboPrice + extraQty * catalogPrice;
  const compareTotal = qty * catalogPrice;
  return {
    comboPrice,
    catalogPrice,
    comboQty,
    extraQty,
    lineTotal,
    compareTotal,
  };
}

/** Line total for any cart row (handles mixed add-on pricing). */
export function cartLineTotal(
  product: {
    price?: number;
    compareAt?: number;
    isAddonUpsell?: boolean | null;
    siddhAddonSelected?: boolean | null;
    siddhAddonPrice?: number | null;
    siddhAddonUnits?: number | null;
    siddhAddonName?: string | null;
    siddhAddonHeading?: string | null;
    siddhAddonEnabled?: boolean | null;
    title?: string | null;
    addonComboPrice?: number | null;
    addonCatalogPrice?: number | null;
    addonComboQty?: number | null;
  },
  quantity: number,
) {
  if (product.isAddonUpsell) {
    return getAddonUpsellPricing(product, quantity).lineTotal;
  }
  const addon = getCartAddonBreakdown(product);
  if (addon.selected) return addon.baseUnitPrice * quantity;
  return (typeof product.price === "number" ? product.price : 0) * quantity;
}

export function cartLineCompareTotal(
  product: {
    price?: number;
    compareAt?: number;
    isAddonUpsell?: boolean | null;
    siddhAddonSelected?: boolean | null;
    siddhAddonPrice?: number | null;
    siddhAddonUnits?: number | null;
    title?: string | null;
    addonComboPrice?: number | null;
    addonCatalogPrice?: number | null;
    addonComboQty?: number | null;
  },
  quantity: number,
) {
  if (product.isAddonUpsell) {
    return getAddonUpsellPricing(product, quantity).compareTotal;
  }
  const unit =
    typeof product.compareAt === "number" &&
    product.compareAt > (product.price || 0)
      ? product.compareAt
      : product.price || 0;
  return unit * quantity;
}

/** Server + client agree on the default selected pack (popular, else first). */
export function getDefaultPackIndex(product: Product): number {
  const packs = getProductPacks(product);
  const popular = packs.findIndex((p) => p.popular);
  return popular >= 0 ? popular : 0;
}

export function getDisplayPrice(product: Product, packIdx?: number): number {
  if (product.isFreeProduct) return 0;
  const packs = getProductPacks(product);
  const idx = packIdx ?? getDefaultPackIndex(product);
  const pack = packs[idx];
  return pack?.price ?? product.price;
}

export function getAvailabilityLabel(product: Product, packIdx?: number): string {
  const packs = getProductPacks(product);
  const idx = packIdx ?? getDefaultPackIndex(product);
  const pack = packs[idx];
  const stock =
    pack?.stock != null
      ? pack.stock
      : product.stock != null
        ? product.stock
        : null;
  const soldOut =
    stock != null
      ? stock <= 0
      : !!product.soldOut || pack?.soldOut === true;
  return soldOut ? "OutOfStock" : "InStock";
}
