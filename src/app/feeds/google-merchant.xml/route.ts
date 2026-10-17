import { SEO_API_URL } from "@/lib/seo";

export const revalidate = 1800;

/**
 * Google Merchant Center scheduled-fetch URL:
 * https://anantafashion.com/feeds/google-merchant.xml
 *
 * Images are original CDN/upload URLs (not /_next/image) so Googlebot-Image
 * is not blocked by storefront robots query rules.
 */
export async function GET() {
  const res = await fetch(`${SEO_API_URL}/feeds/google-merchant.xml`, {
    next: { revalidate: 1800 },
    headers: { Accept: "application/xml, text/xml, */*" },
  });

  if (!res.ok) {
    return new Response("Merchant feed unavailable", {
      status: 502,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const xml = await res.text();
  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=1800",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
