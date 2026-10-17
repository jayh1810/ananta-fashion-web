"use client";

import { useEffect } from "react";
import { api, type Product } from "@/lib/api";
import { useCustomerAuth } from "@/lib/customer-auth";
import { useWishlist } from "@/lib/wishlist";

let syncing = false;
let lastSyncAt = 0;

/**
 * Signed-in shoppers: the first sync on a device merges the guest wishlist into
 * the account; later syncs adopt the account list (changes are pushed as they
 * happen). Guests keep the device-only list.
 */
async function syncWishlist(force: boolean) {
  const { token, user } = useCustomerAuth.getState();
  if (!token || !user?.id || syncing) return;
  if (!useWishlist.persist.hasHydrated()) return;
  const now = Date.now();
  if (!force && now - lastSyncAt < 30_000) return;
  lastSyncAt = now;
  syncing = true;
  try {
    const state = useWishlist.getState();
    const firstForUser = state.syncedUserId !== user.id;
    const res =
      firstForUser || state.dirty
        ? await api<{ data: Product[] }>("/wishlist/merge", {
            method: "POST",
            token,
            body: {
              productIds: (firstForUser && state.syncedUserId ? [] : state.items).map(
                (i) => i.id,
              ),
            },
          })
        : await api<{ data: Product[] }>("/wishlist", { token });
    if (useCustomerAuth.getState().token !== token) return;
    useWishlist.getState().replaceFromServer(res.data || [], user.id);
  } catch {
    /* offline / API down: keep the device list */
  } finally {
    syncing = false;
  }
}

export function WishlistSync() {
  const token = useCustomerAuth((s) => s.token);
  const userId = useCustomerAuth((s) => s.user?.id ?? null);

  useEffect(() => {
    if (token && userId) {
      void syncWishlist(true);
      return;
    }
    if (!token && useCustomerAuth.persist.hasHydrated() && useWishlist.getState().syncedUserId) {
      useWishlist.getState().resetAccount();
    }
  }, [token, userId]);

  useEffect(() => {
    const onFocus = () => void syncWishlist(false);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  return null;
}
