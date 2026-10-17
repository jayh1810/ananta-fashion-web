/**
 * Validate Product + Offer + Breadcrumb JSON-LD on live product URLs.
 *
 * Usage:
 *   node scripts/validate-product-schema.mjs
 *   SCHEMA_VALIDATE_URL=https://anantafashion.com/products/foo node scripts/validate-product-schema.mjs
 *   SCHEMA_VALIDATE_URLS=https://…/products/a,https://…/products/b node scripts/validate-product-schema.mjs
 */
const DEFAULT_URLS = (process.env.SCHEMA_VALIDATE_URLS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function extractJsonLd(html) {
  const blocks = [];
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      blocks.push(JSON.parse(m[1]));
    } catch {
      /* ignore */
    }
  }
  return blocks;
}

function validateProduct(product, canonical, visiblePrice) {
  const issues = [];
  if (!product) return ["MISSING Product JSON-LD"];
  if (product["@context"] !== "https://schema.org") issues.push("bad @context");
  if (product["@type"] !== "Product") issues.push("bad @type");
  if (!product.name) issues.push("missing name");
  if (!product.description) issues.push("missing description");
  if (!product.url) issues.push("missing url");
  if (canonical && product.url !== canonical) issues.push("product.url != canonical");
  if (!product.image) issues.push("missing image");
  if (!product.brand?.name) issues.push("missing brand");
  if (!product.offers) issues.push("missing offers");
  else {
    const o = product.offers;
    if (!o.url) issues.push("offer missing url");
    if (o.url && canonical && o.url !== canonical) issues.push("offer.url != canonical");
    if (o.priceCurrency !== "INR") issues.push(`currency ${o.priceCurrency}`);
    if (!o.availability?.startsWith("https://schema.org/")) issues.push("bad availability");
    if (!o.itemCondition?.startsWith("https://schema.org/")) issues.push("bad itemCondition");
    const t = o["@type"];
    if (t === "Offer" && !o.price) issues.push("Offer missing price");
    if (t === "AggregateOffer" && !o.lowPrice) issues.push("AggregateOffer missing lowPrice");
    for (const key of ["price", "lowPrice", "highPrice"]) {
      const val = o[key];
      if (val == null || val === "") continue;
      if (!/^\d+(\.\d{1,2})?$/.test(String(val))) {
        issues.push(`invalid ${key} format ${val}`);
      }
    }
    if (visiblePrice && t === "Offer" && o.price) {
      const schemaP = Number(o.price);
      const visibleP = Number(visiblePrice.replace(/[^\d]/g, ""));
      if (Number.isFinite(schemaP) && Number.isFinite(visibleP) && schemaP !== visibleP) {
        issues.push(`price mismatch schema ${schemaP} vs visible ${visibleP}`);
      }
    }
  }
  if (product.aggregateRating && !(product.review?.length > 0)) {
    issues.push("aggregateRating without review[]");
  }
  if (product.review?.length && !product.aggregateRating) {
    issues.push("review[] without aggregateRating");
  }
  if (product.aggregateRating && product.review?.length) {
    if (product.aggregateRating.reviewCount !== product.review.length) {
      issues.push(
        `reviewCount ${product.aggregateRating.reviewCount} != review items ${product.review.length}`,
      );
    }
  }
  return issues;
}

async function check(url) {
  const res = await fetch(url, {
    headers: { Accept: "text/html", "User-Agent": "SchemaValidator/1.0" },
  });
  const html = await res.text();
  const ld = extractJsonLd(html);
  const product = ld.find((n) => n["@type"] === "Product");
  const breadcrumb = ld.find((n) => n["@type"] === "BreadcrumbList");
  const canonical = html.match(/rel="canonical" href="([^"]+)"/)?.[1];
  const visiblePrice = html.match(/₹[\d,]+/)?.[0];
  const productIssues = validateProduct(product, canonical, visiblePrice);
  const breadcrumbIssues = [];
  if (!breadcrumb) breadcrumbIssues.push("MISSING BreadcrumbList");
  else if (breadcrumb["@context"] !== "https://schema.org") {
    breadcrumbIssues.push("breadcrumb bad @context");
  }
  return {
    url,
    status: res.status,
    ok: productIssues.length === 0 && breadcrumbIssues.length === 0,
    productIssues,
    breadcrumbIssues,
    offerType: product?.offers?.["@type"],
    price: product?.offers?.price || product?.offers?.lowPrice,
    visiblePrice,
    reviews: product?.review?.length || 0,
    hasRating: Boolean(product?.aggregateRating),
  };
}

const urls = process.env.SCHEMA_VALIDATE_URL
  ? [process.env.SCHEMA_VALIDATE_URL]
  : DEFAULT_URLS;

if (!urls.length) {
  console.error("Set SCHEMA_VALIDATE_URL or SCHEMA_VALIDATE_URLS (comma-separated product URLs).");
  process.exit(1);
}

let failed = 0;
console.log(`Validating ${urls.length} product URL(s)…\n`);

for (const url of urls) {
  const r = await check(url);
  const mark = r.ok ? "OK" : "FAIL";
  console.log(`${mark}  ${url}`);
  if (r.productIssues.length) console.log(`      Product: ${r.productIssues.join("; ")}`);
  if (r.breadcrumbIssues.length) console.log(`      Breadcrumb: ${r.breadcrumbIssues.join("; ")}`);
  if (r.ok) {
    console.log(
      `      ${r.offerType} price=${r.price} visible=${r.visiblePrice} reviews=${r.reviews} rating=${r.hasRating}`,
    );
  }
  if (!r.ok) failed += 1;
}

console.log(`\n${urls.length - failed}/${urls.length} passed`);
process.exitCode = failed ? 1 : 0;
