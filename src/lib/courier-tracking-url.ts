/** Client-side mirror of api/src/common/courier-tracking-url.ts */
export function guessCourierTrackingUrl(
  carrier: string | null | undefined,
  awb: string,
): string | null {
  const c = String(carrier || "")
    .toLowerCase()
    .trim();
  const n = String(awb || "").trim();
  if (!n) return null;

  if (/maruti/.test(c)) {
    return `https://shreemaruti.com/track-shipment/?awb=${encodeURIComponent(n)}`;
  }
  if (/delhivery/.test(c)) {
    return `https://www.delhivery.com/track/package/${encodeURIComponent(n)}`;
  }
  if (/bluedart|blue\s*dart/.test(c)) {
    return `https://www.bluedart.com/web/guest/trackdartresultthirdparty?trackFor=0&trackNo=${encodeURIComponent(n)}`;
  }
  if (/dtdc/.test(c)) {
    return `https://www.dtdc.in/tracking.asp?strCnno=${encodeURIComponent(n)}`;
  }
  if (/xpressbees|xpress\s*bees/.test(c)) {
    return `https://www.xpressbees.com/track/${encodeURIComponent(n)}`;
  }
  if (/ekart/.test(c)) {
    return `https://ekartlogistics.com/shipment/track/${encodeURIComponent(n)}`;
  }
  if (/shadowfax/.test(c)) {
    return `https://tracker.shadowfax.in/#/tracking/${encodeURIComponent(n)}`;
  }
  if (/ecom\s*express/.test(c)) {
    return `https://ecomexpress.in/tracking/?awb_field=${encodeURIComponent(n)}`;
  }
  return null;
}

export function resolveCourierTrackingUrl(
  carrier: string | null | undefined,
  awb: string,
  existingUrl?: string | null,
): string | null {
  const custom = String(existingUrl || "").trim();
  if (custom) return custom;
  return guessCourierTrackingUrl(carrier, awb);
}
