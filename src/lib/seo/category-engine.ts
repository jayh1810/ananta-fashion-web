/** Category/collection SEO — mirrors api/src/seo/product-seo.engine.ts */
import { SITE_NAME as BRAND } from "./constants";

function truncate(text: string, max: number) {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

function stripHtml(raw?: string | null) {
  return String(raw || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildCategorySeoTitle(input: {
  name?: string | null;
  slug?: string | null;
  seoTitle?: string | null;
  productCount?: number;
}): string {
  const manual = String(input.seoTitle || "").trim();
  if (manual) return manual;
  const name = String(input.name || input.slug || "").trim();
  if (!name) return BRAND;
  const count = Number(input.productCount) || 0;
  if (count > 0) return truncate(`${name} – Shop ${count}+ Products`, 60);
  return truncate(`${name} – Shop Online`, 60);
}

export function buildCategorySeoDescription(input: {
  name?: string | null;
  slug?: string | null;
  description?: string | null;
  seoDescription?: string | null;
}): string {
  const manual = String(input.seoDescription || "").trim();
  if (manual) return truncate(manual, 160);
  const name = String(input.name || input.slug || "").trim();
  const body = stripHtml(input.description);
  if (body.length >= 40) return truncate(body, 160);
  if (name) {
    return truncate(
      `Shop ${name} online at ${BRAND}. Top brands, genuine products and shipping across India.`,
      160,
    );
  }
  return truncate(
    `Shop fashion, beauty and lifestyle products online at ${BRAND} with shipping across India.`,
    160,
  );
}
