import { api, ApiError, type Product } from "@/lib/api";
import {
  cartLineKey,
  maxOrderQty,
  useCart,
  type CartItem,
} from "@/lib/cart";
import { packQuantityFromLabel } from "@/lib/product-packs";

type LiveProduct = Product & {
  status?: string;
  deletedAt?: string | null;
  variants?: {
    id: string;
    price?: number;
    compareAtPrice?: number | null;
    inventory?: { quantityOnHand?: number; quantityReserved?: number } | null;
  }[];
};

function rupeesFromPaise(paise?: number | null) {
  if (paise == null || !Number.isFinite(paise)) return null;
  return Math.round(paise / 100);
}

function liveUnitPrice(live: LiveProduct, variantId?: string | null) {
  const packs = live.variantOptions || [];
  if (variantId) {
    const pack = packs.find((p) => p.variantId === variantId);
    if (pack && typeof pack.price === "number") return pack.price;

    const raw = live.variants?.find((v) => v.id === variantId);
    const fromRaw = rupeesFromPaise(raw?.price);
    if (fromRaw != null) return fromRaw;
  }
  return live.price;
}

function liveCompareAt(
  live: LiveProduct,
  variantId: string | null | undefined,
  unit: number,
) {
  if (variantId) {
    const pack = live.variantOptions?.find((p) => p.variantId === variantId);
    if (pack) return Math.max(live.compareAt || 0, unit);
    const raw = live.variants?.find((v) => v.id === variantId);
    const fromRaw = rupeesFromPaise(raw?.compareAtPrice);
    if (fromRaw != null) return Math.max(fromRaw, unit);
  }
  return Math.max(live.compareAt || 0, unit);
}

function liveStock(live: LiveProduct, variantId?: string | null) {
  if (variantId) {
    const pack = live.variantOptions?.find((p) => p.variantId === variantId);
    if (typeof pack?.stock === "number") return pack.stock;
    const raw = live.variants?.find((v) => v.id === variantId);
    if (raw?.inventory) {
      const onHand = Math.max(0, raw.inventory.quantityOnHand || 0);
      const reserved = Math.max(0, raw.inventory.quantityReserved || 0);
      return Math.max(0, onHand - reserved);
    }
  }
  return live.stock ?? 0;
}

function lineTitle(live: LiveProduct, variantId?: string | null) {
  const pack = live.variantOptions?.find((p) => p.variantId === variantId);
  if (pack?.label) return `${live.title} (${pack.label})`;
  return live.title;
}

function mergeCartLine(
  item: CartItem,
  live: LiveProduct | null,
  parentLive?: LiveProduct | null,
  parentQty?: number,
): CartItem | null {
  if (!live || live.deletedAt || (live.status && live.status !== "ACTIVE")) {
    return null;
  }

  const variantId = item.product.variantId || live.variantId;

  // Linked add-on upsell: keep parent's combo price, not catalog MRP of the linked SKU.
  if (item.product.isAddonUpsell) {
    const parent = parentLive || null;
    const comboOk =
      !!parent &&
      !parent.deletedAt &&
      (!parent.status || parent.status === "ACTIVE") &&
      !!parent.siddhAddonEnabled &&
      (parent.siddhAddonPrice || 0) > 0 &&
      (parent.addonLinkedProductId === live.id ||
        parent.siddhAddonProduct?.id === live.id);
    if (!comboOk) return null;

    const unit = parent.siddhAddonPrice || 0;
    const catalogUnit = live.isFreeProduct ? 0 : liveUnitPrice(live, variantId);
    const catalogPrice = Math.max(unit, catalogUnit || 0);
    const stock = liveStock(live, variantId);
    const soldOut = stock <= 0 || !!live.soldOut;
    const per = Math.max(1, item.product.addonUnitsPerParent || 1);
    const syncedCombo = Math.max(1, (parentQty && parentQty > 0 ? parentQty : 1) * per);
    const prevCombo = Math.max(
      1,
      item.product.addonComboQty || syncedCombo,
    );
    const extras = Math.max(0, item.quantity - prevCombo);
    const desiredQty = syncedCombo + extras;
    const product: Product = {
      ...item.product,
      id: live.id,
      slug: live.slug,
      title:
        parent.siddhAddonName?.trim() ||
        item.product.title ||
        live.title,
      image: live.image || item.product.image,
      images: live.images || item.product.images,
      price: unit,
      compareAt: catalogPrice,
      variantId,
      stock,
      soldOut,
      isFreeProduct: false,
      isAddonUpsell: true,
      addonParentId: item.product.addonParentId || parent.id,
      addonUnitsPerParent: per,
      addonComboQty: syncedCombo,
      addonComboPrice: unit,
      addonCatalogPrice: catalogPrice,
      siddhAddonEnabled: false,
      siddhAddonSelected: false,
      siddhAddonUnits: undefined,
    };

    const max = maxOrderQty(product);
    if (max <= 0) return null;

    return {
      product,
      quantity: Math.min(desiredQty, max),
    };
  }

  let unit = live.isFreeProduct ? 0 : liveUnitPrice(live, variantId);
  let siddhAddonSelected = !!item.product.siddhAddonSelected;
  const addonUnit =
    live.siddhAddonEnabled && (live.siddhAddonPrice || 0) > 0
      ? live.siddhAddonPrice || 0
      : 0;

  if (siddhAddonSelected && addonUnit <= 0) {
    siddhAddonSelected = false;
  }
  // Keep fee-on-parent as-is. Clearing it when a linked SKU "looks ready"
  // without also inserting an upsell line drops ₹100 from the total (cart
  // shows 450 with plate still offered). Linked lines are owned by
  // addItem / setSiddhAddon, which strip the fee only after the upsell exists.
  const packLabel =
    (live.variantOptions || []).find((p) => p.variantId === variantId)?.label ||
    item.product.title ||
    live.title ||
    "";
  const siddhUnits = Math.max(
    1,
    item.product.siddhAddonUnits ||
      packQuantityFromLabel(packLabel) ||
      1,
  );
  if (siddhAddonSelected) unit += addonUnit * siddhUnits;

  const stock = liveStock(live, variantId);
  const soldOut = stock <= 0 || !!live.soldOut;
  const product: Product = {
    ...item.product,
    id: live.id,
    slug: live.slug,
    title: lineTitle(live, variantId),
    image: live.image || item.product.image,
    images: live.images || item.product.images,
    price: unit,
    compareAt: liveCompareAt(live, variantId, unit),
    variantId,
    stock,
    soldOut,
    isFreeProduct: !!live.isFreeProduct,
    siddhAddonEnabled: live.siddhAddonEnabled,
    siddhAddonName: live.siddhAddonName,
    siddhAddonPrice: live.siddhAddonPrice,
    siddhAddonProduct: live.siddhAddonProduct || item.product.siddhAddonProduct,
    addonLinkedProductId:
      live.addonLinkedProductId || item.product.addonLinkedProductId,
    siddhAddonSelected,
    siddhAddonUnits: siddhAddonSelected ? siddhUnits : undefined,
    showCashbackRibbon: live.showCashbackRibbon,
    cashbackRibbon: live.cashbackRibbon,
    extraOfferLabel: live.extraOfferLabel,
  };

  const max = maxOrderQty(product);
  if (max <= 0) return null;

  return {
    product,
    quantity: Math.min(item.quantity, max),
  };
}

let inflight: Promise<void> | null = null;

/** Pull live catalog prices/stock into the persisted cart. */
export async function refreshCartFromCatalog() {
  if (inflight) return inflight;

  let stale = false;
  inflight = (async () => {
    const current = useCart.getState().items;
    if (!current.length) return;

    const parentSlugById = new Map<string, string>();
    for (const i of current) {
      if (!i.product.isAddonUpsell && i.product.id && i.product.slug) {
        parentSlugById.set(i.product.id, i.product.slug);
      }
    }

    const slugs = [
      ...new Set(
        current
          .flatMap((i) => {
            const own = String(i.product.slug || "").trim();
            if (!i.product.isAddonUpsell) return [own];
            const parentId = String(i.product.addonParentId || "").trim();
            const parentSlug = parentSlugById.get(parentId) || "";
            return [own, parentSlug];
          })
          .filter(Boolean),
      ),
    ];
    if (!slugs.length) return;

    const liveBySlug = new Map<string, LiveProduct>();
    let unreachable = false;
    await Promise.all(
      slugs.map(async (slug) => {
        try {
          const live = await api<LiveProduct>(
            `/products/${encodeURIComponent(slug)}`,
          );
          if (live?.slug) liveBySlug.set(live.slug, live);
          if (live?.id) liveBySlug.set(live.id, live);
        } catch (err) {
          // Only a definite 404/410 means the product is gone. Network errors,
          // aborted fetches (page unload) and 5xx must never empty the cart.
          if (!(err instanceof ApiError && (err.status === 404 || err.status === 410))) {
            unreachable = true;
          }
        }
      }),
    );
    if (unreachable) return;

    const next: CartItem[] = [];
    const seen = new Set<string>();
    for (const item of current) {
      const live =
        liveBySlug.get(item.product.slug) ||
        liveBySlug.get(item.product.id) ||
        null;
      const parentLive = item.product.isAddonUpsell
        ? liveBySlug.get(String(item.product.addonParentId || "")) ||
          liveBySlug.get(
            parentSlugById.get(String(item.product.addonParentId || "")) || "",
          ) ||
          null
        : null;
      const parentQty = item.product.isAddonUpsell
        ? current.find(
            (p) =>
              !p.product.isAddonUpsell &&
              p.product.id === item.product.addonParentId,
          )?.quantity
        : undefined;
      const merged = mergeCartLine(item, live, parentLive, parentQty);
      if (!merged) continue;
      const key = cartLineKey(merged.product);
      if (seen.has(key)) continue;
      seen.add(key);
      next.push(merged);
    }

    const before = JSON.stringify(
      current.map((i) => ({
        k: cartLineKey(i.product),
        p: i.product.price,
        c: i.product.compareAt,
        q: i.quantity,
        s: i.product.stock,
      })),
    );
    const after = JSON.stringify(
      next.map((i) => ({
        k: cartLineKey(i.product),
        p: i.product.price,
        c: i.product.compareAt,
        q: i.quantity,
        s: i.product.stock,
      })),
    );
    // Cart changed while fetching (item added, account cart pulled): don't overwrite it.
    if (useCart.getState().items !== current) {
      stale = true;
      return;
    }
    if (before !== after) {
      useCart.getState().applyCatalogRefresh(next);
    }
  })().finally(() => {
    inflight = null;
    if (stale) void refreshCartFromCatalog();
  });

  return inflight;
}
