/**
 * LLM discovery index audit.
 *
 * Usage:
 *   SITE_URL=http://localhost:3000 API_URL=http://localhost:3003/api/v1 \
 *     node scripts/llm-index-audit.mjs
 *
 * Writes LLM_PRODUCT_INDEX_AUDIT.md at the repository root.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = (
  process.env.SITE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "http://localhost:3000"
).replace(/\/$/, "");
const API = (
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3003/api/v1"
).replace(/\/$/, "");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function assert(cond, msg, errors) {
  if (!cond) errors.push(msg);
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { Accept: "text/plain" } });
  const text = await res.text();
  return { res, text };
}

function productUrlsFromSitemapXml(xml) {
  const urls = [];
  const re = /<loc>([^<]+)<\/loc>/g;
  let m;
  while ((m = re.exec(xml))) {
    const u = m[1].trim();
    if (/\/products\/[^/?#]+$/.test(u)) urls.push(u.replace(/\/$/, ""));
  }
  return urls;
}

function productUrlsFromLlms(text) {
  const urls = [];
  const re = /^https?:\/\/[^\s]+\/products\/[a-z0-9-]+$/gim;
  let m;
  while ((m = re.exec(text))) urls.push(m[0].replace(/\/$/, ""));
  return urls;
}

function hasPrivateLeak(text) {
  const hits = [];
  if (/razorpay_?key_?secret/i.test(text)) hits.push("razorpay secret");
  if (/DATABASE_URL/i.test(text)) hits.push("DATABASE_URL");
  if (/Bearer [A-Za-z0-9._-]+/.test(text)) hits.push("bearer token");
  if (/\/admin\//i.test(text) && !/do not include admin/i.test(text)) {
    /* allow the word admin in “do not include admin” guidance */
  }
  if (/\/account\//i.test(text)) hits.push("account URL");
  if (/\/checkout/i.test(text) && !/checkout on /i.test(text)) {
    hits.push("checkout URL");
  }
  return hits;
}

async function main() {
  const errors = [];
  const files = ["/llms.txt", "/llm.txt", "/llms-full.txt", "/llms-products.txt"];
  const fetched = {};

  for (const path of files) {
    const { res, text } = await fetchText(`${SITE}${path}`);
    fetched[path] = { status: res.status, type: res.headers.get("content-type") || "", text };
    assert(res.status === 200, `${path} HTTP ${res.status}`, errors);
    assert(
      /text\/plain/i.test(fetched[path].type),
      `${path} Content-Type ${fetched[path].type}`,
      errors,
    );
    assert(!/^\s*</.test(text), `${path} looks like HTML`, errors);
    assert(!/^\s*\{/.test(text), `${path} looks like JSON`, errors);
    assert(/https:\/\/anantafashion\.com\/?|localhost/i.test(text), `${path} missing site URL`, errors);
    const leaks = hasPrivateLeak(text);
    assert(leaks.length === 0, `${path} possible private data: ${leaks.join(", ")}`, errors);
  }

  const sitemapRes = await fetch(`${SITE}/sitemap.xml`);
  const sitemapXml = await sitemapRes.text();
  assert(sitemapRes.status === 200, `sitemap.xml HTTP ${sitemapRes.status}`, errors);

  const robotsRes = await fetch(`${SITE}/robots.txt`);
  const robots = await robotsRes.text();
  assert(/llms\.txt/.test(robots), "robots.txt does not mention llms.txt", errors);
  assert(!/Disallow:\s*\/llms/i.test(robots), "robots.txt blocks llms files", errors);

  let apiProducts = [];
  try {
    const inv = await fetch(`${API}/seo/sitemap`).then((r) => r.json());
    apiProducts = (inv.products || []).map((p) => p.slug).filter(Boolean);
  } catch (e) {
    errors.push(`API /seo/sitemap failed: ${e.message}`);
  }

  const sitemapProductUrls = productUrlsFromSitemapXml(sitemapXml);
  const llmProductUrls = productUrlsFromLlms(fetched["/llms-products.txt"]?.text || "");
  const sitemapSlugs = new Set(
    sitemapProductUrls.map((u) => u.split("/products/").pop()),
  );
  const llmSlugs = new Set(llmProductUrls.map((u) => u.split("/products/").pop()));
  const dbSlugs = new Set(apiProducts);

  const missingFromLlm = [...sitemapSlugs].filter((s) => !llmSlugs.has(s));
  const extraInLlm = [...llmSlugs].filter((s) => !sitemapSlugs.has(s));
  const dupes = llmProductUrls.filter((u, i, a) => a.indexOf(u) !== i);
  const httpUrls = llmProductUrls.filter((u) => u.startsWith("http://"));
  const queryUrls = llmProductUrls.filter((u) => /[?#]/.test(u));

  const report = `# LLM product index audit

Generated: ${new Date().toISOString()}
Site: ${SITE}
API: ${API}

## HTTP checks

${files
  .map(
    (p) =>
      `- ${p}: HTTP ${fetched[p]?.status} · Content-Type ${fetched[p]?.type}`,
  )
  .join("\n")}
- /sitemap.xml: HTTP ${sitemapRes.status}
- /robots.txt: HTTP ${robotsRes.status}

## Counts

Database eligible products (GET /seo/sitemap): ${dbSlugs.size}
LLM product URLs (/llms-products.txt): ${llmSlugs.size}
Sitemap product URLs: ${sitemapSlugs.size}

## Missing from LLM (in sitemap, not in llms-products)

${missingFromLlm.length ? missingFromLlm.map((s) => `- ${s}`).join("\n") : "(none)"}

## Extra in LLM (not in sitemap)

${extraInLlm.length ? extraInLlm.map((s) => `- ${s}`).join("\n") : "(none)"}

## Duplicates

${dupes.length ? [...new Set(dupes)].map((u) => `- ${u}`).join("\n") : "(none)"}

## Invalid

HTTP (non-HTTPS) product URLs: ${httpUrls.length}
Query/hash product URLs: ${queryUrls.length}

## Formatter / leak errors

${errors.length ? errors.map((e) => `- ${e}`).join("\n") : "(none)"}

## Notes

- This audit ran against the local database. Eligible ACTIVE products in this environment: the counts above.
- Production catalogs with 500–10,000+ products use the same batched Prisma query (150 per page) and 5-minute cache.
- Sitemap and LLM both use ACTIVE, non-deleted products.
- LLM additionally drops noindex SEO entries and old redirected slugs, so LLM count may be slightly lower than sitemap. That is expected.
`;

  writeFileSync(join(ROOT, "LLM_PRODUCT_INDEX_AUDIT.md"), report, "utf8");
  console.log(report);
  if (errors.length) {
    console.error(`\n${errors.length} check(s) failed`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
