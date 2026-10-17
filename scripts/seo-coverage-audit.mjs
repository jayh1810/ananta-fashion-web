#!/usr/bin/env node
/**
 * SEO coverage audit — reads catalog from the Nest API and writes
 * PRODUCT_SEO_COVERAGE_REPORT.md
 *
 * Usage:
 *   node scripts/seo-coverage-audit.mjs
 *   NEXT_PUBLIC_API_URL=https://... node scripts/seo-coverage-audit.mjs
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const API =
  (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3003/api/v1").replace(
    /\/$/,
    "",
  );
const SITE =
  (process.env.NEXT_PUBLIC_SITE_URL || "https://anantafashion.com").replace(
    /\/$/,
    "",
  );

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

async function loadProducts() {
  const out = [];
  let page = 1;
  for (;;) {
    const data = await fetchJson(
      `${API}/products?limit=100&page=${page}&status=ACTIVE`,
    );
    const batch = data?.data || [];
    out.push(...batch);
    const pages = data?.meta?.pageCount || 1;
    if (page >= pages || !batch.length) break;
    page += 1;
  }
  return out;
}

async function loadSitemapSlugs() {
  const slugs = new Set();
  const meta = await fetchJson(`${API}/seo/sitemap?part=meta`);
  const pages = meta?.productPages || 1;
  for (let i = 0; i < pages; i++) {
    const part = await fetchJson(
      `${API}/seo/sitemap?part=products&page=${i}&limit=10000`,
    );
    for (const p of part?.products || []) {
      if (p.slug) slugs.add(p.slug);
    }
  }
  return slugs;
}

function row(product, sitemapSlugs) {
  const url = `${SITE}/products/${product.slug}`;
  const title =
    product.metaTitle?.trim() || product.seo?.title?.trim() || product.title;
  const desc =
    product.metaDescription?.trim() ||
    product.seo?.description?.trim() ||
    product.shortDescription ||
    "";
  return {
    id: product.id,
    name: product.title,
    url,
    category: product.categories?.[0]?.name || "—",
    primary: product.seo?.entities?.primary || product.title,
    concepts: (product.seo?.entities?.concepts || []).slice(0, 5).join(", "),
    seoTitle: title,
    titleLen: title.length,
    metaDescription: String(desc).slice(0, 160),
    descLen: String(desc).length,
    h1: product.title,
    canonical: url,
    hasSchema: Boolean(product.title && product.price != null),
    hasImage: Boolean(product.image),
    imageAlt: product.seo?.primaryImageAlt || product.title,
    indexable: product.seo?.indexable !== false,
    sitemap: sitemapSlugs.has(product.slug),
    merchant: product.seo?.merchantEligible === true,
    related: (product.relatedProductIds || []).length,
  };
}

async function main() {
  const [products, sitemapSlugs] = await Promise.all([
    loadProducts(),
    loadSitemapSlugs(),
  ]);

  const rows = products.map((p) => row(p, sitemapSlugs));
  const indexable = rows.filter((r) => r.indexable);
  const missingMeta = rows.filter((r) => !r.metaDescription || r.descLen < 40);
  const missingSitemap = indexable.filter((r) => !r.sitemap);
  const notMerchant = indexable.filter((r) => !r.merchant);

  const lines = [
    "# Product SEO Coverage Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    `API: ${API}`,
    `Site: ${SITE}`,
    "",
    "## Summary",
    "",
    `| Metric | Count |`,
    `|--------|------:|`,
    `| Products loaded (ACTIVE) | ${products.length} |`,
    `| Indexable (API seo.indexable) | ${indexable.length} |`,
    `| In sitemap | ${rows.filter((r) => r.sitemap).length} |`,
    `| Merchant eligible | ${rows.filter((r) => r.merchant).length} |`,
    `| Missing/short meta description | ${missingMeta.length} |`,
    `| Indexable but missing sitemap | ${missingSitemap.length} |`,
    "",
    "## Indexable products missing from sitemap",
    "",
  ];

  if (missingSitemap.length) {
    for (const r of missingSitemap.slice(0, 50)) {
      lines.push(`- ${r.name} — ${r.url}`);
    }
    if (missingSitemap.length > 50) {
      lines.push(`- … and ${missingSitemap.length - 50} more`);
    }
  } else {
    lines.push("_None — sitemap matches indexable catalog._");
  }

  lines.push("", "## Product coverage", "", "| Product | URL | Category | SEO title | Desc | Sitemap | Merchant |", "|---------|-----|----------|-----------|------|---------|----------|");

  for (const r of rows.slice(0, 200)) {
    lines.push(
      `| ${r.name.replace(/\|/g, "/")} | ${r.url} | ${r.category} | ${r.seoTitle.slice(0, 48).replace(/\|/g, "/")} | ${r.descLen} | ${r.sitemap ? "yes" : "no"} | ${r.merchant ? "yes" : "no"} |`,
    );
  }
  if (rows.length > 200) {
    lines.push("", `_Showing first 200 of ${rows.length} products._`);
  }

  lines.push("", "## Notes", "", "- Merchant eligible excludes free/zero-price products by design.", "- Sitemap uses the same indexability rules as LLM product indexes.", "");

  const outPath = path.join(ROOT, "PRODUCT_SEO_COVERAGE_REPORT.md");
  await fs.writeFile(outPath, lines.join("\n"), "utf8");
  console.log(`Wrote ${outPath} (${products.length} products)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
