"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import type { CartItem } from "./cart";

/** Server-computed ₹0 gift line (display only — checkout adds it on the server). */
export type FreeGiftPreviewLine = {
  variantId: string;
  title: string;
  image: string | null;
  quantity: number;
  /** Catalog value per unit, rupees. */
  worth: number;
  parentProductIds: string[];
};

export type FreeGiftUnavailable = {
  title: string;
  wanted: number;
  given: number;
};

type PreviewResponse = {
  gifts?: FreeGiftPreviewLine[];
  unavailable?: FreeGiftUnavailable[];
};

const EMPTY: Required<PreviewResponse> = { gifts: [], unavailable: [] };

/** `vid:qty,…` for paid cart lines (add-on upsell lines never earn gifts). */
function previewQuery(items: CartItem[]): string {
  const qty = new Map<string, number>();
  for (const { product, quantity } of items) {
    if (!product.variantId || product.isAddonUpsell) continue;
    qty.set(product.variantId, (qty.get(product.variantId) || 0) + quantity);
  }
  return [...qty.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([vid, q]) => `${vid}:${q}`)
    .join(",");
}

/**
 * Free gifts the server will add at ₹0 for the current cart.
 * Never mutates the cart — purely informational.
 */
export function useFreeGiftPreview(items: CartItem[], enabled = true) {
  const query = useMemo(
    () => (enabled ? previewQuery(items) : ""),
    [items, enabled],
  );
  const [result, setResult] = useState<{
    key: string;
    data: Required<PreviewResponse>;
  }>({ key: "", data: EMPTY });

  useEffect(() => {
    if (!query) return;
    let cancelled = false;
    const t = setTimeout(() => {
      api<PreviewResponse>(
        `/free-gifts/preview?items=${encodeURIComponent(query)}`,
      )
        .then((res) => {
          if (cancelled) return;
          setResult({
            key: query,
            data: {
              gifts: Array.isArray(res?.gifts) ? res.gifts : [],
              unavailable: Array.isArray(res?.unavailable)
                ? res.unavailable
                : [],
            },
          });
        })
        .catch(() => {
          if (!cancelled) setResult({ key: query, data: EMPTY });
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const data = query && result.key === query ? result.data : EMPTY;
  const giftUnits = data.gifts.reduce((s, g) => s + g.quantity, 0);
  const giftWorth = data.gifts.reduce((s, g) => s + g.worth * g.quantity, 0);
  /** True once `gifts` reflects the current cart (false while loading or disabled). */
  const ready = enabled && (!query || result.key === query);
  return { ...data, giftUnits, giftWorth, ready };
}
