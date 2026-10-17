import type { MetadataRoute } from "next";
import { DEFAULT_SITE_URL, SITE_URL } from "@/lib/seo";

/**
 * robots.txt strategy (storefront)
 * ------------------------------------------------------
 * Public SEO pages are server-rendered; Googlebot gets HTML + JSON-LD from this
 * host. Private commerce, auth, and faceted URLs stay blocked.
 * API host rules: api/src/robots/robots-txt.ts
 *
 * Next.js Image always serves `/_next/image?url=...&w=...&q=75` (`q` = quality).
 * Never use `Disallow: /*?*q=` — Google treats that as “any URL whose query
 * contains q=”, which blocks every optimized product/category image.
 * Search is already blocked via `/search` plus `/*?q=` (q as the first param).
 *
 * `/_next/image` and `/_next/static` MUST stay Allow (Google needs them to
 * render product pages). They are not indexable documents — X-Robots-Tag
 * noindex is set in next.config.ts so GSC “Other error” on those URLs drops.
 */
export default function robots(): MetadataRoute.Robots {
  const base = SITE_URL.replace(/\/$/, "") || DEFAULT_SITE_URL;

  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/products/",
          "/collections/",
          "/blogs/",
          "/pages/",
          "/policies/",
          "/llms.txt",
          "/llm.txt",
          "/llms-full.txt",
          "/llms-products.txt",
          "/llms/",
          "/_next/image",
          "/_next/static",
          "/share-image",
          "/og/",
          "/feeds/",
        ],
        disallow: [
          // Next.js API routes & BFF proxies
          "/api/",

          // Account / auth (storefront + future aliases)
          "/account",
          "/account/",
          "/login",
          "/register",
          "/forgot-password",
          "/reset-password",
          "/account-deletion",

          // Cart & checkout (noindex already on layouts; reinforce in robots)
          "/cart",
          "/checkout",
          "/wishlist",
          "/*/checkout",

          // Search & faceted / filtered URLs (duplicate or thin SERP risk)
          "/search",
          "/*?q=",
          "/*?*sort=",
          "/*?*filter=",
          "/*?*page=",
          "/*?*price=",
          "/*?*min_price=",
          "/*?*max_price=",
          "/*?*brand=",
          "/*?*color=",
          "/*?*size=",
          "/*?*availability=",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
