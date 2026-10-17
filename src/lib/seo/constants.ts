/** Storefront origin used when NEXT_PUBLIC_SITE_URL is not configured. */
export const DEFAULT_SITE_URL = "https://anantafashion.com";

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL
).replace(/\/$/, "");

export const SEO_API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3003/api/v1"
)
  .replace(/\/$/, "")
  .replace("://localhost:", "://127.0.0.1:");

/** Preferred site name for Google (WebSite.name, og:site_name) — the bare brand. */
export const SITE_NAME = process.env.NEXT_PUBLIC_BRAND || "Ananta Fashion";

/** Real variants people search for; Google uses these when the preferred name is unavailable. */
export function siteAlternateNames(name: string = SITE_NAME): string[] {
  const host = new URL(SITE_URL).hostname.replace(/^www\./, "");
  return [
    ...new Set([`${name} Store`, name.replace(/\s+/g, ""), host]),
  ].filter((n) => n && n !== name);
}

/**
 * Fallback share image when a page has no collection/product OG image.
 * Absolute HTTPS URL is required for WhatsApp / Facebook / Telegram previews.
 * Prefer a real product or collection photo over this when available.
 */
export const DEFAULT_OG_IMAGE = `${SITE_URL}/android-icon-512x512.png`;

export const ENTITY = {
  organization: `${SITE_URL}/#organization`,
  website: `${SITE_URL}/#website`,
  webpage: (url: string) => `${url}#webpage`,
  product: (url: string) => `${url}#product`,
  article: (url: string) => `${url}#article`,
  faq: (url: string) => `${url}#faq`,
  howto: (url: string) => `${url}#howto`,
  breadcrumb: (url: string) => `${url}#breadcrumb`,
} as const;

export const SEO_REVALIDATE = {
  product: 120,
  collection: 120,
  article: 300,
  sitemap: 300,
  settings: 120,
  faq: 120,
} as const;

export const SITEMAP_PRODUCT_PAGE_SIZE = 10_000;
