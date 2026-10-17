"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ShieldAlert } from "lucide-react";
import { api } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { refreshCartFromCatalog } from "@/lib/cart-refresh";
import { loadServerCart } from "@/lib/server-cart";
import { markCartSynced } from "@/components/CartSync";
import {
  readImpersonation,
  useCustomerAuth,
  type CustomerUser,
} from "@/lib/customer-auth";

/**
 * Landing page for the admin "Login as customer" link. The token arrives in the
 * URL fragment (never sent to servers or referrers) and is removed immediately.
 */
export default function ImpersonatePage() {
  const router = useRouter();
  const tokenRef = useRef<string | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tokenRef.current === undefined) {
      tokenRef.current =
        new URLSearchParams(window.location.hash.slice(1)).get("token") || null;
      window.history.replaceState(null, "", window.location.pathname);
    }
    const token = tokenRef.current;
    let cancelled = false;

    (async () => {
      if (!token || !readImpersonation(token)) {
        throw new Error("This sign-in link is invalid. Start again from the admin panel.");
      }
      const [user, savedItems] = await Promise.all([
        api<CustomerUser>("/auth/me", { token }),
        loadServerCart(token),
      ]);
      if (cancelled) return;
      // Sign out any existing store session first so its CartSync can't receive this cart.
      useCustomerAuth.getState().logout();
      const cart = useCart.getState();
      cart.closeCart();
      cart.closeCheckout();
      cart.clear();
      // Let any in-flight price refresh of the old cart finish before replacing it.
      await refreshCartFromCatalog();
      if (cancelled) return;
      useCart.getState().applyCatalogRefresh(savedItems);
      await refreshCartFromCatalog();
      if (cancelled) return;
      // Session goes live only now, so CartSync starts from the customer's real cart.
      markCartSynced(useCart.getState().items);
      useCustomerAuth.getState().setSession(token, user);
      router.replace("/account");
    })().catch((e: unknown) => {
      if (cancelled) return;
      const message = e instanceof Error ? e.message : "";
      setError(
        message.startsWith("This sign-in link")
          ? message
          : "This sign-in link has expired. Start again from the admin panel.",
      );
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="min-h-[60vh] bg-[#F4F1EA] grid place-items-center px-4 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-[#E7DFD2] bg-white p-7 text-center shadow-[0_8px_30px_rgba(28,20,16,0.06)]">
        {error ? (
          <>
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-50 text-red-600">
              <ShieldAlert className="h-6 w-6" />
            </span>
            <h1 className="mt-4 text-lg font-bold text-[#1C1410]">Couldn&apos;t sign in</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-[#6B5E52]">{error}</p>
            <Link
              href="/"
              className="mt-5 inline-flex rounded-xl bg-[#1C1410] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Go to store
            </Link>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-[var(--bhagva)]" />
            <h1 className="mt-4 text-lg font-bold text-[#1C1410]">Signing in as customer…</h1>
            <p className="mt-1.5 text-sm text-[#6B5E52]">Opening their account. This takes a second.</p>
          </>
        )}
      </div>
    </div>
  );
}
