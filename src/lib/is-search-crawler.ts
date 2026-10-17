/**
 * Detect search-engine crawlers in the browser (client components only).
 * Used to skip optional marketing/analytics XHR that are intentionally blocked
 * on api.anantafashion.com robots.txt — not required for SSR or indexing.
 */
const SEARCH_CRAWLER_UA =
  /googlebot|google-inspectiontool|storebot-google|bingbot|slurp|duckduckbot|baiduspider|yandexbot|applebot|petalbot|bytespider|semrushbot|ahrefsbot|mj12bot|dotbot|rogerbot|linkedinbot|twitterbot|facebookexternalhit/i;

export function isLikelySearchCrawler(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return SEARCH_CRAWLER_UA.test(ua);
}
