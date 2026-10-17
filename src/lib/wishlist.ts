"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api, type Product } from "./api";
import { useCustomerAuth } from "./customer-auth";

/** Snapshot kept on device; prices refresh when the shopper opens the product. */
export type WishlistItem = Pick<
  Product,
  "id" | "slug" | "title" | "image" | "price" | "compareAt" | "isFreeProduct" | "soldOut"
> & { brandName?: string | null; addedAt: number };

type WishlistState = {
  items: WishlistItem[];
  /** Account whose wishlist this device last merged with (null = guest list). */
  syncedUserId: string | null;
  /** A push to the account failed; the next sync merges instead of replacing. */
  dirty: boolean;
  has: (id: string) => boolean;
  toggle: (product: Product) => boolean;
  remove: (id: string) => void;
  clear: () => void;
  replaceFromServer: (products: Product[], userId: string) => void;
  markDirty: () => void;
  resetAccount: () => void;
};

const MAX_ITEMS = 200;

function toItem(product: Product, addedAt = Date.now()): WishlistItem {
  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    image: product.image,
    price: product.price,
    compareAt: product.compareAt,
    isFreeProduct: product.isFreeProduct,
    soldOut: product.soldOut,
    brandName: product.brand?.name ?? null,
    addedAt,
  };
}

function pushChange(productId: string, added: boolean) {
  const token = useCustomerAuth.getState().token;
  if (!token) return;
  const req = added
    ? api("/wishlist", { method: "POST", token, body: { productId } })
    : api(`/wishlist/${encodeURIComponent(productId)}`, { method: "DELETE", token });
  req.catch(() => useWishlist.getState().markDirty());
}

export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      syncedUserId: null,
      dirty: false,
      has: (id) => get().items.some((i) => i.id === id),
      toggle: (product) => {
        if (get().has(product.id)) {
          set({ items: get().items.filter((i) => i.id !== product.id) });
          pushChange(product.id, false);
          return false;
        }
        set({ items: [toItem(product), ...get().items].slice(0, MAX_ITEMS) });
        pushChange(product.id, true);
        return true;
      },
      remove: (id) => {
        set({ items: get().items.filter((i) => i.id !== id) });
        pushChange(id, false);
      },
      clear: () => set({ items: [] }),
      replaceFromServer: (products, userId) => {
        const addedAt = new Map(get().items.map((i) => [i.id, i.addedAt]));
        const now = Date.now();
        set({
          items: products
            .slice(0, MAX_ITEMS)
            .map((p, i) => toItem(p, addedAt.get(p.id) ?? now - i)),
          syncedUserId: userId,
          dirty: false,
        });
      },
      markDirty: () => set({ dirty: true }),
      resetAccount: () => set({ items: [], syncedUserId: null, dirty: false }),
    }),
    { name: "ananta-fashion-wishlist", version: 1 },
  ),
);
