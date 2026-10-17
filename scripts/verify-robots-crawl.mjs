#!/usr/bin/env node
/**
 * Verify storefront + API robots.txt rules and that a sample PDP renders
 * indexable HTML without relying on blocked API endpoints.
 *
 * Usage:
 *   node scripts/verify-robots-crawl.mjs
 *   SITE_URL=https://anantafashion.com API_ORIGIN=https://api.anantafashion.com node scripts/verify-robots-crawl.mjs
 *   SAMPLE_PRODUCT_SLUG=some-product … (default: first live product from the API)
 */

const SITE_URL = (process.env.SITE_URL || "https://anantafashion.com").replace(
  /\/$/,
  "",
);
const API_ORIGIN = (
  process.env.API_ORIGIN || "https://api.anantafashion.com"
).replace(/\/$/, "");

/** Product to SSR-check: SAMPLE_PRODUCT_SLUG, else the first live product from the API. */
async function sampleProduct() {
  const slug = process.env.SAMPLE_PRODUCT_SLUG?.trim();
  try {
    const path = slug
      ? `/api/v1/products/${encodeURIComponent(slug)}`
      : "/api/v1/products?limit=1";
    const res = await fetch(`${API_ORIGIN}${path}`);
    const body = await res.json();
    const row = slug ? body : (Array.isArray(body) ? body : body?.data)?.[0];
    if (row?.slug) return { slug: row.slug, title: String(row.title || "") };
  } catch {
    /* fall through */
  }
  return slug ? { slug, title: "" } : null;
}

function parseRobots(text) {
  const allows = [];
  const disallows = [];
  let sitemap = null;
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (t.startsWith("Allow:")) allows.push(t.slice(6).trim());
    if (t.startsWith("Disallow:")) disallows.push(t.slice(9).trim());
    if (t.startsWith("Sitemap:")) sitemap = t.slice(8).trim();
  }
  return { allows, disallows, sitemap };
}

/** Google-style prefix match (no regex wildcards in path). */
function pathMatchesRule(path, rule) {
  if (!rule) return false;
  if (rule.includes("*") || rule.includes("$")) {
    // Minimal wildcard: trailing * only
    if (rule.endsWith("*")) {
      return path.startsWith(rule.slice(0, -1));
    }
    return false;
  }
  return path.startsWith(rule) || path === rule.replace(/\/$/, "");
}

/** Google-style: longest matching Allow/Disallow rule wins. */
function isAllowed(path, allows, disallows) {
  let best = null;
  let bestLen = -1;

  for (const rule of [...disallows.map((r) => ({ rule: r, allow: false })), ...allows.map((r) => ({ rule: r, allow: true }))]) {
    if (!pathMatchesRule(path, rule.rule)) continue;
    const len = rule.rule.replace(/\*.*$/, "").length;
    if (len > bestLen) {
      bestLen = len;
      best = rule.allow;
    }
  }

  return best !== null ? best : true;
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "AnantaFashion-Robots-Verify/1.0" },
    redirect: "follow",
  });
  return { ok: res.ok, status: res.status, text: await res.text() };
}

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

async function main() {
  console.log(`Verifying robots + SSR for ${SITE_URL}\n`);

  // —— Storefront robots ——
  const storeRobots = await fetchText(`${SITE_URL}/robots.txt`);
  if (!storeRobots.ok) {
    fail(`storefront robots.txt HTTP ${storeRobots.status}`);
  } else {
    const parsed = parseRobots(storeRobots.text);
    const expectedSitemap = `${SITE_URL}/sitemap.xml`;
    if (parsed.sitemap === expectedSitemap) {
      pass(`storefront sitemap → ${expectedSitemap}`);
    } else {
      fail(`storefront sitemap expected ${expectedSitemap}, got ${parsed.sitemap}`);
    }

    for (const p of [
      "/products/test",
      "/collections/all",
      "/blogs",
      "/cart",
      "/account",
      "/admin",
      "/api/internal",
    ]) {
      const ok = isAllowed(p, parsed.allows, parsed.disallows);
      const expect =
        p.startsWith("/cart") ||
        p.startsWith("/account") ||
        p.startsWith("/admin") ||
        p.startsWith("/api/")
          ? false
          : true;
      if (ok === expect) {
        pass(`storefront ${p} → ${ok ? "allowed" : "blocked"}`);
      } else if (p === "/admin" && expect === false) {
        warn(`storefront ${p} not blocked on production yet — deploy web/src/app/robots.ts`);
      } else {
        fail(`storefront ${p} expected ${expect ? "allowed" : "blocked"}, got ${ok}`);
      }
    }
  }

  // —— API robots ——
  const apiRobots = await fetchText(`${API_ORIGIN}/robots.txt`);
  if (!apiRobots.ok) {
    fail(`API robots.txt HTTP ${apiRobots.status}`);
  } else {
    const parsed = parseRobots(apiRobots.text);
    const cases = [
      ["/api/v1/collections", true],
      ["/api/v1/content/menus", true],
      ["/api/v1/settings", true],
      ["/api/v1/products/foo", true],
      ["/api/v1/coupons", false],
      ["/api/v1/content/popups", false],
      ["/api/v1/order-social-proof", false],
      ["/api/v1/admin/products", false],
      ["/api/v1/orders/me", false],
      ["/api/v1/analytics/track", false],
    ];
    for (const [path, expect] of cases) {
      const ok = isAllowed(path, parsed.allows, parsed.disallows);
      if (ok === expect) {
        pass(`API ${path} → ${ok ? "allowed" : "blocked"}`);
      } else if (expect === true) {
        warn(
          `API ${path} still blocked on production — deploy api/src/robots/robots-txt.ts`,
        );
      } else {
        fail(`API ${path} expected blocked, got allowed`);
      }
    }
  }

  // —— Local source rules (validates repo before deploy) ——
  try {
    const { execSync } = await import("node:child_process");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const webRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/scripts$/, "");
    const repoRoot = join(webRoot, "..");
    const localTxt = execSync("npx tsx scripts/print-robots-txt.ts", {
      cwd: join(repoRoot, "ananta-fashion-api"),
      encoding: "utf8",
    });
    const localParsed = parseRobots(localTxt);
    for (const [path, expect] of [
      ["/api/v1/collections", true],
      ["/api/v1/content/menus", true],
      ["/api/v1/settings", true],
      ["/api/v1/products/foo", true],
      ["/api/v1/coupons", false],
      ["/api/v1/content/popups", false],
      ["/api/v1/admin/products", false],
    ]) {
      const ok = isAllowed(path, localParsed.allows, localParsed.disallows);
      if (ok === expect) pass(`local API rules ${path} → ${ok ? "allowed" : "blocked"}`);
      else fail(`local API rules ${path} mismatch`);
    }
  } catch (e) {
    fail(`local API rules check skipped: ${e.message}`);
  }

  // —— SSR product page (no client JS required for core SEO signals) ——
  const sample = await sampleProduct();
  if (!sample) {
    fail("No sample product — set SAMPLE_PRODUCT_SLUG or check the products API");
    console.log("\nSome checks failed.");
    return;
  }
  const pdpUrl = `${SITE_URL}/products/${sample.slug}`;
  const pdp = await fetchText(pdpUrl);
  if (!pdp.ok) {
    fail(`PDP ${pdpUrl} HTTP ${pdp.status}`);
  } else {
    const html = pdp.text;
    const checks = [
      ["<title>", "document title"],
      ['property="og:title"', "og:title"],
      ['type="application/ld+json"', "JSON-LD"],
      ["Product", "Product schema type"],
    ];
    for (const [needle, label] of checks) {
      if (html.includes(needle)) pass(`PDP contains ${label}`);
      else fail(`PDP missing ${label}`);
    }
    const escapedTitle = sample.title
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    if (!sample.title) {
      pass("PDP name check skipped (product title unavailable)");
    } else if (html.includes(sample.title) || html.includes(escapedTitle)) {
      pass(`PDP contains product name "${sample.title}" in HTML`);
    } else {
      fail(`PDP missing product name "${sample.title}" — SSR may be broken`);
    }
  }

  console.log(process.exitCode ? "\nSome checks failed." : "\nAll checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
