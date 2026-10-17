import assert from "node:assert/strict";
import test from "node:test";
import {
  renderLlmsProductsTxt,
  renderLlmsTxt,
} from "../src/lib/llms-render.ts";

const sample = {
  generatedAt: "2026-08-20T12:00:00.000Z",
  siteUrl: "https://anantafashion.com",
  brand: {
    name: "Ananta Fashion",
    legalEntity: "Ananta Labs",
    tagline: "Fashion & Beauty",
    description: [
      "Ananta Fashion is your destination for genuine fashion, beauty and lifestyle products from top brands.",
    ],
    market: "India",
    phone: "+91 12345 67890",
    email: "hello@anantafashion.com",
    supportHours: "Mon–Sat, 10AM – 7PM",
    address: null,
    instagram: null,
    facebook: null,
    shippingNote: "Free shipping on eligible orders across India.",
    returnsNote: "We offer a 7-day return policy from the date of delivery.",
    payments: ["Online via Razorpay (UPI, Cards)"],
  },
  pages: [
    {
      title: "Home",
      path: "/",
      url: "https://anantafashion.com",
      kind: "hub",
    },
    {
      title: "Shipping Policy",
      path: "/policies/shipping-policy",
      url: "https://anantafashion.com/policies/shipping-policy",
      kind: "policy",
    },
  ],
  categories: [
    {
      name: "Sarees",
      slug: "sarees",
      url: "https://anantafashion.com/collections/sarees",
      description: null,
      productCount: 10,
    },
  ],
  collections: [
    {
      name: "Sarees",
      slug: "sarees",
      url: "https://anantafashion.com/collections/sarees",
      description: null,
      productCount: 10,
    },
  ],
  blogs: [],
  faqs: [
    {
      question: "How do I care for a silk saree?",
      answer: "Dry clean only and store folded in a muslin cloth.",
    },
  ],
  products: [
    {
      name: "Banarasi Silk Saree",
      slug: "banarasi-silk-saree",
      url: "https://anantafashion.com/products/banarasi-silk-saree",
      description: "A handwoven Banarasi silk saree.",
      category: "Sarees",
      collection: "Sarees",
      sku: "SKU-1",
      price: 999,
      currency: "INR",
      availability: "In stock",
      brand: "Ananta Fashion",
      image: "https://cdn.example.com/p.jpg",
      updatedAt: "2026-08-20T12:00:00.000Z",
      attributes: ["Banarasi", "Sarees"],
      isBestSeller: true,
    },
  ],
  featuredProducts: [
    {
      name: "Banarasi Silk Saree",
      slug: "banarasi-silk-saree",
      url: "https://anantafashion.com/products/banarasi-silk-saree",
      description: "A handwoven Banarasi silk saree.",
      category: "Sarees",
      collection: "Sarees",
      sku: "SKU-1",
      price: 999,
      currency: "INR",
      availability: "In stock",
      brand: "Ananta Fashion",
      image: "https://cdn.example.com/p.jpg",
      updatedAt: "2026-08-20T12:00:00.000Z",
      attributes: ["Banarasi"],
      isBestSeller: true,
    },
  ],
  productCount: 1,
};

test("llms.txt is plain text with canonical URLs", () => {
  const txt = renderLlmsTxt(sample);
  assert.match(txt, /Ananta Fashion/);
  assert.match(txt, /https:\/\/anantafashion\.com\/llms\.txt/);
  assert.match(txt, /https:\/\/anantafashion\.com\/llm\.txt/);
  assert.match(txt, /Featured \/ important products/);
  assert.match(txt, /Frequently asked questions/);
  assert.match(txt, /Product discovery/);
  assert.match(txt, /llms\/collections\/\{slug\}\.txt/);
  assert.doesNotMatch(txt, /<html/);
  assert.doesNotMatch(txt, /\/admin\//);
  assert.doesNotMatch(txt, /\/account\//);
  assert.match(txt, /Citation guidance/);
});

test("product index includes attributes and per-product llms path", () => {
  const txt = renderLlmsProductsTxt(sample);
  assert.match(
    txt,
    /https:\/\/anantafashion\.com\/products\/banarasi-silk-saree/,
  );
  assert.match(txt, /₹999 INR/);
  assert.match(txt, /In stock/);
  assert.match(txt, /Key attributes:/);
  assert.match(txt, /llms\/products\/banarasi-silk-saree\.txt/);
});
