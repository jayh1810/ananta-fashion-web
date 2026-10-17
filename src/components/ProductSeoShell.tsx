import type { Product } from "@/lib/api";
import { formatINR } from "@/lib/api";
import {
  getAvailabilityLabel,
  getDefaultPackIndex,
  getDisplayPrice,
} from "@/lib/product-packs";
import { productSeoDescription } from "@/lib/seo";

/**
 * Server-rendered product facts for crawlers — present in initial HTML without
 * requiring client JavaScript. Visually hidden to avoid duplicating PDP UI.
 *
 * Do not emit schema.org microdata here. Product JSON-LD is the single Product
 * graph; a second Offer with `₹` in `price` is flagged by GSC as invalid.
 */
export function ProductSeoShell({ product }: { product: Product }) {
  const packIdx = getDefaultPackIndex(product);
  const price = getDisplayPrice(product, packIdx);
  const availability = getAvailabilityLabel(product, packIdx);
  const description = productSeoDescription(product);

  return (
    <div className="hidden" aria-hidden="true">
      <p>{product.title}</p>
      {description ? <p>{description}</p> : null}
      <p>
        Price {formatINR(price)} INR.{" "}
        {availability === "InStock" ? "In stock" : "Out of stock"}.
      </p>
    </div>
  );
}
