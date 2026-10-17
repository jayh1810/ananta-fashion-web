import assert from "node:assert/strict";
import test from "node:test";
import { generateProductSchema } from "../src/lib/schema/product.ts";
import { generateFAQSchema, generateOfferSchema, generateBreadcrumbSchema } from "../src/lib/schema/index.ts";
import {
  canonicalUrl,
  generatePageMetadata,
  generateProductMetadata,
} from "../src/lib/seo/index.ts";

function fakeProduct(overrides = {}) {
  return {
    id: "p1",
    slug: "matte-lipstick-ruby-red",
    title: "Matte Lipstick Ruby Red",
    image: "/uploads/lipstick.jpg",
    price: 1299,
    compareAt: 1999,
    reviews: 0,
    rating: 0,
    description: "Long-lasting matte lipstick in ruby red.",
    soldOut: false,
    reviewList: [],
    ...overrides,
  };
}

test("canonical strips tracking and facet params", () => {
  assert.equal(
    canonicalUrl("/products/foo?utm_source=ig&fbclid=abc"),
    "https://anantafashion.com/products/foo",
  );
  assert.equal(
    canonicalUrl("/collections/sarees?sort=price&page=2"),
    "https://anantafashion.com/collections/sarees",
  );
  assert.equal(canonicalUrl("/"), "https://anantafashion.com");
});

test("missing product metadata is noindex and not a fake PDP", async () => {
  const meta = await generateProductMetadata("deleted-item", null);
  assert.equal(meta.title, "Product");
  assert.deepEqual(meta.robots, { index: false, follow: false });
});

test("product schema omits review and rating when none exist", () => {
  const ld = generateProductSchema(fakeProduct(), "Long-lasting matte lipstick.");
  assert.equal(ld["@type"], "Product");
  assert.equal(ld.aggregateRating, undefined);
  assert.equal(ld.review, undefined);
  assert.ok(ld.offers);
});

test("out-of-stock product offer uses OutOfStock", () => {
  const ld = generateProductSchema(
    fakeProduct({ soldOut: true, price: 499 }),
    "Out of stock item",
  );
  assert.match(JSON.stringify(ld.offers), /OutOfStock/);
  assert.match(String(ld.offers.price), /499/);
});

test("reviews are included only from real reviewList bodies", () => {
  const ld = generateProductSchema(
    fakeProduct({
      reviews: 99,
      rating: 4.5,
      reviewList: [
        { rating: 5, body: "Arrived as described.", authorName: "Asha" },
        { rating: 4, body: "", authorName: "Skip me" },
      ],
    }),
    "Rated product",
  );
  assert.equal(ld.aggregateRating?.reviewCount, 1);
  assert.equal(ld.aggregateRating?.ratingValue, 5);
  assert.ok(Array.isArray(ld.review));
  assert.equal(ld.review.length, 1);
  assert.equal(ld.review[0].reviewBody, "Arrived as described.");
});

test("no aggregateRating when only review counter exists without bodies", () => {
  const ld = generateProductSchema(
    fakeProduct({ reviews: 5, rating: 4.8, reviewList: [] }),
    "Product without reviews",
  );
  assert.equal(ld.aggregateRating, undefined);
  assert.equal(ld.review, undefined);
});

test("offer uses popular pack price when quantity packs exist", () => {
  const offer = generateOfferSchema(
    fakeProduct({
      price: 450,
      variantOptions: [
        { label: "Pack of 1", price: 450, soldOut: false },
        { label: "Pack of 2", price: 850, popular: true, soldOut: false },
      ],
    }),
    "https://anantafashion.com/products/oversized-graphic-tshirt",
  );
  assert.equal(offer["@type"], "AggregateOffer");
  assert.equal(offer.lowPrice, "450.00");
  assert.equal(offer.highPrice, "850.00");
  assert.equal(offer.priceCurrency, "INR");
  assert.equal(offer.availability, "https://schema.org/InStock");
});

test("product schema urls and merchant fields are valid", () => {
  const ld = generateProductSchema(
    fakeProduct({
      slug: "quilted-ladies-sling-bag",
      sku: "SKU-123",
      seo: {
        brand: "Ananta Fashion",
        canonicalPath: "/products/quilted-ladies-sling-bag",
      },
    }),
    "Quilted Ladies Sling Bag in emerald green.",
  );
  assert.equal(ld["@context"], "https://schema.org");
  assert.equal(ld["@type"], "Product");
  assert.match(String(ld.url), /quilted-ladies-sling-bag$/);
  assert.equal(ld.offers.url, ld.url);
  assert.equal(ld.offers.itemCondition, "https://schema.org/NewCondition");
  assert.equal(ld.brand.name, "Ananta Fashion");
  assert.equal(ld.sku, "SKU-123");
});

test("FAQ schema is not emitted without visible Q&A", () => {
  assert.equal(generateFAQSchema([]), null);
});

test("page metadata never canonicalizes unique paths to homepage", () => {
  const meta = generatePageMetadata("/collections/sarees", {
    title: "Sarees",
    description: "Shop sarees",
  });
  assert.equal(
    meta.alternates?.canonical,
    "https://anantafashion.com/collections/sarees",
  );
});

test("page metadata always includes og:image for WhatsApp/share previews", () => {
  const without = generatePageMetadata("/collections/earrings", {
    title: "Earrings",
    description: "Shop earrings",
  });
  const imgs = without.openGraph?.images;
  assert.ok(Array.isArray(imgs) && imgs.length > 0, "og:images required");
  const url = typeof imgs[0] === "string" ? imgs[0] : imgs[0]?.url;
  assert.ok(
    typeof url === "string" && /^https:\/\//.test(url),
    "og:image must be absolute https",
  );
  assert.deepEqual(without.twitter?.images, [url]);

  const withProduct = generatePageMetadata("/collections/combos", {
    title: "Combos",
    description: "Shop combos",
    image: "https://cdn.example.com/combo.jpg",
  });
  const productImgs = withProduct.openGraph?.images;
  const productUrl =
    typeof productImgs?.[0] === "string"
      ? productImgs[0]
      : productImgs?.[0]?.url;
  assert.equal(productUrl, "https://cdn.example.com/combo.jpg");

  const contabo =
    "https://sin1.contabostorage.com/tenant:bucket/products/big.png";
  const withContabo = generatePageMetadata("/collections/earrings", {
    title: "Earrings",
    description: "Shop earrings",
    image: contabo,
  });
  const cImgs = withContabo.openGraph?.images;
  const cUrl = typeof cImgs?.[0] === "string" ? cImgs[0] : cImgs?.[0]?.url;
  assert.ok(
    typeof cUrl === "string" &&
      /^https:\/\/anantafashion\.com\/og\/[A-Za-z0-9_-]+\.jpg$/.test(cUrl),
    "Contabo OG images must use /og/<token>.jpg for chat previews",
  );
});

test("non-indexable product metadata emits noindex", async () => {
  const meta = await generateProductMetadata(
    "draft-product",
    fakeProduct({
      seo: {
        title: "Draft Product",
        ogTitle: "Draft Product | Ananta Fashion",
        description: "Draft product description for testing.",
        ogDescription: "Draft product description for testing.",
        canonicalPath: "/products/draft-product",
        ogImage: null,
        primaryImageAlt: "Draft",
        brand: "Ananta Fashion",
        sku: null,
        price: 499,
        currency: "INR",
        availability: "in_stock",
        category: null,
        attributes: [],
        searchTerms: [],
        indexable: false,
        merchantEligible: false,
      },
    }),
  );
  assert.deepEqual(meta.robots, { index: false, follow: true });
});

test("product metadata prefers API seo bundle when meta fields empty", async () => {
  const meta = await generateProductMetadata(
    "quilted-ladies-sling-bag",
    fakeProduct({
      metaTitle: null,
      metaDescription: null,
      seo: {
        title: "Quilted Ladies Sling Bag",
        ogTitle: "Quilted Ladies Sling Bag | Ananta Fashion",
        description:
          "Quilted Ladies Sling Bag in emerald green with magnetic closure and card slots.",
        ogDescription:
          "Quilted Ladies Sling Bag in emerald green with magnetic closure and card slots.",
        canonicalPath: "/products/quilted-ladies-sling-bag",
        ogImage: "/uploads/purse.jpg",
        primaryImageAlt: "Quilted Ladies Sling Bag emerald green long wallet",
        brand: "Ananta Fashion",
        sku: null,
        price: 490,
        currency: "INR",
        availability: "in_stock",
        category: "Money / Wealth",
        attributes: ["Emerald green"],
        searchTerms: ["Quilted Ladies Sling Bag", "quilted sling bag"],
        indexable: true,
        merchantEligible: true,
      },
    }),
  );
  const title =
    typeof meta.title === "string"
      ? meta.title
      : meta.title && "absolute" in meta.title
        ? meta.title.absolute
        : "";
  assert.match(String(title), /Quilted Ladies Sling Bag/);
  assert.match(String(meta.description), /emerald green/i);
});

test("breadcrumb JSON-LD matches product canonical path", () => {
  const ld = generateBreadcrumbSchema([
    { name: "Home", href: "/" },
    { name: "Quilted Ladies Sling Bag", href: "/products/quilted-ladies-sling-bag" },
  ]);
  assert.equal(ld["@type"], "BreadcrumbList");
  assert.equal(ld["@context"], "https://schema.org");
  const last = ld.itemListElement.at(-1);
  assert.match(String(last.item), /quilted-ladies-sling-bag$/);
});

test("offer schema matches storefront rupee price", () => {
  const offer = generateOfferSchema(
    fakeProduct({ price: 1299 }),
    "https://anantafashion.com/products/matte-lipstick-ruby-red",
  );
  assert.equal(offer.price, "1299.00");
  assert.equal(offer.priceCurrency, "INR");
});

test("offer price is a decimal string with no currency symbol", () => {
  const offer = generateOfferSchema(
    fakeProduct({ price: 450 }),
    "https://anantafashion.com/products/gold-tone-hoop-earrings",
  );
  assert.match(String(offer.price), /^\d+\.\d{2}$/);
  assert.doesNotMatch(JSON.stringify(offer), /₹|INR450|Rs\.?/);
  assert.equal(
    offer.hasMerchantReturnPolicy.returnShippingFeesAmount.value,
    "0.00",
  );
});

test("aggregate offer includes a valid default price for Product snippets", () => {
  const offer = generateOfferSchema(
    fakeProduct({
      price: 450,
      variantOptions: [
        { label: "Pack of 1", price: 450, soldOut: false },
        { label: "Pack of 2", price: 850, popular: true, soldOut: false },
      ],
    }),
    "https://anantafashion.com/products/classic-leather-watch",
  );
  assert.equal(offer["@type"], "AggregateOffer");
  assert.equal(offer.price, "850.00");
  assert.match(String(offer.lowPrice), /^\d+\.\d{2}$/);
  assert.match(String(offer.highPrice), /^\d+\.\d{2}$/);
});

test("overlong sku is omitted from product schema", () => {
  const ld = generateProductSchema(
    fakeProduct({ sku: "SKU-" + "X".repeat(80) }),
    "Product with an overlong SKU",
  );
  assert.equal(ld.sku, undefined);
});

test("product schema falls back to variant image when gallery is empty", () => {
  const ld = generateProductSchema(
    fakeProduct({
      image: "",
      images: [],
      productVariants: [
        {
          id: "v1",
          title: "Default",
          sku: "V-1",
          price: 301,
          stock: 3,
          soldOut: false,
          imageUrl: "https://cdn.example.com/oxidised-silver-anklet.jpg",
          options: {},
        },
      ],
    }),
    "Oxidised Silver Anklet",
  );
  assert.equal(ld.image, "https://cdn.example.com/oxidised-silver-anklet.jpg");
});
