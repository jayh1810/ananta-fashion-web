import type { Product } from "@/lib/api";
import { sanitizeProductHtml } from "@/lib/sanitize-html";
import { buildProductContentSections } from "@/lib/seo/product-content";
import { stripHtml } from "@/lib/seo";

/**
 * Server-rendered semantic product content for crawlers and accessibility.
 * Supplements the interactive PDP — sections appear only when DB data exists.
 */
export function ProductSeoContent({ product }: { product: Product }) {
  const sections = buildProductContentSections(product);
  if (!sections.length) return null;

  const reviewCount = product.reviewList?.filter((r) => r.body?.trim()).length ?? 0;
  const avgRating =
    reviewCount > 0
      ? Math.round(
          ((product.reviewList || [])
            .filter((r) => r.body?.trim())
            .reduce((s, r) => s + (r.rating || 0), 0) /
            reviewCount) *
            10,
        ) / 10
      : null;

  return (
    <section
      className="hidden"
      aria-hidden="true"
    >
        {sections.map((section) => (
          <article key={section.id} id={`seo-product-${section.id}`}>
            <h2 className="text-base font-semibold">{section.title}</h2>
            {section.html ? (
              <div
                className="product-desc text-sm leading-relaxed"
                dangerouslySetInnerHTML={{
                  __html: sanitizeProductHtml(section.body),
                }}
              />
            ) : (
              <p className="text-sm leading-relaxed whitespace-pre-line">
                {section.body}
              </p>
            )}
          </article>
        ))}

      {reviewCount > 0 && avgRating ? (
        <div>
          <h2>Customer reviews</h2>
          <p>
            {avgRating} out of 5 based on {reviewCount} review
            {reviewCount === 1 ? "" : "s"}.
          </p>
          <ul>
            {(product.reviewList || [])
              .filter((r) => stripHtml(r.body).length >= 8)
              .slice(0, 5)
              .map((r) => (
                <li key={r.id}>
                  <p>
                    {r.authorName?.trim() || "Customer"}
                    {r.rating ? ` — ${r.rating}/5` : ""}
                  </p>
                  <p>{stripHtml(r.body)}</p>
                </li>
              ))}
          </ul>
        </div>
      ) : null}

      {product.seo?.searchTerms?.length ? (
        <p className="sr-only">
          Related topics: {product.seo.searchTerms.join(", ")}
        </p>
      ) : null}
    </section>
  );
}
