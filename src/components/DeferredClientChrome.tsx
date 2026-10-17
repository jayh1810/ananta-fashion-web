"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";

const PromoPopup = dynamic(
  () => import("@/components/PromoPopup").then((m) => m.PromoPopup),
  { ssr: false },
);

const ImpersonationExpiry = dynamic(
  () =>
    import("@/components/ImpersonationExpiry").then(
      (m) => m.ImpersonationExpiry,
    ),
  { ssr: false },
);

/** Client-only chrome — dynamic imports with ssr:false cannot live in Server Components. */
export function DeferredClientChrome() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => void reg.unregister());
    });
    if ("caches" in window) {
      caches.keys().then((keys) => {
        keys.forEach((key) => void caches.delete(key));
      });
    }
  }, []);

  return (
    <>
      <PromoPopup />
      <ImpersonationExpiry />
    </>
  );
}
