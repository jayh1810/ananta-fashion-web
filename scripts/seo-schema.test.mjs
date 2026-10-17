import assert from "node:assert/strict";
import test from "node:test";
import {
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
  buildCollectionJsonLd,
  buildFaqJsonLd,
  buildHowToJsonLd,
  buildWebPageJsonLd,
} from "../src/lib/schema/index.ts";
import { buildPageMetadata } from "../src/lib/seo/index.ts";

test("breadcrumb JSON-LD uses canonical HTTPS items", () => {
  const ld = buildBreadcrumbJsonLd([
    { name: "Home", href: "/" },
    { name: "Sarees", href: "/collections/sarees" },
  ]);
  assert.equal(ld["@type"], "BreadcrumbList");
  const items = ld.itemListElement;
  assert.ok(Array.isArray(items));
  assert.match(JSON.stringify(items[1]), /https:\/\/anantafashion\.com\/collections\/sarees/);
});

test("HowTo schema splits numbered steps and skips thin copy", () => {
  assert.equal(buildHowToJsonLd({ url: "/products/x", name: "Wear X", text: "Too short" }), null);
  const ld = buildHowToJsonLd({
    url: "/products/oversized-graphic-tshirt",
    name: "How to style an oversized graphic T-shirt",
    text: "1. Clean the bracelet.\n2. Wear it on the wrist that feels natural.\n3. Set a short sankalp on first wear.",
  });
  assert.equal(ld?.["@type"], "HowTo");
  assert.ok(Array.isArray(ld?.step));
  assert.equal(ld.step.length, 3);
  assert.equal(ld.step[0]["@type"], "HowToStep");
});

test("WebPage schema can include SpeakableSpecification selectors", () => {
  const ld = buildWebPageJsonLd({
    url: "/products/oversized-graphic-tshirt",
    name: "Oversized graphic T-shirt",
    description: "Relaxed-fit cotton T-shirt",
    speakable: ["h1", "#product-faqs"],
  });
  assert.equal(ld.speakable?.["@type"], "SpeakableSpecification");
  assert.deepEqual(ld.speakable?.cssSelector, ["h1", "#product-faqs"]);
});

test("FAQ schema is omitted when empty and never invents answers", () => {
  assert.equal(buildFaqJsonLd([]), null);
  const ld = buildFaqJsonLd([
    { question: "How do I choose my size?", answer: "See the size chart on the product page." },
  ]);
  assert.equal(ld?.["@type"], "FAQPage");
  assert.doesNotMatch(JSON.stringify(ld), /cure|medical/);
});

test("collection JSON-LD includes ItemList of real product URLs only", () => {
  const ld = buildCollectionJsonLd({
    url: "https://anantafashion.com/collections/sarees",
    name: "Sarees",
    description: "Sarees collection",
    productUrls: ["https://anantafashion.com/products/banarasi-silk-saree"],
  });
  assert.equal(ld["@type"], "CollectionPage");
  const main = ld.mainEntity;
  assert.ok(main && typeof main === "object");
});

test("article JSON-LD uses Person author and absolute image", () => {
  const ld = buildArticleJsonLd({
    url: "https://anantafashion.com/blogs/saree-draping-guide",
    headline: "Saree draping guide",
    description: "How to drape a saree.",
    image: "/uploads/saree.jpg",
    authorName: "Ananta Fashion",
    datePublished: "2026-01-01",
  });
  assert.equal(ld["@type"], "Article");
  assert.match(String(ld.image), /^https:\/\//);
});

test("filtered blog metadata is noindex with canonical to /blogs", () => {
  const meta = buildPageMetadata("/blogs", {
    title: "Blogs",
    description: "Guides",
    noIndex: true,
  });
  assert.equal(meta.alternates?.canonical, "https://anantafashion.com/blogs");
  assert.deepEqual(meta.robots, { index: false, follow: true });
});
