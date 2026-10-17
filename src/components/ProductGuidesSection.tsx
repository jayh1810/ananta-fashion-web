import Link from "next/link";
import Image from "next/image";
import { ArrowRight, BookOpen, Clock3, Sparkles } from "lucide-react";
import type { RelatedBlog } from "@/lib/seo/data";

const CARD_TINTS = [
  "from-[#fff7ed] to-[#ffedd5]",
  "from-[#ecfdf5] to-[#d1fae5]",
  "from-[#eff6ff] to-[#dbeafe]",
];

function CoverFallback({ index }: { index: number }) {
  return (
    <div
      className={`absolute inset-0 bg-gradient-to-br ${CARD_TINTS[index % CARD_TINTS.length]} transition-transform duration-500 group-hover:scale-105`}
    >
      <Sparkles
        className="absolute -bottom-3 -right-3 text-ink/10"
        size={72}
        strokeWidth={1}
      />
    </div>
  );
}

function readTimeLabel(minutes?: number | null) {
  if (!minutes || minutes < 1) return null;
  return `${minutes} min read`;
}

function cleanTitle(title: string) {
  return title.replace(/\s*\(local test post\)\s*$/i, "").trim();
}

export function ProductGuidesSection({ posts }: { posts: RelatedBlog[] }) {
  if (!posts.length) return null;

  return (
    <section
      className="border-t border-[#E8E4DC] bg-gradient-to-b from-[#FBF9F6] to-white"
      aria-labelledby="product-guides-heading"
    >
      <div className="mx-auto max-w-[1400px] px-3 sm:px-5 py-10 sm:py-12">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-[#E8E4DC] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-bhagva-deep shadow-sm">
              <BookOpen size={12} aria-hidden />
              Learn more
            </span>
            <h2
              id="product-guides-heading"
              className="mt-3 font-heading text-xl sm:text-2xl font-semibold text-ink text-balance"
            >
              Guides &amp; reading
            </h2>
            <p className="mt-1.5 text-sm text-muted max-w-xl leading-relaxed">
              Explore care and styling tips related to this product.
            </p>
          </div>
          <Link
            href="/blogs"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal hover:text-teal/80 transition-colors shrink-0"
          >
            View all guides
            <ArrowRight size={16} aria-hidden />
          </Link>
        </div>

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post, i) => (
            <li key={post.slug}>
              <article className="group h-full overflow-hidden rounded-2xl border border-[#E8E4DC] bg-white shadow-[0_4px_24px_-12px_rgba(47,54,69,0.12)] hover:shadow-[0_16px_40px_-16px_rgba(47,54,69,0.22)] hover:-translate-y-0.5 transition-all duration-300">
                <Link href={`/blogs/${post.slug}`} className="flex h-full flex-col">
                  <div className="relative h-36 sm:h-40 w-full overflow-hidden bg-cream-dark">
                    {post.coverImage ? (
                      <Image
                        src={post.coverImage}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <CoverFallback index={i} />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>
                  <div className="flex flex-1 flex-col p-4 sm:p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      {post.category?.name ? (
                        <span className="text-[10px] font-bold uppercase tracking-wide text-bhagva-deep">
                          {post.category.name}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-wide text-muted">
                          Guide
                        </span>
                      )}
                      {readTimeLabel(post.readMinutes) ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted">
                          <Clock3 size={10} aria-hidden />
                          {readTimeLabel(post.readMinutes)}
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-2 font-semibold text-ink leading-snug line-clamp-2 group-hover:text-teal transition-colors">
                      {cleanTitle(post.title)}
                    </h3>
                    {post.excerpt ? (
                      <p className="mt-2 text-sm text-muted line-clamp-2 leading-relaxed flex-1">
                        {post.excerpt}
                      </p>
                    ) : null}
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
      </div>
    </section>
  );
}
