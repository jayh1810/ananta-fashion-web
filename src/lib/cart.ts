"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "./api";
import { trackAddToCart } from "./meta-pixel";
import { trackAddToCartEvent } from "./analytics";
import { packQuantityFromLabel, cartLineTotal, cartLineCompareTotal } from "./product-packs";

export type CartItem = {
  product: Product;
  quantity: number;
};

/** Hard cap per product line (also limited by stock). */
export const CART_MAX_QTY_PER_PRODUCT = 25;

/** Unique line key when same product can appear with different packs/variants/addons. */
export function cartLineKey(product: {
  id: string;
  variantId?: string | null;
  siddhAddonSelected?: boolean | null;
  isAddonUpsell?: boolean | null;
  addonParentId?: string | null;
}) {
  if (product.isAddonUpsell) {
    return `${product.id}::${product.variantId || ""}::upsell:${product.addonParentId || ""}`;
  }
  return `${product.id}::${product.variantId || ""}::${
    product.siddhAddonSelected ? "siddh" : ""
  }`;
}

function sameLine(
  a: {
    id: string;
    variantId?: string | null;
    siddhAddonSelected?: boolean | null;
    isAddonUpsell?: boolean | null;
    addonParentId?: string | null;
  },
  b: {
    id: string;
    variantId?: string | null;
    siddhAddonSelected?: boolean | null;
    isAddonUpsell?: boolean | null;
    addonParentId?: string | null;
  },
) {
  return cartLineKey(a) === cartLineKey(b);
}

/** Max units a customer can add for this product line (stock ∩ 25). Free products are always qty 1. */
export function maxOrderQty(product?: {
  stock?: number | null;
  soldOut?: boolean;
  isFreeProduct?: boolean | null;
} | null) {
  if (!product || product.soldOut) return 0;
  if (product.stock == null || !Number.isFinite(product.stock)) return 0;
  const stock = Math.max(0, Math.floor(product.stock));
  if (product.isFreeProduct) return Math.min(1, stock);
  return Math.min(CART_MAX_QTY_PER_PRODUCT, stock);
}

function qtyLimitMessage(
  max: number,
  stock?: number | null,
  isFreeProduct?: boolean | null,
) {
  if (isFreeProduct) {
    return "Free products are limited to 1 per order.";
  }
  if (stock != null && stock <= max && stock < CART_MAX_QTY_PER_PRODUCT) {
    return `Only ${max} left in stock for this product.`;
  }
  return `You can add up to ${CART_MAX_QTY_PER_PRODUCT} units of this product. Limit reached.`;
}

type CartState = {
  items: CartItem[];
  isOpen: boolean;
  checkoutOpen: boolean;
  lastStockMessage: string | null;
  /** UI-only (not persisted): drives the "Added to cart" celebration. */
  lastAdded: {
    at: number;
    title: string;
    image?: string | null;
    quantity: number;
  } | null;
  openCart: () => void;
  closeCart: () => void;
  openCheckout: () => void;
  closeCheckout: () => void;
  addItem: (product: Product, qty?: number) => { ok: boolean; message?: string };
  removeItem: (
    productId: string,
    variantId?: string | null,
    siddhAddon?: boolean,
  ) => void;
  updateQty: (
    productId: string,
    qty: number,
    variantId?: string | null,
    siddhAddon?: boolean,
  ) => { ok: boolean; message?: string };
  /** Enable/disable Siddh add-on on an existing cart line (same product + pack). */
  setSiddhAddon: (
    productId: string,
    variantId: string | null | undefined,
    enabled: boolean,
  ) => { ok: boolean; message?: string };
  clear: () => void;
  clearStockMessage: () => void;
  /** Replace cart lines with catalog-fresh prices / stock (drops unavailable). */
  applyCatalogRefresh: (next: CartItem[]) => void;
  count: () => number;
  subtotal: () => number;
  compareTotal: () => number;
  saved: () => number;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      checkoutOpen: false,
      lastStockMessage: null,
      lastAdded: null,
      openCart: () => set({ isOpen: true, checkoutOpen: false }),
      closeCart: () => set({ isOpen: false }),
      openCheckout: () => set({ checkoutOpen: true, isOpen: false }),
      closeCheckout: () => set({ checkoutOpen: false }),
      clearStockMessage: () => set({ lastStockMessage: null }),
      addItem: (product, qty = 1) => {
        const max = maxOrderQty(product);
        if (max <= 0) {
          const message = "This item is out of stock";
          set({ lastStockMessage: message });
          return { ok: false, message };
        }

        const addQty = Math.max(1, Math.floor(qty));
        const items = [...get().items];
        const idx = items.findIndex((i) => sameLine(i.product, product));
        const current = idx >= 0 ? items[idx].quantity : 0;
        const nextQty = Math.min(max, current + addQty);

        if (nextQty <= current) {
          const message = qtyLimitMessage(
            max,
            product.stock,
            product.isFreeProduct,
          );
          set({ lastStockMessage: message, isOpen: true, checkoutOpen: false });
          return { ok: false, message };
        }

        const lineProduct = { ...product, soldOut: false };
        if (idx >= 0) {
          items[idx] = {
            product: { ...items[idx].product, ...lineProduct },
            quantity: nextQty,
          };
        } else {
          items.push({ product: lineProduct, quantity: nextQty });
        }

        const capped = nextQty < current + addQty;
        const message = capped
          ? qtyLimitMessage(max, product.stock, product.isFreeProduct)
          : null;
        const quantityAdded = nextQty - current;
        // Keep checkout open when adding from checkout wallet upsell
        const inCheckout = get().checkoutOpen;
        set({
          items,
          isOpen: inCheckout ? false : true,
          checkoutOpen: inCheckout,
          lastStockMessage: message,
          lastAdded:
            quantityAdded > 0
              ? {
                  at: Date.now(),
                  title: product.title,
                  image: product.image,
                  quantity: quantityAdded,
                }
              : get().lastAdded,
        });
        try {
          if (quantityAdded > 0) {
            trackAddToCart({
              content_ids: [product.id],
              content_name: product.title,
              value: product.price * quantityAdded,
              currency: "INR",
              contents: [{ id: product.id, quantity: quantityAdded }],
            });
            trackAddToCartEvent({
              productId: product.id,
              slug: product.slug,
              title: product.title,
              quantity: quantityAdded,
              value: product.price * quantityAdded,
              source: "cart",
            });
          }
        } catch {
          /* Meta tracking must never break cart */
        }
        return { ok: true, message: message || undefined };
      },
      removeItem: (productId, variantId, siddhAddon) =>
        set({
          items: (() => {
            const items = get().items;
            const upsellIdx = items.findIndex(
              (i) =>
                i.product.isAddonUpsell &&
                i.product.id === productId &&
                (i.product.variantId || "") === (variantId || ""),
            );
            if (upsellIdx >= 0) {
              return items.filter((_, idx) => idx !== upsellIdx);
            }
            return items.filter((i) => {
              if (
                sameLine(i.product, {
                  id: productId,
                  variantId,
                  siddhAddonSelected: !!siddhAddon,
                })
              ) {
                return false;
              }
              if (
                i.product.isAddonUpsell &&
                i.product.addonParentId === productId
              ) {
                return false;
              }
              return true;
            });
          })(),
        }),
      updateQty: (productId, qty, variantId, siddhAddon) => {
        const items = get().items;
        const upsellLine = items.find(
          (i) =>
            i.product.isAddonUpsell &&
            i.product.id === productId &&
            (i.product.variantId || "") === (variantId || ""),
        );

        if (upsellLine) {
          const comboFloor = Math.max(
            1,
            upsellLine.product.addonComboQty || 1,
          );
          if (qty < comboFloor) {
            // Below combo units → remove the add-on line entirely.
            get().removeItem(productId, variantId, siddhAddon);
            return { ok: true };
          }
          const max = maxOrderQty(upsellLine.product);
          if (max <= 0) {
            get().removeItem(productId, variantId, siddhAddon);
            const message = "This item is out of stock";
            set({ lastStockMessage: message });
            return { ok: false, message };
          }
          const nextQty = Math.min(max, Math.floor(qty));
          const capped = nextQty < qty;
          set({
            items: items.map((i) =>
              i === upsellLine ? { ...i, quantity: nextQty } : i,
            ),
            lastStockMessage: capped
              ? qtyLimitMessage(
                  max,
                  upsellLine.product.stock,
                  upsellLine.product.isFreeProduct,
                )
              : null,
          });
          return {
            ok: true,
            message: capped
              ? qtyLimitMessage(
                  max,
                  upsellLine.product.stock,
                  upsellLine.product.isFreeProduct,
                )
              : undefined,
          };
        }

        const identity = {
          id: productId,
          variantId,
          siddhAddonSelected: !!siddhAddon,
        };
        if (qty <= 0) {
          get().removeItem(productId, variantId, siddhAddon);
          return { ok: true };
        }

        const line = items.find((i) => sameLine(i.product, identity));
        if (!line) return { ok: false, message: "Item not in cart" };

        const max = maxOrderQty(line.product);
        if (max <= 0) {
          get().removeItem(productId, variantId, siddhAddon);
          const message = "This item is out of stock";
          set({ lastStockMessage: message });
          return { ok: false, message };
        }

        const nextQty = Math.min(max, Math.floor(qty));
        const capped = nextQty < qty;
        set({
          items: get().items.map((i) => {
            if (sameLine(i.product, identity)) {
              return { ...i, quantity: nextQty };
            }
            if (
              i.product.isAddonUpsell &&
              i.product.addonParentId === productId
            ) {
              const per = Math.max(1, i.product.addonUnitsPerParent || 1);
              const newCombo = nextQty * per;
              const prevCombo = Math.max(
                1,
                i.product.addonComboQty || i.quantity,
              );
              const extras = Math.max(0, i.quantity - prevCombo);
              const desired = newCombo + extras;
              const addonMax = maxOrderQty(i.product);
              const cappedQty =
                addonMax > 0 ? Math.min(addonMax, desired) : desired;
              return {
                ...i,
                quantity: cappedQty,
                product: {
                  ...i.product,
                  addonComboQty: newCombo,
                },
              };
            }
            return i;
          }),
          lastStockMessage: capped
            ? qtyLimitMessage(
                max,
                line.product.stock,
                line.product.isFreeProduct,
              )
            : null,
        });
        return {
          ok: true,
          message: capped
            ? qtyLimitMessage(
                max,
                line.product.stock,
                line.product.isFreeProduct,
              )
            : undefined,
        };
      },
      setSiddhAddon: (productId, variantId, enabled) => {
        const items = [...get().items];
        const idx = items.findIndex(
          (i) =>
            !i.product.isAddonUpsell &&
            i.product.id === productId &&
            (i.product.variantId || "") === (variantId || ""),
        );
        if (idx < 0) return { ok: false, message: "Item not in cart" };

        const line = items[idx];
        const p = line.product;
        const linked = p.siddhAddonProduct;
        const addonUnit =
          typeof p.siddhAddonPrice === "number" ? p.siddhAddonPrice : 0;
        if (!p.siddhAddonEnabled || addonUnit <= 0) {
          return { ok: false, message: "Add-on is not available" };
        }

        const units = Math.max(
          1,
          p.siddhAddonUnits || packQuantityFromLabel(p.title) || 1,
        );

        if (linked?.id && linked.variantId) {
          const upsellIdx = items.findIndex(
            (i) =>
              i.product.isAddonUpsell &&
              i.product.addonParentId === productId &&
              i.product.id === linked.id,
          );
          if (enabled) {
            const linkedReady =
              !linked.soldOut &&
              (linked.stock == null || linked.stock > 0);
            if (linkedReady) {
              const desiredQty = line.quantity * units;
              const catalogPrice = Math.max(
                addonUnit,
                linked.price || addonUnit,
              );
              const upsellProduct: Product = {
                id: linked.id,
                title: p.siddhAddonName || linked.title,
                slug: linked.slug,
                price: addonUnit,
                compareAt: catalogPrice,
                image: linked.image || "",
                description: "",
                reviews: 0,
                rating: 0,
                variantId: linked.variantId,
                stock: linked.stock ?? desiredQty,
                soldOut: !!linked.soldOut,
                siddhAddonEnabled: false,
                siddhAddonSelected: false,
                isAddonUpsell: true,
                addonParentId: productId,
                addonUnitsPerParent: units,
                addonComboQty: desiredQty,
                addonComboPrice: addonUnit,
                addonCatalogPrice: catalogPrice,
              };
              const max = maxOrderQty(upsellProduct);
              if (max > 0) {
                const qty = Math.min(max, desiredQty);
                if (upsellIdx >= 0) {
                  items[upsellIdx] = { product: upsellProduct, quantity: qty };
                } else {
                  items.push({ product: upsellProduct, quantity: qty });
                }
                if (p.siddhAddonSelected) {
                  const fee = addonUnit * units;
                  items[idx] = {
                    ...items[idx],
                    product: {
                      ...p,
                      price: Math.max(0, p.price - fee),
                      compareAt: Math.max(0, (p.compareAt || 0) - fee),
                      siddhAddonSelected: false,
                      siddhAddonUnits: undefined,
                      siddhAddonProduct: linked,
                    },
                  };
                } else {
                  items[idx] = {
                    ...items[idx],
                    product: { ...p, siddhAddonProduct: linked },
                  };
                }
                set({ items, isOpen: true, lastStockMessage: null });
                return { ok: true };
              }
            }
            // Linked SKU unavailable — fall through to fee-on-parent below.
          } else {
            if (upsellIdx >= 0) items.splice(upsellIdx, 1);
            set({ items, lastStockMessage: null });
            return { ok: true };
          }
        }

        const addonPrice = addonUnit * units;
        const was = !!p.siddhAddonSelected;
        if (was === enabled) return { ok: true };

        let basePrice = was ? p.price - addonPrice : p.price;
        if (p.isFreeProduct) basePrice = 0;
        basePrice = Math.max(0, basePrice);

        const nextPrice = enabled ? basePrice + addonPrice : basePrice;
        let baseCompare = was
          ? Math.max(0, (p.compareAt || 0) - addonPrice)
          : p.compareAt || 0;
        if (p.isFreeProduct) {
          baseCompare = Math.max(baseCompare, p.compareAt || 0, p.price || 0);
        }
        const nextCompare = Math.max(
          baseCompare,
          nextPrice,
          enabled ? baseCompare + addonPrice : baseCompare,
        );

        const nextProduct: Product = {
          ...p,
          price: nextPrice,
          compareAt: nextCompare,
          siddhAddonSelected: enabled,
          siddhAddonUnits: enabled ? units : undefined,
          isFreeProduct: !!p.isFreeProduct,
        };

        const targetKey = cartLineKey(nextProduct);
        const mergeIdx = items.findIndex(
          (i, j) => j !== idx && cartLineKey(i.product) === targetKey,
        );

        if (mergeIdx >= 0) {
          const max = maxOrderQty(nextProduct);
          const otherQty = items[mergeIdx].quantity;
          const desired = otherQty + line.quantity;
          const mergedQty = Math.min(max, desired);
          items[mergeIdx] = {
            product: {
              ...items[mergeIdx].product,
              ...nextProduct,
            },
            quantity: mergedQty,
          };
          items.splice(idx, 1);
          set({
            items,
            lastStockMessage:
              mergedQty < desired
                ? qtyLimitMessage(
                    max,
                    nextProduct.stock,
                    nextProduct.isFreeProduct,
                  )
                : null,
          });
          return { ok: true };
        }

        items[idx] = { ...line, product: nextProduct };
        set({ items, lastStockMessage: null });
        return { ok: true };
      },
      clear: () => set({ items: [], lastStockMessage: null }),
      applyCatalogRefresh: (next) =>
        set({
          items: next,
          lastStockMessage: null,
        }),
      count: () => get().items.reduce((s, i) => s + i.quantity, 0),
      subtotal: () =>
        get().items.reduce(
          (s, i) => s + cartLineTotal(i.product, i.quantity),
          0,
        ),
      compareTotal: () =>
        get().items.reduce(
          (s, i) => s + cartLineCompareTotal(i.product, i.quantity),
          0,
        ),
      saved: () => Math.max(0, get().compareTotal() - get().subtotal()),
    }),
    {
      name: "ananta-fashion-cart",
      partialize: (state) => ({ items: state.items }),
      onRehydrateStorage: () => (state) => {
        if (!state?.items?.length) return;
        state.items = state.items
          .map((item) => {
            const max = maxOrderQty(item.product);
            if (max <= 0) return null;
            let product = item.product;
            if (product.isAddonUpsell) {
              const comboPrice =
                product.addonComboPrice || product.price || 0;
              const catalogPrice = Math.max(
                comboPrice,
                product.addonCatalogPrice ||
                  product.compareAt ||
                  comboPrice,
              );
              const comboQty = Math.max(
                1,
                product.addonComboQty || item.quantity,
              );
              product = {
                ...product,
                addonComboPrice: comboPrice,
                addonCatalogPrice: catalogPrice,
                addonComboQty: comboQty,
                price: comboPrice,
                compareAt: catalogPrice,
              };
            }
            return {
              ...item,
              product,
              quantity: Math.min(item.quantity, max),
            };
          })
          .filter(Boolean) as CartItem[];
      },
    },
  ),
);
