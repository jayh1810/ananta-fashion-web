"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";

/** /checkout redirects into the checkout modal */
export default function CheckoutPage() {
  const router = useRouter();
  const { items, openCheckout, openCart } = useCart();

  useEffect(() => {
    if (items.length > 0) {
      openCheckout();
    } else {
      openCart();
    }
    router.replace("/");
  }, [items.length, openCheckout, openCart, router]);

  return (
    <div className="min-h-[40vh] grid place-items-center text-[#777] text-sm">
      Opening checkout…
    </div>
  );
}
