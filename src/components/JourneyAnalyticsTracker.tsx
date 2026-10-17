"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  trackPageDwell,
  trackPageView,
  setAnalyticsUserId,
} from "@/lib/analytics";
import { useCustomerAuth } from "@/lib/customer-auth";

/**
 * Records page views + dwell time for the admin User Journey timeline.
 * Must never affect checkout/cart UX.
 */
export function JourneyAnalyticsTracker() {
  const pathname = usePathname();
  const userId = useCustomerAuth((s) => s.user?.id);
  const enteredAt = useRef<number>(Date.now());
  const pathRef = useRef<string>(pathname || "/");

  useEffect(() => {
    setAnalyticsUserId(userId || null);
  }, [userId]);

  useEffect(() => {
    const prevPath = pathRef.current;
    const prevEntered = enteredAt.current;
    const spent = Date.now() - prevEntered;
    if (prevPath) {
      try {
        trackPageDwell({ path: prevPath, durationMs: spent });
      } catch {
        /* ignore */
      }
    }
    pathRef.current = pathname || "/";
    enteredAt.current = Date.now();
    try {
      trackPageView(pathname || "/");
    } catch {
      /* ignore */
    }
  }, [pathname]);

  useEffect(() => {
    const flush = () => {
      try {
        trackPageDwell({
          path: pathRef.current,
          durationMs: Date.now() - enteredAt.current,
        });
      } catch {
        /* ignore */
      }
      enteredAt.current = Date.now();
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") flush();
      else enteredAt.current = Date.now();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return null;
}
