import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Sparkles, Star } from "lucide-react";
import { formatINR } from "@/lib/api";
import {
  FreeCornerBadge,
  FreePriceLabel,
} from "@/components/FreeProductBadge";

export type BlogRelatedProduct = {
  title: string;
  slug: string;
  image?: string;
  price?: number;
  compareAt?: number;
  rating?: number;
  reviews?: number;
  isFreeProduct?: boolean;
};

export type BlogRelatedPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  category: { name: string; slug: string } | null;
  readMinutes: number | null;
};

const CARD_TINTS = [
  "from-[#fff7ed] to-[#ffedd5]",
  "from-[#ecfdf5] to-[#d1fae5]",
  "from-[#eff6ff] to-[#dbeafe]",
];

function readTimeLabel(minutes?: number | null) {
  if (!minutes || minutes < 1) return null;
  return `${minutes} min read`;
}

function CoverFallback({ index }: { index: number }) {
  return (
    <div
      className={`absolute inset-0 bg-gradient-to-br ${CARD_TINTS[index % CARD_TINTS.length]}`}
    >
      <Sparkles
        className="absolute -bottom-2 -right-2 text-ink/10"
        size={64}
        strokeWidth={1}
      />
    </div>
  );
}

function ProductStars({ rating, size = 10 }: { rating: number; size?: number }) {
  const full = Math.min(5, Math.max(0, Math.round(rating || 5)));
  return (
    <div className="flex items-center gap-px" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={size}
          className={
            i < full ? "fill-[#E8B923] text-[#E8B923]" : "fill-none text-[#E8B923]"
          }
        />
      ))}
    </div>
  );
}

function SectionHeading({
  id,
  title,
  linkHref,
  linkLabel,
}: {
  id: string;
  title: string;
  linkHref: string;
  linkLabel: string;
}) {
  return (
    <div className="mb-5 sm:mb-6 text-center">
      <h2
        id={id}
        className="font-heading text-xl sm:text-2xl font-semibold text-black"
      >
        {title}
      </h2>
      <p className="mt-2">
        <Link
          href={linkHref}
          className="inline-flex items-center gap-1 text-sm font-semibold text-teal hover:text-teal/80 transition-colors"
        >
          {linkLabel}
          <ArrowRight size={14} aria-hidden />
        </Link>
      </p>
    </div>
  );
}

/** PDP-style product rail — matches “You May Also Like” on product pages. */
function RelatedProductRail({
  products,
  shopCollection,
  showRatings,
}: {
  products: BlogRelatedProduct[];
  shopCollection?: { slug: string; name: string } | null;
  showRatings: boolean;
}) {
  return (
    <section className="w-full" aria-labelledby="blog-related-products">
      <SectionHeading
        id="blog-related-products"
        title="Shop related products"
        linkHref={
          shopCollection
            ? `/collections/${shopCollection.slug}`
            : "/collections/all"
        }
        linkLabel={
          shopCollection
            ? `View ${shopCollection.name}`
            : "Browse all products"
        }
      />

      <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
        {products.map((p) => {
          const price = p.price ?? 0;
          const compareAt = p.compareAt ?? 0;
          const showCompare =
            compareAt > price && !(p.isFreeProduct && price <= 0);
          const reviewCount = p.reviews ?? 0;

          return (
            <li key={p.slug} className="flex min-w-0">
              <Link
                href={`/products/${p.slug}`}
                className="group flex h-full w-full min-w-0 flex-col"
              >
                <div className="relative aspect-square overflow-hidden rounded-2xl bg-[#F3F1EC]">
                  {p.image ? (
                    <Image
                      src={p.image}
                      alt={p.title}
                      fill
                      sizes="(max-width:768px) 50vw, (max-width:1024px) 33vw, 25vw"
                      className="object-cover transition group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-cream to-cream-dark" />
                  )}
                  {p.isFreeProduct && price <= 0 ? <FreeCornerBadge /> : null}
                </div>

                <div className="mt-2.5 flex flex-1 flex-col">
                  <p className="line-clamp-2 min-h-[2.5em] font-heading text-[13px] sm:text-sm font-semibold text-black leading-snug group-hover:text-teal transition-colors">
                    {p.title}
                  </p>

                  {showRatings ? (
                    <div className="mt-1.5 flex items-center gap-1 sm:gap-1.5">
                      <div className="sm:hidden">
                        <ProductStars rating={p.rating || 5} size={9} />
                      </div>
                      <div className="hidden sm:block">
                        <ProductStars rating={p.rating || 5} size={11} />
                      </div>
                      <span className="text-[10px] sm:text-[11px] text-[#808080] leading-tight">
                        {reviewCount.toLocaleString("en-IN")} review
                        {reviewCount === 1 ? "" : "s"}
                      </span>
                    </div>
                  ) : null}

                  <p className="mt-auto pt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px] sm:text-sm">
                    {p.isFreeProduct && price <= 0 ? (
                      <>
                        <FreePriceLabel size="sm" />
                        {compareAt > 0 ? (
                          <span className="text-[#9CA3AF] line-through text-[12px] tabular-nums">
                            {formatINR(compareAt)}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <span className="font-bold tabular-nums">
                          {formatINR(price)}
                        </span>
                        {showCompare ? (
                          <span className="text-[#9CA3AF] line-through text-[12px] tabular-nums">
                            {formatINR(compareAt)}
                          </span>
                        ) : null}
                      </>
                    )}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function BlogPostRelatedSections({
  products,
  posts,
  shopCollection,
  showRatings = true,
}: {
  products: BlogRelatedProduct[];
  posts: BlogRelatedPost[];
  shopCollection?: { slug: string; name: string } | null;
  showRatings?: boolean;
}) {
  if (!products.length && !posts.length) return null;

  return (
    <div className="mt-12 sm:mt-14 border-t border-[#E8E4DC] pt-10 sm:pt-12">
      {products.length > 0 ? (
        <RelatedProductRail
          products={products}
          shopCollection={shopCollection}
          showRatings={showRatings}
        />
      ) : null}

      {posts.length > 0 ? (
        <section
          className={`w-full ${products.length > 0 ? "mt-12 sm:mt-14 pt-10 sm:pt-12 border-t border-[#E8E4DC]" : ""}`}
          aria-labelledby="blog-keep-reading"
        >
          <SectionHeading
            id="blog-keep-reading"
            title="Keep reading"
            linkHref="/blogs"
            linkLabel="All articles"
          />

          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
            {posts.map((r, i) => (
              <li key={r.id} className="flex min-w-0">
                <article className="group flex h-full w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-[#E8E4DC] bg-white shadow-[0_4px_24px_-12px_rgba(47,54,69,0.12)] hover:shadow-[0_16px_40px_-16px_rgba(47,54,69,0.22)] hover:-translate-y-0.5 transition-all duration-300">
                  <Link href={`/blogs/${r.slug}`} className="flex h-full flex-col">
                    <div className="relative h-40 sm:h-44 lg:h-48 w-full shrink-0 overflow-hidden bg-cream-dark">
                      {r.coverImage ? (
                        <Image
                          src={r.coverImage}
                          alt=""
                          fill
                          sizes="(max-width:640px) 100vw, 33vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <CoverFallback index={i} />
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-4 sm:p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        {r.category?.name ? (
                          <span className="text-[10px] font-bold uppercase tracking-wide text-bhagva-deep">
                            {r.category.name}
                          </span>
                        ) : null}
                        {readTimeLabel(r.readMinutes) ? (
                          <span className="text-[10px] text-muted">
                            {readTimeLabel(r.readMinutes)}
                          </span>
                        ) : null}
                      </div>
                      <h3 className="mt-2 font-heading font-semibold text-ink leading-snug line-clamp-2 group-hover:text-teal transition-colors">
                        {r.title}
                      </h3>
                      {r.excerpt ? (
                        <p className="mt-2 text-sm text-muted line-clamp-2 leading-relaxed flex-1">
                          {r.excerpt}
                        </p>
                      ) : (
                        <div className="flex-1" />
                      )}
                      <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-ink group-hover:text-teal transition-colors">
                        Read article
                        <ArrowRight
                          size={14}
                          className="transition-transform group-hover:translate-x-0.5"
                          aria-hidden
                        />
                      </span>
                    </div>
                  </Link>
                </article>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
