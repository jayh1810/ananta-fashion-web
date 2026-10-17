import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Clock3, Sparkles } from "lucide-react";
import { metadataForPath, SEO_API_URL, SITE_NAME } from "@/lib/seo";

export const revalidate = 300;

type BlogCategory = { id: string; name: string; slug: string };

type BlogPostCard = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  category: BlogCategory | null;
  tags: string[];
  readMinutes: number | null;
  isFeatured: boolean;
  publishedAt: string | null;
};

type BlogsResponse = {
  data: BlogPostCard[];
  meta: { total: number; page: number; limit: number; pages: number };
};

async function getIntro(): Promise<string> {
  try {
    const res = await fetch(`${SEO_API_URL}/settings`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error("bad status");
    const s = (await res.json()) as { store?: { blogsIntro?: string } };
    return (
      s.store?.blogsIntro ||
      "Style guides, beauty tips and the latest trends."
    );
  } catch {
    return "Style guides, beauty tips and the latest trends.";
  }
}

async function getCategories(): Promise<BlogCategory[]> {
  try {
    const res = await fetch(`${SEO_API_URL}/content/blog-categories`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

async function getPosts(
  page: number,
  category?: string,
): Promise<BlogsResponse> {
  try {
    const params = new URLSearchParams({ page: String(page), limit: "9" });
    if (category) params.set("category", category);
    const res = await fetch(
      `${SEO_API_URL}/content/blogs?${params.toString()}`,
      { next: { revalidate: 300, tags: ["blogs"] } },
    );
    if (!res.ok) throw new Error("bad status");
    return (await res.json()) as BlogsResponse;
  } catch {
    return { data: [], meta: { total: 0, page: 1, limit: 9, pages: 1 } };
  }
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; category?: string }>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || "1", 10) || 1);
  const category = sp.category?.trim();
  const intro = await getIntro();
  const filtered = !!category || page > 1;
  return metadataForPath("/blogs", {
    title: "Blogs — Fashion & Beauty Guides",
    description: intro,
    noIndex: filtered,
  });
}

function readTimeLabel(minutes: number | null) {
  if (!minutes) return null;
  return `${minutes} min read`;
}

const CARD_TINTS = [
  "from-bhagva-soft to-cream-dark",
  "from-cream to-cream-dark",
  "from-[#e9f5f2] to-cream-dark",
];

function CoverFallback({ index }: { index: number }) {
  return (
    <div
      className={`absolute inset-0 bg-gradient-to-br ${CARD_TINTS[index % CARD_TINTS.length]} transition-transform duration-500 group-hover:scale-105`}
    >
      <Sparkles
        className="absolute -bottom-3 -right-3 text-ink/10"
        size={90}
        strokeWidth={1}
      />
    </div>
  );
}

export default async function BlogsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; category?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || "1", 10) || 1);
  const category = sp.category?.trim() || undefined;

  const [intro, categories, posts] = await Promise.all([
    getIntro(),
    getCategories(),
    getPosts(page, category),
  ]);

  const activeCategory = categories.find((c) => c.slug === category);

  return (
    <div>
      {/* —— Hero —— */}
      <div className="relative overflow-hidden bg-ink">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(255,153,51,0.28),transparent_45%),radial-gradient(circle_at_85%_0%,rgba(16,132,116,0.28),transparent_40%)]" />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1.5px)",
            backgroundSize: "22px 22px",
          }}
        />
        <div className="relative z-10 mx-auto max-w-[1400px] px-3 sm:px-5 py-12 sm:py-16">
          <span className="blog-fade-up inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-bhagva">
            <Sparkles size={12} /> {SITE_NAME} Guides
          </span>
          <h1
            className="blog-fade-up mt-3 text-3xl sm:text-5xl font-extrabold text-white text-balance"
            style={{ animationDelay: "0.06s" }}
          >
            Blogs
          </h1>
          <p
            className="blog-fade-up mt-3 text-sm sm:text-base text-white/70 max-w-2xl"
            style={{ animationDelay: "0.12s" }}
          >
            {intro}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] px-3 sm:px-5 py-8 sm:py-12">
        {!!categories.length && (
          <div className="blog-fade-up flex flex-wrap gap-2 mb-8 -mt-2">
            <Link
              href="/blogs"
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                !category
                  ? "bg-ink text-white border-ink"
                  : "border-border text-ink/70 hover:border-bhagva hover:text-bhagva-deep"
              }`}
            >
              All posts
            </Link>
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/blogs?category=${encodeURIComponent(c.slug)}`}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  category === c.slug
                    ? "bg-ink text-white border-ink"
                    : "border-border text-ink/70 hover:border-bhagva hover:text-bhagva-deep"
                }`}
              >
                {c.name}
              </Link>
            ))}
          </div>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {posts.data.map((post, i) => (
            <article
              key={post.id}
              className="blog-fade-up group border border-border rounded-2xl overflow-hidden bg-white hover:shadow-[0_16px_40px_-16px_rgba(47,54,69,0.25)] hover:-translate-y-1 transition-all duration-300"
              style={{ animationDelay: `${Math.min(i, 6) * 0.06}s` }}
            >
              <Link href={`/blogs/${post.slug}`} className="block">
                <div className="relative h-40 sm:h-44 w-full overflow-hidden bg-cream-dark">
                  {post.coverImage ? (
                    <Image
                      src={post.coverImage}
                      alt={post.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <CoverFallback index={i} />
                  )}
                  {post.isFeatured && (
                    <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-bhagva text-white text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 shadow-sm">
                      <Sparkles size={10} /> Featured
                    </span>
                  )}
                </div>
              </Link>
              <div className="p-4 sm:p-5">
                <div className="flex items-center gap-2 flex-wrap">
                  {post.category && (
                    <span className="text-[11px] font-bold text-bhagva-deep uppercase tracking-wide">
                      {post.category.name}
                    </span>
                  )}
                  {readTimeLabel(post.readMinutes) && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted">
                      <Clock3 size={11} /> {readTimeLabel(post.readMinutes)}
                    </span>
                  )}
                </div>
                <h2 className="mt-1.5 font-bold text-ink leading-snug">
                  <Link
                    href={`/blogs/${post.slug}`}
                    className="hover:text-bhagva-deep transition-colors"
                  >
                    {post.title}
                  </Link>
                </h2>
                {post.excerpt && (
                  <p className="mt-2 text-sm text-muted line-clamp-2 leading-relaxed">
                    {post.excerpt}
                  </p>
                )}
                <Link
                  href={`/blogs/${post.slug}`}
                  className="group/link inline-flex items-center gap-1 mt-3.5 text-sm font-semibold text-ink hover:text-bhagva-deep transition-colors"
                >
                  Read more
                  <ArrowRight
                    size={14}
                    className="transition-transform duration-300 group-hover/link:translate-x-1"
                  />
                </Link>
              </div>
            </article>
          ))}
          {!posts.data.length && (
            <div className="col-span-full text-center py-16">
              <Sparkles size={28} className="mx-auto text-cream-dark mb-3" />
              <p className="text-sm text-muted">
                {activeCategory
                  ? `No posts in "${activeCategory.name}" yet.`
                  : "No blog posts yet. Check back soon."}
              </p>
            </div>
          )}
        </div>

        {posts.meta.pages > 1 && (
          <nav className="flex items-center justify-center gap-2 mt-10">
            {Array.from({ length: posts.meta.pages }, (_, i) => i + 1).map(
              (p) => (
                <Link
                  key={p}
                  href={`/blogs?${new URLSearchParams({
                    ...(category ? { category } : {}),
                    page: String(p),
                  }).toString()}`}
                  className={`h-9 min-w-9 px-2.5 rounded-lg grid place-items-center text-sm font-semibold border transition-colors ${
                    p === posts.meta.page
                      ? "bg-ink text-white border-ink"
                      : "border-border text-ink/70 hover:border-bhagva hover:text-bhagva-deep"
                  }`}
                >
                  {p}
                </Link>
              ),
            )}
          </nav>
        )}
      </div>
    </div>
  );
}
