"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackSearch, trackStoreVisitOnce } from "@/lib/analytics";
import { trackSearch as pixelTrackSearch } from "@/lib/meta-pixel";

/** Global store visit + search query tracking. */
export function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    trackStoreVisitOnce();
  }, []);

  useEffect(() => {
    if (pathname === "/search") {
      const q = searchParams.get("q") || "";
      if (q.trim()) {
        trackSearch(q);
        try { pixelTrackSearch({ search_string: q }); } catch {}
      }
    }
  }, [pathname, searchParams]);

  return null;
}
