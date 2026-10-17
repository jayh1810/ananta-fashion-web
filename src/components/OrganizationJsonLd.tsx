import { getCachedSettings } from "@/lib/settings";
import {
  DEFAULT_OG_IMAGE,
  ENTITY,
  fetchSeoEntry,
  SITE_URL,
  siteAlternateNames,
  toAbsoluteImageUrl,
} from "@/lib/seo";

function profileUrls(urls: (string | undefined)[]): string[] {
  const out = new Set<string>();
  for (const raw of urls) {
    const u = String(raw || "").trim();
    if (!/^https:\/\/[^\s]+\.[^\s]+$/i.test(u)) continue;
    if (u.startsWith(SITE_URL)) continue;
    out.add(u);
  }
  return [...out];
}

/**
 * Organization (OnlineStore) + WebSite JSON-LD only (site-wide).
 * WebSite.name / alternateName drive the site name Google shows above the result;
 * keep them identical to og:site_name and the brand used in titles.
 * Do NOT emit a homepage WebPage here — attaching `${SITE_URL}/#webpage` on
 * every route confuses Google’s entity graph on product/collection URLs.
 */
export async function OrganizationJsonLd() {
  const [s, homeSeo] = await Promise.all([
    getCachedSettings(),
    fetchSeoEntry("/"),
  ]);
  const name = s.siteName;
  const alternateName = siteAlternateNames(name);
  const description =
    homeSeo?.description?.trim() ||
    `Shop fashion, beauty and lifestyle products from top brands at ${name}, with pan-India delivery.`;
  const email = s.store.email?.trim();
  const telephone = s.store.phone?.trim();
  const sameAs = profileUrls([
    s.store.socialInstagram,
    s.store.socialFacebook,
    ...(s.store.brandProfiles || []),
  ]);

  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "OnlineStore",
        "@id": ENTITY.organization,
        name,
        alternateName,
        url: SITE_URL,
        logo: toAbsoluteImageUrl(s.logoUrl) || DEFAULT_OG_IMAGE,
        description,
        ...(email ? { email } : {}),
        ...(telephone ? { telephone } : {}),
        ...(sameAs.length ? { sameAs } : {}),
        areaServed: {
          "@type": "Country",
          name: "India",
        },
        ...(email || telephone
          ? {
              contactPoint: {
                "@type": "ContactPoint",
                contactType: "customer service",
                ...(email ? { email } : {}),
                ...(telephone ? { telephone } : {}),
                availableLanguage: ["English", "Hindi"],
                areaServed: "IN",
              },
            }
          : {}),
      },
      {
        "@type": "WebSite",
        "@id": ENTITY.website,
        url: SITE_URL,
        name,
        alternateName,
        description,
        inLanguage: "en-IN",
        publisher: { "@id": ENTITY.organization },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
