declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

export function gaMeasurementId(): string {
  return (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "").trim();
}

function gtag(...args: unknown[]) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") {
    return;
  }
  window.gtag(...args);
}

/** SPA / App Router page views after the initial config PageView. */
export function gaPageView(url: string) {
  const id = gaMeasurementId();
  if (!id) return;
  gtag("config", id, { page_path: url });
}

export function gaEvent(
  eventName: string,
  params?: Record<string, unknown>,
) {
  gtag("event", eventName, params);
}
