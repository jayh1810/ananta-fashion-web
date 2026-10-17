/** Branded shipment tracking site (set NEXT_PUBLIC_TRACKING_URL in production). */
export const TRACKING_SITE = (
  process.env.NEXT_PUBLIC_TRACKING_URL || "https://track.anantafashion.com"
).replace(/\/$/, "");

/** `/tracking/{ref}` accepts an AWB or an order number. */
export function trackingPageUrl(ref: string | null | undefined): string | null {
  const r = String(ref || "").trim();
  return r ? `${TRACKING_SITE}/tracking/${encodeURIComponent(r)}` : null;
}
