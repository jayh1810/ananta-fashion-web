#!/usr/bin/env node
/**
 * Google Search Console indexing readiness audit.
 *
 * Checks live storefront signals for sample product URLs:
 * HTTP 200, SSR content, canonical, robots, title, meta, JSON-LD, response time.
 *
 * Usage:
 *   cd web && npm run audit:gsc
 *   SAMPLE_SIZE=10 node scripts/audit-gsc-indexing.mjs
 */

const SITE_URL = (process.env.SITE_URL || "https://anantafashion.com").replace(
  /\/$/,
  "",
);
const SAMPLE_SIZE = Math.min(
  25,
  Math.max(3, parseInt(process.env.SAMPLE_SIZE || "8", 10) || 8),
);
const MAX_MS = parseInt(process.env.MAX_RESPONSE_MS || "3500", 10) || 3500;

const FALLBACK_SLUGS = (process.env.SAMPLE_PRODUCT_SLUGS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exitCode = 1;
}

function pass(msg) {
  console.log(`OK: ${msg}`);
}

function warn(msg) {
  console.warn(`WARN: ${msg}`);
}

function extractMeta(html, name) {
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']*)["']`,
    "i",
  );
  const m = html.match(re);
  if (m) return m[1];
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${name}["']`,
    "i",
  );
  return html.match(re2)?.[1] || null;
}

function extractCanonical(html) {
  const m = html.match(
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
  );
  if (m) return m[1];
  return html.match(
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i,
  )?.[1];
}

function extractTitle(html) {
  return html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || null;
}

function jsonLdBlocks(html) {
  return [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(
    (m) => m[1],
  );
}

function hasSchemaType(html, type) {
  for (const block of jsonLdBlocks(html)) {
    try {
      const data = JSON.parse(block);
      const stack = [data];
      while (stack.length) {
        const node = stack.pop();
        if (!node || typeof node !== "object") continue;
        if (node["@type"] === type) return true;
        for (const v of Object.values(node)) {
          if (Array.isArray(v)) stack.push(...v);
          else if (v && typeof v === "object") stack.push(v);
        }
      }
    } catch {
      /* skip invalid */
    }
  }
  return false;
}

async function fetchSitemapProductSlugs(limit) {
  try {
    const indexRes = await fetch(`${SITE_URL}/sitemap.xml`);
    if (!indexRes.ok) return FALLBACK_SLUGS.slice(0, limit);
    const indexXml = await indexRes.text();
    const childUrls = [...indexXml.matchAll(/<loc>([^<]+sitemap\/\d+\.xml)<\/loc>/gi)]
      .map((m) => m[1])
      .filter((u) => !u.includes("/0.xml"));

    for (const childUrl of childUrls.slice(0, 3)) {
      const res = await fetch(childUrl);
      if (!res.ok) continue;
      const xml = await res.text();
      const slugs = [...xml.matchAll(/<loc>[^<]*\/products\/([^<]+)<\/loc>/gi)].map(
        (m) => decodeURIComponent(m[1]),
      );
      if (slugs.length) return slugs.slice(0, limit);
    }
  } catch {
    /* fallback */
  }
  return FALLBACK_SLUGS.slice(0, limit);
}

async function auditProduct(slug) {
  const url = `${SITE_URL}/products/${slug}`;
  const start = Date.now();
  const res = await fetch(url, {
    headers: { "User-Agent": "AnantaFashion-GSC-Audit/1.0" },
    redirect: "follow",
  });
  const ms = Date.now() - start;
  const html = await res.text();

  const issues = [];

  if (res.status !== 200) issues.push(`HTTP ${res.status}`);
  if (ms > MAX_MS) issues.push(`slow ${ms}ms`);

  const canonical = extractCanonical(html);
  if (!canonical) issues.push("missing canonical");
  else if (!canonical.includes(`/products/${slug}`)) {
    issues.push(`canonical mismatch: ${canonical}`);
  }

  const robots = extractMeta(html, "robots") || "";
  if (/noindex/i.test(robots)) issues.push("noindex in meta");

  const title = extractTitle(html);
  if (!title || title.length < 8) issues.push("missing/short title");

  const description = extractMeta(html, "description");
  if (!description || description.length < 40) issues.push("missing/short description");

  if (!hasSchemaType(html, "Product")) issues.push("missing Product JSON-LD");
  if (!hasSchemaType(html, "BreadcrumbList")) issues.push("missing BreadcrumbList JSON-LD");

  if (!html.includes(slug.split("-").slice(0, 2).join("-"))) {
    issues.push("product slug/title not in HTML body");
  }

  if (!html.includes('application/ld+json')) issues.push("no JSON-LD scripts");

  return { slug, url, ms, issues };
}

async function main() {
  console.log(`GSC indexing audit — ${SITE_URL}\n`);

  const slugs = await fetchSitemapProductSlugs(SAMPLE_SIZE);
  pass(`auditing ${slugs.length} product URL(s) from sitemap`);

  let ok = 0;
  let bad = 0;

  for (const slug of slugs) {
    try {
      const result = await auditProduct(slug);
      if (result.issues.length === 0) {
        pass(`${slug} — ${result.ms}ms, canonical/schema/title OK`);
        ok++;
      } else {
        warn(`${slug} — ${result.issues.join("; ")}`);
        bad++;
      }
    } catch (err) {
      fail(`${slug} — ${err.message}`);
      bad++;
    }
  }

  // Sitemap + robots sanity
  const robotsRes = await fetch(`${SITE_URL}/robots.txt`);
  if (robotsRes.ok) {
    const robots = await robotsRes.text();
    if (robots.includes(`${SITE_URL}/sitemap.xml`)) pass("robots.txt declares sitemap");
    else fail("robots.txt missing sitemap declaration");
  } else {
    fail(`robots.txt HTTP ${robotsRes.status}`);
  }

  const smRes = await fetch(`${SITE_URL}/sitemap.xml`);
  if (smRes.ok) pass("sitemap index reachable");
  else fail(`sitemap.xml HTTP ${smRes.status}`);

  console.log(`\nSummary: ${ok} passed, ${bad} with issues (of ${slugs.length})`);
  console.log(
    bad
      ? "\nFix warnings before expecting GSC indexing improvements. Indexing is never guaranteed."
      : "\nTechnical signals look healthy. Submit sitemap in GSC after deploy.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
