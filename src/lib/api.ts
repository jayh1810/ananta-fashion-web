import {
  getRecaptchaToken,
  recaptchaActionFromPath,
  recaptchaSiteKey,
} from "./recaptcha";
import { CATALOG_CACHE_TAG, FREE_PRODUCTS_CACHE_TAG } from "./catalog-cache";

const CONFIGURED_API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3003/api/v1"
).replace(/\/$/, "");

function isPrivateOrLocalHost(hostname: string) {
  if (!hostname) return true;
  if (hostname === "localhost" || hostname === "127.0.0.1") return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname))
    return true;
  return false;
}

function apiOriginFrom(url: string) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "";
  }
}

/**
 * Production: always use NEXT_PUBLIC_API_URL (baked at build time).
 * Dev on LAN: browser uses same-origin /api/v1 (Next.js rewrite → localhost:3003).
 * Dev on localhost: use .env URL directly.
 */
export function getApiUrl() {
  if (typeof window !== "undefined") {
    const { hostname, protocol, origin } = window.location;
    const isDev = process.env.NODE_ENV !== "production";

    // Phone/LAN testing — same-origin proxy avoids Chrome blocking localhost:3003
    if (
      isDev &&
      hostname &&
      isPrivateOrLocalHost(hostname) &&
      hostname !== "localhost" &&
      hostname !== "127.0.0.1"
    ) {
      return `${origin}/api/v1`;
    }

    try {
      const configuredHost = new URL(CONFIGURED_API_URL).hostname;
      if (
        isPrivateOrLocalHost(configuredHost) &&
        configuredHost !== "localhost" &&
        configuredHost !== "127.0.0.1" &&
        hostname &&
        isPrivateOrLocalHost(hostname) &&
        hostname !== "localhost" &&
        hostname !== "127.0.0.1"
      ) {
        return `${protocol}//${hostname}:3003/api/v1`;
      }
    } catch {
      /* fall through */
    }
  }

  try {
    const configuredHost = new URL(CONFIGURED_API_URL).hostname;
    if (!isPrivateOrLocalHost(configuredHost)) {
      return CONFIGURED_API_URL;
    }
  } catch {
    /* fall through */
  }

  return CONFIGURED_API_URL;
}

export const API_URL = CONFIGURED_API_URL;

function mediaTargetOrigin() {
  if (typeof window !== "undefined") {
    const { hostname, protocol } = window.location;
    if (
      hostname &&
      isPrivateOrLocalHost(hostname) &&
      hostname !== "localhost" &&
      hostname !== "127.0.0.1"
    ) {
      return `${protocol}//${hostname}:3003`;
    }
  }
  return apiOriginFrom(CONFIGURED_API_URL);
}

export function rewriteMediaUrls<T>(value: T): T {
  const targetOrigin = mediaTargetOrigin();
  if (!targetOrigin) return value;

  const rewriteString = (s: string) =>
    s.replace(
      /https?:\/\/(?:localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(?::\d+)?(?=\/uploads(?:\/|[?#]|$))/gi,
      targetOrigin,
    );

  if (typeof value === "string") return rewriteString(value) as T;
  if (Array.isArray(value)) {
    return value.map((v) => rewriteMediaUrls(v)) as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = rewriteMediaUrls(v);
    }
    return out as T;
  }
  return value;
}

/** Rewrite stored localhost/LAN media URLs to the configured API origin. */
export function mediaUrl(url?: string | null) {
  if (!url) return "";
  return rewriteMediaUrls(url);
}

/** Same-origin path for a file in the API uploads folder (`/uploads/...`). */
export function directMediaSrc(src?: string | null): string {
  const raw = (src || "").trim();
  if (!raw) return "";
  const rewritten = mediaUrl(raw) || raw;
  try {
    const u = new URL(rewritten, "http://local");
    if (u.pathname.startsWith("/uploads/")) return `${u.pathname}${u.search}`;
  } catch {
    /* keep the rewritten URL */
  }
  return rewritten;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function messageFromApiBody(data: unknown, status: number): string {
  if (!data || typeof data !== "object") {
    return `API error ${status}`;
  }
  const body = data as Record<string, unknown>;
  const raw = body.message ?? body.error ?? body.msg;
  if (Array.isArray(raw)) {
    return raw.map(String).filter(Boolean).join(", ") || `API error ${status}`;
  }
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (raw && typeof raw === "object") {
    const nested = (raw as Record<string, unknown>).message;
    if (typeof nested === "string" && nested.trim()) return nested.trim();
  }
  return `API error ${status}`;
}

export async function api<T = any>(
  path: string,
  options: { method?: string; body?: unknown; token?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const method = (options.method || "GET").toUpperCase();
  const mutating = !["GET", "HEAD", "OPTIONS"].includes(method);
  if (mutating && typeof window !== "undefined" && recaptchaSiteKey()) {
    const action = recaptchaActionFromPath(path);
    const token = await getRecaptchaToken(action);
    if (token) {
      headers["x-recaptcha-token"] = token;
      headers["x-recaptcha-action"] = action;
    }
  }

  const res = await fetch(`${getApiUrl()}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    ...(mutating
      ? { cache: "no-store" as const }
      : {
          next: {
            revalidate: 30,
            tags: [CATALOG_CACHE_TAG, FREE_PRODUCTS_CACHE_TAG],
          },
        }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(messageFromApiBody(data, res.status), res.status);
  }
  return rewriteMediaUrls(data) as T;
}

export type ProductImageDetail = {
  url: string;
  altText: string;
  title: string;
  caption: string;
};

/** Admin-managed offer banner below the PDP add-on block. */
export type PdpBanner = {
  id: string;
  imageUrl: string;
  imageAlt: string;
  imageTitle: string | null;
  imageCaption: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  linkUrl: string | null;
};

export async function fetchPdpBanner(slug: string): Promise<PdpBanner | null> {
  try {
    const res = await api<{ banner: PdpBanner | null }>(
      `/products/${encodeURIComponent(slug)}/pdp-banner`,
    );
    return res?.banner?.imageUrl ? res.banner : null;
  } catch {
    return null;
  }
}

export type Product = {
  id: string;
  slug: string;
  title: string;
  image: string;
  images?: string[];
  /** Per-image SEO text in the same order as `images`. Empty strings when not set. */
  imageDetails?: ProductImageDetail[];
  price: number;
  compareAt: number;
  reviews: number;
  rating: number;
  badge?: string;
  soldOut?: boolean;
  description: string;
  shortDescription?: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  variantId?: string;
  stock?: number;
  categories?: {
    id: string;
    name: string;
    slug: string;
    parentId?: string | null;
    shippingWeightKg?: number | null;
    shippingLengthCm?: number | null;
    shippingBreadthCm?: number | null;
    shippingHeightCm?: number | null;
  }[];
  collections?: { id: string; name: string; slug: string }[];
  weightGrams?: number | null;
  shippingWeightKg?: number | null;
  shippingLengthCm?: number | null;
  shippingBreadthCm?: number | null;
  shippingHeightCm?: number | null;
  isBestSeller?: boolean;
  highlightTags?: string[];
  extraOfferLabel?: string | null;
  offerEndsAt?: string | null;
  offerSaveAmount?: number | null;
  offerTitle?: string | null;
  offerGiftText?: string | null;
  offerGiftWorth?: number | null;
  /** When true, Special Launch Offer block is shown on PDP. */
  showSpecialOffer?: boolean;
  /** When true, “Offer ends in…” countdown is shown on PDP. */
  showOfferCountdown?: boolean;
  /** When true, green promo strip on price/CTA card is shown. */
  showPriceCardBanner?: boolean;
  /** Green strip text (e.g. 100% Cashback). */
  priceCardBannerText?: string | null;
  cashbackRibbon?: string | null;
  /** When true, yellow cashback badge is shown on cards / PDP. */
  showCashbackRibbon?: boolean;
  /** When true, storefront shows “Free” / charges ₹0 (catalog price unchanged). */
  isFreeProduct?: boolean;
  siddhAddonEnabled?: boolean;
  siddhAddonHeading?: string | null;
  siddhAddonName?: string | null;
  siddhAddonPrice?: number | null;
  siddhAddonInfo?: string | null;
  /** Linked reusable add-on offer (admin Catalog → Add-on products). */
  addonProductId?: string | null;
  addonLinkedProductId?: string | null;
  /** Real catalog product used as the add-on (image + stock). */
  siddhAddonProduct?: {
    id: string;
    title: string;
    slug: string;
    image?: string;
    variantId?: string | null;
    stock?: number;
    soldOut?: boolean;
    price?: number | null;
  } | null;
  /** Set on cart lines when customer selected the product add-on (legacy fee mode) */
  siddhAddonSelected?: boolean;
  /** How many add-on units this cart line covers (Pack of 2 → 2). */
  siddhAddonUnits?: number;
  /** PDP: products auto-added at ₹0 at checkout with this product. */
  freeGifts?: {
    title: string;
    image: string | null;
    quantity: number;
    /** true = quantity per unit bought; false = per order. */
    perUnit: boolean;
    /** Catalog value per unit, rupees. */
    worth: number;
  }[];
  /** Cart: this line is the real linked add-on product. */
  isAddonUpsell?: boolean;
  /** Cart: parent product id when isAddonUpsell. */
  addonParentId?: string | null;
  /** Cart: add-on qty = parentQty × this. */
  addonUnitsPerParent?: number;
  /** Cart: units charged at combo / offer price. */
  addonComboQty?: number;
  /** Cart: combo unit price (rupees). */
  addonComboPrice?: number;
  /** Cart: catalog unit price for extras beyond combo (rupees). */
  addonCatalogPrice?: number;
  variantOptions?: {
    label: string;
    price: number;
    saveLabel?: string;
    popular?: boolean;
    saveHighlight?: boolean;
    variantId?: string;
    stock?: number;
    soldOut?: boolean;
  }[];
  hasVariants?: boolean;
  attributeOptions?: {
    name: string;
    slug: string;
    values: {
      id: string;
      label: string;
      value: string;
      variantId?: string;
      price?: number;
      stock?: number;
      soldOut?: boolean;
      imageUrl?: string | null;
    }[];
  }[];
  productVariants?: {
    id: string;
    title: string;
    sku: string;
    price: number;
    compareAt?: number;
    stock: number;
    soldOut: boolean;
    imageUrl?: string | null;
    options: Record<string, string>;
    isDefault?: boolean;
  }[];
  crystals?: { name: string; benefit: string }[];
  productNote?: string | null;
  socialProof?: {
    image?: string;
    videoUrl?: string;
    views?: string;
    label: string;
  }[];
  benefitBlocks?: { title: string; body: string }[];
  /** Product-specific PDP fold-outs (Packaging / Returns / Cashback come from Settings) */
  pdpAccordions?: { title: string; body: string }[];
  howToWear?: string | null;
  productSpec?: string | null;
  benefits?: string[];
  styleTips?: string[];
  bestDayToWear?: string | null;
  authenticityText?: string | null;
  /** @deprecated Global Settings — always null from API */
  packagingText?: string | null;
  disclaimerText?: string | null;
  /** @deprecated Global Settings — always null from API */
  returnsText?: string | null;
  /** @deprecated Global Settings — always null from API */
  cashbackTerms?: string | null;
  certificationUrl?: string | null;
  certificationLabel?: string | null;
  featuredReviewName?: string | null;
  featuredReviewText?: string | null;
  featuredReviewRating?: number | null;
  featuredReviewAvatar?: string | null;
  relatedProductIds?: string[];
  reviewList?: {
    id: string;
    rating: number;
    body: string;
    authorName?: string | null;
    isVerified?: boolean;
    avatarUrl?: string | null;
  }[];
  sku?: string | null;
  brand?: { id: string; name: string; slug: string; logoUrl?: string | null } | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
  tags?: { id: string; name: string; slug?: string }[];
  seo?: {
    title: string;
    ogTitle: string;
    description: string;
    ogDescription: string;
    canonicalPath: string;
    ogImage: string | null;
    primaryImageAlt: string;
    brand: string;
    sku: string | null;
    price: number | null;
    currency: "INR";
    availability: "in_stock" | "out_of_stock";
    category: string | null;
    attributes: string[];
    searchTerms: string[];
    indexable: boolean;
    merchantEligible: boolean;
    suggestedFaqs?: { question: string; answer: string }[];
    aggregateRating?: { ratingValue: number; reviewCount: number } | null;
    entities?: {
      primary: string;
      productType: string | null;
      attributes: string[];
      concepts: string[];
      category: string | null;
      collection: string | null;
    };
  };
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
  sortOrder?: number;
};

export function formatINR(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

/** Storefront price label — free products show “Free” (catalog price unchanged in DB). */
export function formatProductPrice(
  price: number,
  isFreeProduct?: boolean,
) {
  if (isFreeProduct && price <= 0) return "Free";
  return formatINR(price);
}

export function discountPercent(price: number, compareAt: number) {
  if (!compareAt || compareAt <= price) return 0;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

/** Parse Extra % from stored label; Extra is a split of real discount, not stacked. */
export function parseExtraOfferPercent(label?: string | null): number {
  if (!label) return 0;
  const extra = label.match(/Extra\s*(\d+)\s*%/i);
  if (extra) return parseInt(extra[1], 10);
  if (/^\d+$/.test(label.trim())) return parseInt(label.trim(), 10);
  return 0;
}

/**
 * Honest storefront label: Extra splits the real price discount.
 * ₹3000 → ₹899 = 70%; Extra 15 → "55% + Extra 15% OFF"
 */
export function formatOfferLabel(
  price: number,
  compareAt: number,
  extraOfferLabel?: string | null,
): string | null {
  const total = discountPercent(price, compareAt);
  const requested = parseExtraOfferPercent(extraOfferLabel);
  if (total <= 0) {
    return requested > 0 ? `Extra ${requested}% OFF` : null;
  }
  const extra = Math.min(requested, Math.max(0, total - 1));
  const base = total - extra;
  if (base > 0 && extra > 0) return `${base}% + Extra ${extra}% OFF`;
  return `${total}% OFF`;
}

export const BRAND = process.env.NEXT_PUBLIC_BRAND || "Ananta Fashion";

/** Fallback header links — admin Content → Menus → Header overrides these. */
export const navLinks = [
  { label: "Shop All", href: "/collections/all" },
  { label: "Best Sellers", href: "/collections/bestsellers" },
  { label: "Blogs", href: "/blogs" },
  { label: "Contact us", href: "/pages/contact" },
];

/** No hardcoded testimonials — only admin-managed ones are shown. */
export const testimonials: { name: string; text: string }[] = [];

/** No hardcoded FAQs — only admin-managed ones are shown. */
export const faqs: { q: string; a: string }[] = [];
