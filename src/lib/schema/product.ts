import type { Product } from "../api";
import { BRAND } from "../api";
import { SITE_URL, ENTITY } from "../seo/constants";
import { canonicalUrl, toAbsoluteImageUrl } from "../seo/canonical";
import { productImageDetail } from "../product-image-seo";

export type JsonLd = Record<string, unknown>;

const RETURN_POLICY_URL = `${SITE_URL}/policies/refund-policy`;

/** Google Merchant / Product snippets: digits + optional decimals only — no ₹. */
export function schemaPriceString(amount: number): string {
  const n = Number(amount);
  if (!Number.isFinite(n) || n < 0) return "0.00";
  return (Math.round(n * 100) / 100).toFixed(2);
}

/** Omit overlong SKUs rather than truncate (GSC: invalid string length). */
export function schemaSku(raw: string | null | undefined): string | undefined {
  const sku = String(raw || "").trim();
  if (!sku || sku.length > 70) return undefined;
  return sku;
}

/**
 * Gallery images as ImageObject (saved alt / title / caption, else product-level
 * fallbacks), then any other product image URLs (OG, variant, attribute) as plain URLs.
 */
function productImages(product: Product): (string | JsonLd)[] {
  const seen = new Set<string>();
  const out: (string | JsonLd)[] = [];
  const title = String(product.title || "").trim();

  const gallery = [product.image, ...(product.images || [])].filter(
    (raw, i, arr) => raw && arr.indexOf(raw) === i,
  ) as string[];
  gallery.forEach((raw, i) => {
    const u = toAbsoluteImageUrl(raw);
    if (!u || seen.has(u)) return;
    seen.add(u);
    const detail = productImageDetail(product, raw);
    const fallbackAlt =
      i === 0 && product.seo?.primaryImageAlt?.trim()
        ? product.seo.primaryImageAlt.trim()
        : `${title}${i > 0 ? ` ${i + 1}` : ""}`;
    const node: JsonLd = {
      "@type": "ImageObject",
      url: u,
      contentUrl: u,
      name: detail.title || title,
      description: detail.altText || fallbackAlt,
    };
    if (detail.caption) node.caption = detail.caption;
    if (i === 0) node.representativeOfPage = true;
    out.push(node);
  });

  const variantUrls = (product.productVariants || []).map((v) => v.imageUrl);
  const attrUrls = (product.attributeOptions || []).flatMap((a) =>
    a.values.map((v) => v.imageUrl),
  );
  for (const raw of [product.seo?.ogImage, ...variantUrls, ...attrUrls]) {
    const u = toAbsoluteImageUrl(raw);
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

/** Quantity packs shown on PDP — mirrors ProductDetail filter logic. */
function visiblePacks(product: Product) {
  return (product.variantOptions || []).filter((p) => {
    if (!p?.label || typeof p.price !== "number" || p.price <= 0) return false;
    if (/^default(\s+title)?$/i.test(String(p.label).trim())) return false;
    return true;
  });
}

export function storefrontPrice(product: Product): number {
  if (product.isFreeProduct) return 0;
  const n = Number(product.price);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

/** Default price shown on first paint — popular pack, else first pack, else base. */
export function defaultDisplayPrice(product: Product): number {
  const packs = visiblePacks(product);
  if (packs.length) {
    const popular = packs.find((p) => p.popular);
    return Math.round((popular ?? packs[0]).price);
  }
  return storefrontPrice(product);
}

function variantPriceList(product: Product): number[] {
  const packs = visiblePacks(product);
  if (packs.length) {
    return [...new Set(packs.map((p) => Math.round(p.price)))].sort(
      (a, b) => a - b,
    );
  }
  return [storefrontPrice(product)];
}

function availabilityUrl(product: Product): string {
  const packs = visiblePacks(product);
  if (packs.length) {
    return packs.some((v) => !v.soldOut)
      ? "https://schema.org/InStock"
      : "https://schema.org/OutOfStock";
  }
  return product.soldOut
    ? "https://schema.org/OutOfStock"
    : "https://schema.org/InStock";
}

function priceValidUntil(product: Product): string {
  const raw = product.offerEndsAt;
  if (raw) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime()) && d.getTime() > Date.now()) {
      return d.toISOString().slice(0, 10);
    }
  }
  const now = new Date();
  const y = now.getUTCFullYear();
  const endThisYear = Date.UTC(y, 11, 31, 23, 59, 59);
  return now.getTime() < endThisYear ? `${y}-12-31` : `${y + 1}-12-31`;
}

export function generateOfferSchema(product: Product, url: string): JsonLd {
  const prices = variantPriceList(product);
  const low = prices[0] ?? 0;
  const high = prices[prices.length - 1] ?? low;
  const defaultPrice = defaultDisplayPrice(product);

  const extras = {
    seller: {
      "@type": "Organization",
      "@id": ENTITY.organization,
      name: BRAND,
    },
    shippingDetails: {
      "@type": "OfferShippingDetails",
      shippingRate: {
        "@type": "MonetaryAmount",
        value: schemaPriceString(0),
        currency: "INR",
      },
      shippingDestination: {
        "@type": "DefinedRegion",
        addressCountry: "IN",
      },
      deliveryTime: {
        "@type": "ShippingDeliveryTime",
        handlingTime: {
          "@type": "QuantitativeValue",
          minValue: 1,
          maxValue: 2,
          unitCode: "DAY",
        },
        transitTime: {
          "@type": "QuantitativeValue",
          minValue: 3,
          maxValue: 7,
          unitCode: "DAY",
        },
      },
    },
    hasMerchantReturnPolicy: {
      "@type": "MerchantReturnPolicy",
      applicableCountry: "IN",
      returnPolicyCategory:
        "https://schema.org/MerchantReturnFiniteReturnWindow",
      merchantReturnDays: 7,
      returnMethod: "https://schema.org/ReturnByMail",
      returnFees: "https://schema.org/FreeReturn",
      returnShippingFeesAmount: {
        "@type": "MonetaryAmount",
        value: schemaPriceString(0),
        currency: "INR",
      },
      url: RETURN_POLICY_URL,
    },
  };

  const shared = {
    url,
    priceCurrency: "INR",
    availability: availabilityUrl(product),
    itemCondition: "https://schema.org/NewCondition",
    priceValidUntil: priceValidUntil(product),
    ...extras,
  };

  // Multiple distinct pack prices → AggregateOffer (Merchant-compatible range).
  if (prices.length > 1 && low !== high) {
    return {
      "@type": "AggregateOffer",
      ...shared,
      price: schemaPriceString(defaultPrice),
      lowPrice: schemaPriceString(low),
      highPrice: schemaPriceString(high),
      offerCount: prices.length,
    };
  }

  // Single visible price — matches default pack / base price on PDP.
  const price = prices.length === 1 ? prices[0] : defaultPrice;
  return {
    "@type": "Offer",
    ...shared,
    price: schemaPriceString(price),
  };
}

export function generateReviewSchema(product: Product): JsonLd[] {
  return (product.reviewList || [])
    .filter(
      (r) =>
        r &&
        Number.isFinite(Number(r.rating)) &&
        Number(r.rating) >= 1 &&
        String(r.body || "").trim().length > 0,
    )
    .slice(0, 20)
    .map((r) => ({
      "@type": "Review",
      reviewRating: {
        "@type": "Rating",
        ratingValue: Number(r.rating),
        bestRating: 5,
        worstRating: 1,
      },
      reviewBody: String(r.body).trim(),
      ...(r.authorName?.trim()
        ? { author: { "@type": "Person", name: r.authorName.trim() } }
        : {}),
    }));
}

/** Only from reviews included in JSON-LD — counts always match review[]. */
export function generateAggregateRatingSchema(
  product: Product,
  reviews: JsonLd[],
): JsonLd | null {
  if (!reviews.length) return null;

  const ratings = reviews
    .map((r) => Number((r.reviewRating as { ratingValue?: number })?.ratingValue))
    .filter((n) => Number.isFinite(n) && n >= 1);

  if (!ratings.length) return null;

  const ratingValue =
    Math.round(
      (ratings.reduce((sum, n) => sum + n, 0) / ratings.length) * 10,
    ) / 10;

  return {
    "@type": "AggregateRating",
    ratingValue,
    reviewCount: reviews.length,
    bestRating: 5,
    worstRating: 1,
  };
}

export function generateProductSchema(
  product: Product,
  description: string,
): JsonLd {
  const url = canonicalUrl(
    product.seo?.canonicalPath || `/products/${product.slug}`,
  );
  const images = productImages(product);
  const brandName =
    product.seo?.brand?.trim() ||
    product.brand?.name?.trim() ||
    BRAND;
  const sku = schemaSku(product.seo?.sku) || schemaSku(product.sku);
  const plainDescription = String(description || product.title || "").trim();

  const node: JsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": ENTITY.product(url),
    name: product.title,
    description: plainDescription,
    url,
    brand: { "@type": "Brand", name: brandName },
    offers: generateOfferSchema(product, url),
    mainEntityOfPage: { "@type": "WebPage", "@id": ENTITY.webpage(url) },
    isPartOf: { "@id": ENTITY.website },
  };

  if (images.length) node.image = images.length === 1 ? images[0] : images;
  if (sku) node.sku = sku;

  const categoryName =
    product.seo?.category?.trim() || product.categories?.[0]?.name?.trim();
  if (categoryName) node.category = categoryName;

  const extraProps: JsonLd[] = [];
  const attrs = product.seo?.attributes?.length
    ? product.seo.attributes
    : [];
  for (const value of attrs.slice(0, 6)) {
    extraProps.push({
      "@type": "PropertyValue",
      name: "Feature",
      value,
    });
  }
  if (extraProps.length) node.additionalProperty = extraProps;

  const reviews = generateReviewSchema(product);
  if (reviews.length) node.review = reviews;

  const aggregate = generateAggregateRatingSchema(product, reviews);
  if (aggregate) node.aggregateRating = aggregate;

  return node;
}

export function productCanonicalUrl(slug: string): string {
  return canonicalUrl(`/products/${slug}`);
}

export function toAbsoluteImage(url: string | null | undefined): string | null {
  return toAbsoluteImageUrl(url) || null;
}

/** @deprecated use generateProductSchema */
export const buildProductJsonLd = generateProductSchema;
