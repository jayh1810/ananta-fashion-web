import { SITE_URL } from "./constants";

const TRACKING = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "msclkid",
  "srsltid",
  "ref",
  "ref_id",
]);

const FACET = new Set([
  "q",
  "sort",
  "filter",
  "page",
  "price",
  "min_price",
  "max_price",
  "brand",
  "color",
  "size",
  "availability",
  "tag",
  "category",
]);

/** Production canonical: HTTPS host, no tracking/facet query, no trailing slash except home. */
export function canonicalUrl(pathOrUrl: string): string {
  let path = pathOrUrl.trim() || "/";
  try {
    if (/^https?:\/\//i.test(path)) {
      const u = new URL(path);
      path = `${u.pathname}${u.search}`;
    }
  } catch {
    /* keep path */
  }
  const [rawPath, rawQuery] = path.split("?");
  let clean = (rawPath || "/").split("#")[0] || "/";
  if (clean.length > 1) clean = clean.replace(/\/+$/, "");
  if (!clean.startsWith("/")) clean = `/${clean}`;

  if (rawQuery) {
    const params = new URLSearchParams(rawQuery);
    for (const key of [...params.keys()]) {
      if (TRACKING.has(key) || FACET.has(key)) params.delete(key);
    }
    const kept = params.toString();
    if (kept) clean = `${clean}?${kept}`;
  }

  if (clean === "/") return SITE_URL;
  return `${SITE_URL}${clean}`;
}

export function absoluteUrl(path: string) {
  return canonicalUrl(path);
}

export function toAbsoluteImageUrl(
  url: string | null | undefined,
): string | undefined {
  const u = String(url || "").trim();
  if (!u) return undefined;
  if (/^https?:\/\//i.test(u)) return u.replace(/^http:\/\//i, "https://");
  if (u.startsWith("//")) return `https:${u}`;
  if (u.startsWith("/")) return `${SITE_URL}${u}`;
  return undefined;
}

export function productPath(slug: string) {
  return `/products/${slug}`;
}

export function collectionPath(slug: string) {
  return `/collections/${slug}`;
}

export function articlePath(slug: string) {
  return `/blogs/${slug}`;
}
