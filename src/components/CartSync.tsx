"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { cartLineKey, useCart, type CartItem } from "@/lib/cart";
import { refreshCartFromCatalog } from "@/lib/cart-refresh";
import { useCustomerAuth } from "@/lib/customer-auth";
import {
  fetchServerCart,
  serverLineToCartItem,
  type ServerCartLine,
} from "@/lib/server-cart";

function syncPayload(items: CartItem[]) {
  return {
    items: items.map(({ product, quantity }) => ({
      productId: product.id,
      variantId: product.variantId || null,
      quantity,
      lineKey: cartLineKey(product),
      siddhAddon: !!product.siddhAddonSelected,
      siddhAddonName: product.siddhAddonName || null,
      title: product.title,
      price: product.price,
      compareAt: product.compareAt,
      image: product.image || null,
      slug: product.slug,
    })),
  };
}

let lastPayload = "";

/** Cart was just loaded from the server — don't echo it straight back. */
export function markCartSynced(items: CartItem[]) {
  lastPayload = JSON.stringify(syncPayload(items));
}

/** lineKey → quantity; prices are refreshed from the catalog separately. */
type Lines = Record<string, number>;

const itemLines = (items: CartItem[]): Lines =>
  Object.fromEntries(items.map((i) => [cartLineKey(i.product), i.quantity]));

const serverLines = (lines: ServerCartLine[]): Lines =>
  Object.fromEntries(lines.map((l) => [l.lineKey as string, l.quantity]));

function sameLines(a: Lines, b: Lines) {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k]);
}

/** What this device last agreed with the account cart on (survives reloads). */
const BASE_KEY = "ananta-fashion-cart-synced";

function readBase(userId: string): Lines | null {
  try {
    const v = JSON.parse(localStorage.getItem(BASE_KEY) || "null") as {
      userId?: string;
      lines?: Lines;
    } | null;
    return v?.userId === userId && v.lines ? v.lines : null;
  } catch {
    return null;
  }
}

function writeBase(userId: string, lines: Lines) {
  try {
    localStorage.setItem(BASE_KEY, JSON.stringify({ userId, lines }));
  } catch {
    /* storage full / blocked */
  }
}

/** Account cart order, keeping this device's richer product data where lines match. */
function adoptServer(server: ServerCartLine[], local: CartItem[]): CartItem[] {
  const byKey = new Map(local.map((i) => [cartLineKey(i.product), i]));
  return server.map((l) => {
    const mine = byKey.get(l.lineKey as string);
    return mine ? { product: mine.product, quantity: l.quantity } : serverLineToCartItem(l);
  });
}

/** Both sides changed (or first login on this device): keep every line, larger quantity wins. */
function mergeCarts(server: ServerCartLine[], local: CartItem[]): CartItem[] {
  const byKey = new Map(local.map((i) => [cartLineKey(i.product), i]));
  const merged = server.map((l) => {
    const mine = byKey.get(l.lineKey as string);
    return mine
      ? { product: mine.product, quantity: Math.max(mine.quantity, l.quantity) }
      : serverLineToCartItem(l);
  });
  const serverKeys = new Set(server.map((l) => l.lineKey));
  return [...merged, ...local.filter((i) => !serverKeys.has(cartLineKey(i.product)))];
}

/** CartSync is mounted once (root layout), so sync state lives at module level. */
let pulling = false;
let pendingPush = false;
let lastPullAt = 0;

/**
 * Three-way sync of the account cart (S), this device's cart (L) and the last
 * state both agreed on (B). Calls `onReady(token)` once pushing is safe.
 */
async function pullAccountCart(force: boolean, onReady: (token: string) => void) {
  const { token: t, user } = useCustomerAuth.getState();
  if (!t || pulling || pendingPush) return;
  if (!useCart.persist.hasHydrated()) return;
  if (!user?.id) {
    // Older session without a cached profile: keep the previous push-only behaviour.
    onReady(t);
    return;
  }
  const now = Date.now();
  if (!force && now - lastPullAt < 10_000) return;
  lastPullAt = now;
  pulling = true;
  try {
    const server = await fetchServerCart(t);
    if (useCustomerAuth.getState().token !== t || pendingPush) return;
    const local = useCart.getState().items;
    const S = serverLines(server);
    const L = itemLines(local);
    const B = readBase(user.id);

    if (sameLines(S, L)) {
      writeBase(user.id, S);
      markCartSynced(local);
    } else if (B && sameLines(S, B)) {
      // Only this device changed; the push effect sends it.
    } else if (B && sameLines(L, B)) {
      const next = adoptServer(server, local);
      useCart.getState().applyCatalogRefresh(next);
      writeBase(user.id, S);
      markCartSynced(next);
      void refreshCartFromCatalog();
    } else {
      useCart.getState().applyCatalogRefresh(mergeCarts(server, local));
      void refreshCartFromCatalog();
    }
    onReady(t);
  } catch {
    // Account cart unreachable: fall back to pushing this device's cart.
    if (useCustomerAuth.getState().token === t) onReady(t);
  } finally {
    pulling = false;
    // Signed in as someone else while this pull ran — pull for the new session.
    if (useCustomerAuth.getState().token !== t) void pullAccountCart(true, onReady);
  }
}

/**
 * 1) Refresh cart line prices/stock from live catalog (fixes stale localStorage prices).
 * 2) Keep a logged-in shopper's cart in sync with their account cart, both ways:
 *    changes from another device or an admin ("login as customer") are pulled in
 *    on load, focus and cart open; local changes are pushed after a short debounce.
 */
export function CartSync() {
  const token = useCustomerAuth((s) => s.token);
  const items = useCart((s) => s.items);
  const isOpen = useCart((s) => s.isOpen);
  const checkoutOpen = useCart((s) => s.checkoutOpen);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRefreshAt = useRef(0);
  /** Pushing is held until the account cart has been pulled for this token. */
  const [pulledToken, setPulledToken] = useState<string | null>(null);
  const pull = useCallback(
    (force = false) => void pullAccountCart(force, setPulledToken),
    [],
  );

  useEffect(() => {
    let cancelled = false;

    const runRefresh = () => {
      if (cancelled) return;
      const now = Date.now();
      // Avoid hammering the API on rapid open/close
      if (now - lastRefreshAt.current < 1500) return;
      lastRefreshAt.current = now;
      void refreshCartFromCatalog();
      void pull();
    };

    const onHydrated = () => {
      runRefresh();
      void pull(true);
    };
    const unsubHydrate = useCart.persist.onFinishHydration(onHydrated);
    if (useCart.persist.hasHydrated()) onHydrated();

    function onFocus() {
      runRefresh();
    }
    function onVisibility() {
      if (document.visibilityState === "visible") runRefresh();
    }

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      unsubHydrate();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pull]);

  // Login / account switch: pull the account cart before anything is pushed.
  useEffect(() => {
    if (token) void pull(true);
  }, [token, pull]);

  // When cart or checkout opens, re-pull live prices and the account cart
  useEffect(() => {
    if (!isOpen && !checkoutOpen) return;
    void refreshCartFromCatalog();
    void pull();
  }, [isOpen, checkoutOpen, pull]);

  useEffect(() => {
    if (!token || pulledToken !== token) return;

    const payload = syncPayload(items);
    const serialized = JSON.stringify(payload);
    if (serialized === lastPayload) return;

    pendingPush = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      lastPayload = serialized;
      api("/cart", {
        method: "PUT",
        token,
        body: payload,
      })
        .then(() => {
          const userId = useCustomerAuth.getState().user?.id;
          if (userId) {
            writeBase(
              userId,
              Object.fromEntries(payload.items.map((i) => [i.lineKey, i.quantity])),
            );
          }
        })
        .catch(() => {
          // Allow retry on next change
          lastPayload = "";
        })
        .finally(() => {
          pendingPush = false;
        });
    }, 600);

    return () => {
      if (timer.current) clearTimeout(timer.current);
      pendingPush = false;
    };
  }, [token, items, pulledToken]);

  return null;
}
