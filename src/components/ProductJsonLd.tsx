import type { Product } from "@/lib/api";
import { buildProductJsonLd } from "@/lib/product-schema";

/**
 * Google Product JSON-LD (merchant listings: priceValidUntil, shipping, returns).
 * Server-only — render from the product page so the markup is in the HTML source.
 */
export function ProductJsonLd({
  product,
  description,
}: {
  product: Product;
  description: string;
}) {
  const data = buildProductJsonLd(product, description);
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
