"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { gaMeasurementId, gaPageView } from "@/lib/google-analytics";

function GoogleAnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const qs = searchParams?.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;
    gaPageView(url);
  }, [pathname, searchParams]);

  return null;
}

export function GoogleAnalytics() {
  const id = gaMeasurementId();
  if (!id) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="lazyOnload"
      />
      <Script
        id="google-analytics-init"
        strategy="lazyOnload"
        dangerouslySetInnerHTML={{
          __html: `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${id}');
          `.trim(),
        }}
      />
      <GoogleAnalyticsTracker />
    </>
  );
}
