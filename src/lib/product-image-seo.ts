import type { Product, ProductImageDetail } from "./api";

const EMPTY: ProductImageDetail = { url: "", altText: "", title: "", caption: "" };

/** Saved per-image SEO text for a gallery URL (empty strings when not set). */
export function productImageDetail(
  product: Pick<Product, "imageDetails">,
  url: string | null | undefined,
): ProductImageDetail {
  const u = String(url || "").trim();
  if (!u) return EMPTY;
  const hit = product.imageDetails?.find((d) => d?.url === u);
  if (!hit) return { ...EMPTY, url: u };
  return {
    url: u,
    altText: String(hit.altText || "").trim(),
    title: String(hit.title || "").trim(),
    caption: String(hit.caption || "").trim(),
  };
}
