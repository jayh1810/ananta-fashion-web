/**
 * Optional live HTTP SEO checks.
 * Set SEO_TEST_ORIGIN (e.g. http://localhost:3000) to run against a running storefront.
 * Skips cleanly when the origin is unset or unreachable.
 */
import assert from "node:assert/strict";
import test from "node:test";

const ORIGIN = (process.env.SEO_TEST_ORIGIN || "").replace(/\/$/, "");

async function get(path) {
  const res = await fetch(`${ORIGIN}${path}`, {
    redirect: "manual",
    headers: { Accept: "text/html" },
  });
  const html = await res.text();
  return { status: res.status, html };
}

function jsonLdBlocks(html) {
  const blocks = [];
  const re =
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      blocks.push(JSON.parse(m[1]));
    } catch {
      /* ignore invalid */
    }
  }
  return blocks;
}

test("live SEO routes (optional)", async (t) => {
  if (!ORIGIN) {
    t.skip("SEO_TEST_ORIGIN not set");
    return;
  }
  let home;
  try {
    home = await get("/");
  } catch {
    t.skip(`${ORIGIN} is not reachable`);
    return;
  }

  assert.equal(home.status, 200);
  assert.match(home.html, /<h1[\s>]/i);
  assert.match(home.html, /<title>/i);
  assert.match(home.html, /rel="canonical"/i);

  const missing = await get("/products/this-slug-does-not-exist-seo-test");
  assert.equal(missing.status, 404);

  const productMatch = home.html.match(/href="(\/products\/[^"]+)"/);
  if (productMatch) {
    const pdp = await get(productMatch[1]);
    assert.equal(pdp.status, 200);
    assert.match(pdp.html, /<h1[\s>]/i);
    assert.match(pdp.html, /rel="canonical"/i);
    const ld = jsonLdBlocks(pdp.html);
    assert.ok(ld.some((n) => n["@type"] === "Product"));
    assert.ok(ld.some((n) => n["@type"] === "BreadcrumbList"));
  }

  const blogs = await get("/blogs");
  assert.equal(blogs.status, 200);

  const robots = await fetch(`${ORIGIN}/robots.txt`);
  const robotsTxt = await robots.text();
  assert.match(robotsTxt, /Allow: \/_next\/image/);
  assert.match(robotsTxt, /Disallow: \/checkout/);
  assert.doesNotMatch(robotsTxt, /Disallow: \/products/);
});
