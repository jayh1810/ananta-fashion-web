import {
  SITE_URL,
  SITE_NAME,
  ENTITY,
  siteAlternateNames,
} from "../seo/constants";
import { canonicalUrl, toAbsoluteImageUrl } from "../seo/canonical";

export type JsonLd = Record<string, unknown>;
export type BreadcrumbItem = { name: string; href: string };

export function generateBreadcrumbSchema(items: BreadcrumbItem[]): JsonLd {
  const first = items[0]?.href || "/";
  const pageUrl = canonicalUrl(
    items[items.length - 1]?.href || first,
  );
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "@id": ENTITY.breadcrumb(pageUrl),
    itemListElement: items.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: canonicalUrl(c.href),
    })),
  };
}

export function generateWebPageSchema(opts: {
  url: string;
  name: string;
  description: string;
  type?: "WebPage" | "CollectionPage" | "AboutPage" | "ContactPage";
  /** CSS selectors for SpeakableSpecification (AEO / voice / AI Overviews). */
  speakable?: string[];
}): JsonLd {
  const url = canonicalUrl(opts.url);
  const node: JsonLd = {
    "@context": "https://schema.org",
    "@type": opts.type || "WebPage",
    "@id": ENTITY.webpage(url),
    url,
    name: opts.name,
    description: opts.description,
    isPartOf: { "@id": ENTITY.website },
    about: { "@id": ENTITY.organization },
    inLanguage: "en-IN",
  };
  if (opts.speakable?.length) {
    node.speakable = {
      "@type": "SpeakableSpecification",
      cssSelector: opts.speakable,
    };
  }
  return node;
}

function howToSteps(plain: string): string[] {
  const numbered = [
    ...plain.matchAll(
      // No `s` (dotAll) — tsconfig target is ES2017; list items are line-based anyway.
      /(?:^|\n)\s*(?:\d+[.)]|[-•*])\s+(.+?)(?=(?:\n\s*(?:\d+[.)]|[-•*])\s+)|$)/g,
    ),
  ]
    .map((m) => m[1].replace(/\s+/g, " ").trim())
    .filter((s) => s.length >= 12);
  if (numbered.length >= 2) return numbered.slice(0, 8);

  const lines = plain
    .split(/\n+/)
    .map((l) => l.replace(/^[-•*\d.)\s]+/, "").trim())
    .filter((l) => l.length >= 12);
  if (lines.length >= 2) return lines.slice(0, 8);
  return plain.length >= 20 ? [plain] : [];
}

/** HowTo JSON-LD from product how-to-wear copy. Null when text is too thin. */
export function generateHowToSchema(opts: {
  url: string;
  name: string;
  text: string;
}): JsonLd | null {
  const plain = opts.text
    .replace(/<[^>]+>/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
  const steps = howToSteps(plain);
  if (!steps.length) return null;
  const url = canonicalUrl(opts.url);
  const description = plain.replace(/\s+/g, " ").slice(0, 300);
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "@id": ENTITY.howto(url),
    name: opts.name,
    description,
    mainEntityOfPage: { "@id": ENTITY.webpage(url) },
    step: steps.map((text, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      text,
    })),
  };
}

export function generateWebsiteSchema(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": ENTITY.website,
    url: SITE_URL,
    name: SITE_NAME,
    alternateName: siteAlternateNames(),
    publisher: { "@id": ENTITY.organization },
    inLanguage: "en-IN",
  };
}

export function generateOrganizationSchema(opts?: {
  name?: string;
  sameAs?: string[];
  logo?: string | null;
}): JsonLd {
  const node: JsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ENTITY.organization,
    name: opts?.name || SITE_NAME,
    url: SITE_URL,
  };
  const logo = toAbsoluteImageUrl(opts?.logo);
  if (logo) node.logo = logo;
  if (opts?.sameAs?.length) node.sameAs = opts.sameAs;
  return node;
}

export function generateFAQSchema(
  faqs: { question: string; answer: string }[],
  pageUrl?: string,
): JsonLd | null {
  if (!faqs.length) return null;
  const url = pageUrl ? canonicalUrl(pageUrl) : undefined;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    ...(url ? { "@id": ENTITY.faq(url) } : {}),
    mainEntity: faqs.slice(0, 20).map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

export function generateArticleSchema(opts: {
  url: string;
  headline: string;
  description: string;
  image?: string | null;
  authorName: string;
  datePublished?: string | null;
  dateModified?: string | null;
  keywords?: string[];
}): JsonLd {
  const url = canonicalUrl(opts.url);
  const absImage = toAbsoluteImageUrl(opts.image);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": ENTITY.article(url),
    headline: opts.headline,
    description: opts.description,
    mainEntityOfPage: { "@type": "WebPage", "@id": ENTITY.webpage(url) },
    author: { "@type": "Person", name: opts.authorName },
    publisher: { "@id": ENTITY.organization },
    datePublished: opts.datePublished || undefined,
    dateModified: opts.dateModified || opts.datePublished || undefined,
    ...(absImage ? { image: absImage } : {}),
    ...(opts.keywords?.length ? { keywords: opts.keywords.join(", ") } : {}),
  };
}

export function generateCollectionSchema(opts: {
  url: string;
  name: string;
  description: string;
  productUrls: string[];
}): JsonLd {
  const url = canonicalUrl(opts.url);
  const itemList =
    opts.productUrls.length > 0
      ? {
          "@type": "ItemList",
          numberOfItems: opts.productUrls.length,
          itemListElement: opts.productUrls.slice(0, 24).map((p, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: canonicalUrl(p),
          })),
        }
      : undefined;
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": ENTITY.webpage(url),
    url,
    name: opts.name,
    description: opts.description.slice(0, 300),
    isPartOf: { "@id": ENTITY.website },
    about: { "@id": ENTITY.organization },
    inLanguage: "en-IN",
    ...(itemList ? { mainEntity: itemList } : {}),
  };
}

export const buildBreadcrumbJsonLd = generateBreadcrumbSchema;
export const buildWebPageJsonLd = generateWebPageSchema;
export const buildFaqJsonLd = generateFAQSchema;
export const buildHowToJsonLd = generateHowToSchema;
export const buildArticleJsonLd = generateArticleSchema;
export const buildCollectionJsonLd = generateCollectionSchema;

export {
  generateProductSchema,
  generateOfferSchema,
  generateReviewSchema,
  generateAggregateRatingSchema,
  storefrontPrice,
  productCanonicalUrl,
  toAbsoluteImage,
  buildProductJsonLd,
} from "./product";
