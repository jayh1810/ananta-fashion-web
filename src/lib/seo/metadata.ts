import type { Metadata } from "next";
import type { Product } from "../api";
import { BRAND } from "../api";
import { DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL } from "./constants";
import { canonicalUrl, toAbsoluteImageUrl } from "./canonical";
import { shortPlainText } from "./html";
import { getCachedSeoEntry, type SeoEntry } from "./data";
import { buildShareOgPath } from "./share-image-url";

export type PageMetadataInput = {
  title: string;
  description: string;
  image?: string | null;
  noIndex?: boolean;
  ogType?: "website" | "article";
  publishedTime?: string | null;
  modifiedTime?: string | null;
  authors?: string[];
  keywords?: string[];
};

/** CDN / remote hosts that need compression + same-domain JPEG for chat previews. */
const SHARE_PROXY_HOSTS = new Set([
  "sin1.contabostorage.com",
  "eu2.contabostorage.com",
  "usc1.contabostorage.com",
  "cdn.shopify.com",
]);

/**
 * Same-domain /og/<token>.jpg — WhatsApp & Google Chat drop huge Contabo PNGs
 * and often fail on long ?query OG image URLs.
 */
export function toShareFriendlyOgUrl(absoluteUrl: string): string {
  try {
    const u = new URL(absoluteUrl);
    if (
      u.pathname === "/share-image" ||
      u.pathname.startsWith("/share-image/") ||
      u.pathname.startsWith("/og/")
    ) {
      return absoluteUrl;
    }
    const host = u.hostname.toLowerCase();
    let siteHost = "";
    try {
      siteHost = new URL(SITE_URL).hostname.toLowerCase();
    } catch {
      /* ignore */
    }
    // Proxy remote CDNs and local brand icons (512px) into 1200×630 JPEG.
    if (SHARE_PROXY_HOSTS.has(host) || host === siteHost) {
      return `${SITE_URL}${buildShareOgPath(absoluteUrl)}`;
    }
    return absoluteUrl;
  } catch {
    return absoluteUrl;
  }
}

/** Absolute OG image URL — page image, else site default (WhatsApp needs this). */
export function resolveOgImage(
  ...candidates: Array<string | null | undefined>
): string {
  for (const c of candidates) {
    const abs = toAbsoluteImageUrl(c);
    if (abs) return toShareFriendlyOgUrl(abs);
  }
  return toShareFriendlyOgUrl(DEFAULT_OG_IMAGE);
}

function ogImageMeta(url: string, alt: string) {
  return {
    url,
    secureUrl: url,
    type: "image/jpeg",
    width: 1200,
    height: 630,
    alt,
  } as const;
}

export function generatePageMetadata(
  path: string,
  input: PageMetadataInput,
  entry?: SeoEntry | null,
): Metadata {
  const title = entry?.title?.trim() || input.title;
  const description = entry?.description?.trim() || input.description;
  const image = resolveOgImage(entry?.ogImage, input.image);
  const noIndex = entry?.noIndex ?? input.noIndex ?? false;
  const url = canonicalUrl(path);
  const ogType = input.ogType || "website";
  const keywords = entry?.keywords?.trim()
    ? entry.keywords.split(",").map((k) => k.trim()).filter(Boolean)
    : input.keywords || [];

  return {
    title,
    description,
    ...(keywords.length ? { keywords } : {}),
    alternates: { canonical: url },
    openGraph: {
      type: ogType,
      url,
      title,
      description,
      siteName: SITE_NAME,
      locale: "en_IN",
      images: [ogImageMeta(image, title)],
      ...(ogType === "article"
        ? {
            publishedTime: input.publishedTime || undefined,
            modifiedTime: input.modifiedTime || undefined,
            authors: input.authors,
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
    robots: noIndex
      ? { index: false, follow: true }
      : { index: true, follow: true },
  };
}

export async function metadataForPath(
  path: string,
  input: PageMetadataInput,
): Promise<Metadata> {
  const entry = await getCachedSeoEntry(path);
  return generatePageMetadata(path, input, entry);
}

export function productSeoDescription(product: Product): string {
  const fromApi = product.seo?.description?.trim();
  if (fromApi) return fromApi;
  const text = shortPlainText(
    product.metaDescription ||
      product.shortDescription ||
      product.description ||
      "",
    160,
  );
  if (text) return text;
  return `Buy ${product.title} online at ${BRAND}. Genuine products with shipping across India.`;
}

export async function generateProductMetadata(
  slug: string,
  product: Product | null,
): Promise<Metadata> {
  const path = `/products/${slug}`;
  if (!product) {
    return {
      title: "Product",
      robots: { index: false, follow: false },
    };
  }
  const images = [product.image, ...(product.images || [])]
    .map((u) => toAbsoluteImageUrl(u))
    .filter(Boolean) as string[];
  const entry = await getCachedSeoEntry(path);
  const seo = product.seo;
  const pageTitle =
    product.metaTitle?.trim() ||
    seo?.title?.trim() ||
    product.title;
  const ogTitle =
    product.metaTitle?.trim() ||
    seo?.ogTitle?.trim() ||
    `${pageTitle} | ${BRAND}`;
  const description = productSeoDescription(product);
  const ogImage = resolveOgImage(seo?.ogImage, images[0]);
  const keywords = uniqueKeywords(
    product.highlightTags,
    seo?.searchTerms,
    entry?.keywords,
  );
  const canonical = canonicalUrl(seo?.canonicalPath || path);
  const noIndex =
    entry?.noIndex === true ||
    product.seo?.indexable === false;

  return {
    title: { absolute: ogTitle },
    description,
    ...(keywords.length ? { keywords } : {}),
    alternates: { canonical },
    openGraph: {
      type: "website",
      url: canonical,
      title: ogTitle,
      description: seo?.ogDescription || description,
      siteName: SITE_NAME,
      locale: "en_IN",
      images: [ogImageMeta(ogImage, ogTitle)],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: seo?.ogDescription || description,
      images: [ogImage],
    },
    robots: noIndex
      ? { index: false, follow: true }
      : { index: true, follow: true },
    // Do NOT set other["og:type"] — Next already emits property="og:type"
    // as website; a second name="og:type" product tag breaks Google Chat.
    other: {
      "product:price:amount": String(seo?.price ?? product.price ?? 0),
      "product:price:currency": seo?.currency || "INR",
      ...(product.soldOut || seo?.availability === "out_of_stock"
        ? { "product:availability": "out of stock" }
        : { "product:availability": "in stock" }),
    },
  };
}

/** Manual admin keywords first, then auto-derived terms — never overwrite manual entries. */
function uniqueKeywords(
  highlightTags?: string[] | null,
  searchTerms?: string[] | null,
  entryKeywords?: string | null,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (raw?: string | null) => {
    const s = String(raw || "").trim();
    if (!s) return;
    const key = s.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(s);
  };
  if (entryKeywords?.trim()) {
    for (const k of entryKeywords.split(",")) add(k);
  }
  for (const t of highlightTags || []) add(t);
  for (const t of searchTerms || []) add(t);
  return out.slice(0, 12);
}

export async function generateCategoryMetadata(input: {
  slug: string;
  title: string;
  description: string;
  image?: string | null;
}): Promise<Metadata> {
  return metadataForPath(`/collections/${input.slug}`, {
    title: input.title,
    description: shortPlainText(input.description, 160) || input.title,
    image: input.image,
  });
}

export async function generateArticleMetadata(input: {
  slug: string;
  title: string;
  description: string;
  image?: string | null;
  noIndex?: boolean;
  publishedTime?: string | null;
  modifiedTime?: string | null;
  authors?: string[];
  keywords?: string[];
}): Promise<Metadata> {
  const path = `/blogs/${input.slug}`;
  const entry = await getCachedSeoEntry(path);
  return generatePageMetadata(
    path,
    {
      title: input.title,
      description: input.description,
      image: input.image,
      noIndex: input.noIndex,
      ogType: "article",
      publishedTime: input.publishedTime,
      modifiedTime: input.modifiedTime,
      authors: input.authors,
      keywords: input.keywords,
    },
    entry,
  );
}

/** @deprecated use generatePageMetadata */
export const buildPageMetadata = generatePageMetadata;
