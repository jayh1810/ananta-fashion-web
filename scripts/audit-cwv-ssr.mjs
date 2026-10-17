#!/usr/bin/env node
/**
 * Core Web Vitals / Googlebot rendering audit for key storefront routes.
 * Usage: node scripts/audit-cwv-ssr.mjs [baseUrl]
 *        SAMPLE_PRODUCT_SLUG=some-product node scripts/audit-cwv-ssr.mjs [baseUrl]
 */
const BASE = (process.argv[2] || "https://anantafashion.com").replace(/\/$/, "");
const SAMPLE_PRODUCT_SLUG = process.env.SAMPLE_PRODUCT_SLUG?.trim();

const ROUTES = [
  { name: "Homepage", path: "/" },
  { name: "Collection (all)", path: "/collections/all" },
  { name: "Collection (bestsellers)", path: "/collections/bestsellers" },
  ...(SAMPLE_PRODUCT_SLUG
    ? [{ name: "Product PDP", path: `/products/${SAMPLE_PRODUCT_SLUG}` }]
    : []),
];

function extract(html, re) {
  const m = html.match(re);
  return m ? m[1] : null;
}

function hasJsonLdType(html, type) {
  return new RegExp(`"@type"\\s*:\\s*"${type}"`).test(html);
}

async function auditRoute({ name, path }) {
  const url = `${BASE}${path}`;
  const t0 = performance.now();
  const res = await fetch(url, {
    headers: { "User-Agent": "Googlebot/2.1 (+http://www.google.com/bot.html)" },
    redirect: "follow",
  });
  const ttfbMs = Math.round(performance.now() - t0);
  const html = await res.text();
  const totalMs = Math.round(performance.now() - t0);

  const canonical = extract(
    html,
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
  );
  const title = extract(html, /<title[^>]*>([^<]+)<\/title>/i);
  const h1Count = (html.match(/<h1[\s>]/gi) || []).length;
  const productLd = hasJsonLdType(html, "Product");
  const breadcrumbLd = hasJsonLdType(html, "BreadcrumbList");
  const hasOffer = /"price"\s*:/.test(html) && /INR|"priceCurrency"/.test(html);
  const hasInStock =
    /In stock|InStock|https:\/\/schema\.org\/InStock/i.test(html);
  const hasNextImage = /\/_next\/image\?url=/.test(html);
  const rawImgCount = (html.match(/<img[\s>]/gi) || []).length;
  const scriptCount = (html.match(/<script[\s>]/gi) || []).length;
  const lazyImages = (html.match(/loading=["']lazy["']/gi) || []).length;
  const priorityImages = (html.match(/fetchpriority=["']high["']/gi) || []).length;
  const cacheControl = res.headers.get("cache-control") || "";
  const productNameInHtml =
    path.includes("/products/") && /<h1[^>]*>\s*[^<\s][^<]{2,}/i.test(html);

  const checks = [
    { ok: res.ok, label: `HTTP ${res.status}` },
    { ok: ttfbMs < 1200, label: `TTFB ${ttfbMs}ms (<1200ms)` },
    { ok: Boolean(title?.trim()), label: "Title in HTML" },
    { ok: h1Count >= 1 && h1Count <= 2, label: `H1 count ${h1Count} (1-2)` },
    { ok: Boolean(canonical), label: "Canonical link" },
    { ok: productLd || !path.includes("/products/"), label: "Product JSON-LD" },
    {
      ok: breadcrumbLd || !path.includes("/products/"),
      label: "Breadcrumb JSON-LD",
    },
    { ok: hasOffer || !path.includes("/products/"), label: "Price in HTML/JSON-LD" },
    {
      ok: hasInStock || !path.includes("/products/"),
      label: "Availability in HTML/JSON-LD",
    },
    {
      ok: productNameInHtml || !path.includes("/products/"),
      label: "Product name in initial HTML",
    },
    { ok: hasNextImage || path === "/", label: "next/image optimization" },
    { ok: scriptCount < 80, label: `Script tags ${scriptCount} (<80)` },
  ];

  const passed = checks.filter((c) => c.ok).length;
  return {
    name,
    url,
    ttfbMs,
    totalMs,
    htmlBytes: html.length,
    rawImgCount,
    lazyImages,
    priorityImages,
    cacheControl,
    passed,
    total: checks.length,
    checks,
  };
}

async function main() {
  console.log(`CWV / Googlebot SSR audit — ${BASE}\n`);
  const results = [];
  for (const route of ROUTES) {
    try {
      const r = await auditRoute(route);
      results.push(r);
      console.log(`${r.name} — ${r.url}`);
      console.log(
        `  TTFB: ${r.ttfbMs}ms | HTML: ${(r.htmlBytes / 1024).toFixed(1)}KB | Scripts: ${r.checks.find((c) => c.label.startsWith("Script"))?.label}`,
      );
      console.log(`  Cache-Control: ${r.cacheControl || "(none)"}`);
      console.log(
        `  Images: raw=${r.rawImgCount} lazy=${r.lazyImages} priority=${r.priorityImages}`,
      );
      for (const c of r.checks) {
        console.log(`  ${c.ok ? "✓" : "✗"} ${c.label}`);
      }
      console.log(`  Score: ${r.passed}/${r.total}\n`);
    } catch (e) {
      console.error(`✗ ${route.name}: ${e.message}\n`);
      results.push({ name: route.name, error: e.message });
    }
  }

  const scored = results.filter((r) => r.total);
  const avgTtfb = Math.round(
    scored.reduce((s, r) => s + r.ttfbMs, 0) / Math.max(scored.length, 1),
  );
  console.log("Summary");
  console.log(`  Routes tested: ${ROUTES.length}`);
  console.log(`  Average TTFB: ${avgTtfb}ms`);
  const allPass = scored.every((r) => r.passed === r.total);
  process.exit(allPass ? 0 : 1);
}

main();
