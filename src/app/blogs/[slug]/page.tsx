import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  Sparkles,
  Tag,
} from "lucide-react";
import { BRAND } from "@/lib/api";
import { sanitizeProductHtml } from "@/lib/sanitize-html";
import { BlogFaqAccordion } from "@/components/BlogFaqAccordion";
import { BlogPostRelatedSections } from "@/components/BlogPostRelatedSections";
import { AuthorAvatar } from "@/components/AuthorAvatar";
import { getCachedSettings } from "@/lib/settings";
import {
  absoluteUrl,
  generateArticleMetadata,
  getCachedArticle,
  SEO_API_URL,
} from "@/lib/seo";
import {
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
  buildWebPageJsonLd,
} from "@/lib/schema";

export const revalidate = 300;

/** Shared width for header, cover, body, FAQ, and related sections. */
const BLOG_SHELL = "mx-auto max-w-6xl px-3 sm:px-5";

type BlogCategory = { id: string; name: string; slug: string };
type FaqItem = { question: string; answer: string };

type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  coverImage: string | null;
  category: BlogCategory | null;
  tags: string[];
  authorName: string | null;
  readMinutes: number | null;
  isFeatured: boolean;
  publishedAt: string | null;
  updatedAt: string;
  seoTitle: string | null;
  seoDescription: string | null;
  keywords: string | null;
  ogImage: string | null;
  noIndex: boolean;
  faqItems: FaqItem[];
};

type RelatedPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  category: BlogCategory | null;
  readMinutes: number | null;
};

function stripHtml(html: string) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function getPost(slug: string): Promise<BlogPost | null> {
  const data = await getCachedArticle(slug);
  if (!data?.id) return null;
  return data as BlogPost;
}

async function getRelatedProducts(query: string) {
  const q = query.trim();
  if (!q) return [];
  try {
    const res = await fetch(
      `${SEO_API_URL}/products?q=${encodeURIComponent(q)}&limit=4`,
      { next: { revalidate: 300 } },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      data?: {
        title: string;
        slug: string;
        image?: string;
        price?: number;
        compareAt?: number;
        rating?: number;
        reviews?: number;
        isFreeProduct?: boolean;
      }[];
    };
    return (data.data || [])
      .filter((p) => p.slug)
      .slice(0, 4)
      .map((p) => ({
        title: p.title,
        slug: p.slug,
        image: p.image,
        price: p.price,
        compareAt: p.compareAt,
        rating: p.rating,
        reviews: p.reviews,
        isFreeProduct: p.isFreeProduct,
      }));
  } catch {
    return [];
  }
}

/** When a blog topic matches a live product collection, link Blog → Collection → Product. */
async function resolveShopCollection(
  categorySlug?: string | null,
): Promise<{ slug: string; name: string } | null> {
  const slug = categorySlug?.trim();
  if (!slug) return null;
  try {
    const res = await fetch(`${SEO_API_URL}/collections/${encodeURIComponent(slug)}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { slug?: string; name?: string };
    if (!data.slug) return null;
    return { slug: data.slug, name: String(data.name || data.slug) };
  } catch {
    return null;
  }
}

async function getRelatedPosts(post: BlogPost): Promise<RelatedPost[]> {
  try {
    const params = new URLSearchParams({ limit: "4" });
    if (post.category?.slug) params.set("category", post.category.slug);
    const res = await fetch(
      `${SEO_API_URL}/content/blogs?${params.toString()}`,
      { next: { revalidate: 300, tags: ["blogs"] } },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { data: RelatedPost[] };
    return (data.data || []).filter((p) => p.slug !== post.slug).slice(0, 3);
  } catch {
    return [];
  }
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getCachedArticle(slug);
  if (!post) {
    return { title: "Post not found", robots: { index: false, follow: false } };
  }
  const description =
    post.seoDescription?.trim() ||
    post.excerpt?.trim() ||
    stripHtml(post.content).slice(0, 160) ||
    `Read ${post.title} on ${BRAND}.`;
  return generateArticleMetadata({
    slug,
    title: post.seoTitle?.trim() || post.title,
    description,
    image: post.ogImage || post.coverImage || null,
    noIndex: post.noIndex,
    publishedTime: post.publishedAt,
    modifiedTime: post.updatedAt || post.publishedAt,
    authors: [post.authorName || BRAND],
    keywords: post.keywords?.trim()
      ? post.keywords.split(",").map((k) => k.trim())
      : post.tags,
  });
}

export default async function BlogDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) {
    notFound();
  }

  const [related, relatedProducts, shopCollection, settings] = await Promise.all([
    getRelatedPosts(post),
    getRelatedProducts(post.category?.name || post.tags?.[0] || post.title),
    resolveShopCollection(post.category?.slug),
    getCachedSettings(),
  ]);

  const path = `/blogs/${slug}`;
  const description =
    post.seoDescription?.trim() ||
    post.excerpt?.trim() ||
    stripHtml(post.content).slice(0, 160);
  const author = post.authorName || BRAND;
  const pageUrl = absoluteUrl(path);

  const breadcrumbLd = buildBreadcrumbJsonLd([
    { name: "Home", href: "/" },
    { name: "Blogs", href: "/blogs" },
    { name: post.title, href: path },
  ]);

  const webpageLd = buildWebPageJsonLd({
    url: pageUrl,
    name: post.title,
    description,
  });

  const articleLd = buildArticleJsonLd({
    url: pageUrl,
    headline: post.title,
    description,
    image: post.ogImage || post.coverImage,
    authorName: author,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt || post.publishedAt,
    keywords: post.tags,
  });

  const faqLd = buildFaqJsonLd(post.faqItems || [], pageUrl);

  return (
    <div className="bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webpageLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }}
      />
      {faqLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
        />
      )}

      {/* —— Header —— clean, image-independent typography that always looks crisp */}
      <div className="relative overflow-hidden bg-gradient-to-b from-bhagva-soft/50 to-white">
        <div
          className="absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,122,26,0.12) 1px, transparent 1.5px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className={`relative ${BLOG_SHELL} pt-8 sm:pt-14 pb-8 sm:pb-10`}>
          <nav className="blog-fade-up text-xs text-muted mb-4">
            <Link href="/" className="hover:text-ink transition-colors">
              Home
            </Link>
            <span className="mx-1.5">/</span>
            <Link href="/blogs" className="hover:text-ink transition-colors">
              Blogs
            </Link>
          </nav>

          {post.category && (
            <div
              className="blog-fade-up flex flex-wrap items-center gap-2"
              style={{ animationDelay: "0.05s" }}
            >
              <Link
                href={`/blogs?category=${encodeURIComponent(post.category.slug)}`}
                className="inline-flex w-fit items-center rounded-full bg-bhagva px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm hover:bg-bhagva-deep transition-colors"
              >
                {post.category.name}
              </Link>
              {shopCollection ? (
                <Link
                  href={`/collections/${shopCollection.slug}`}
                  className="inline-flex w-fit items-center rounded-full border border-bhagva/30 bg-white px-3 py-1 text-[11px] font-semibold text-bhagva-deep hover:bg-bhagva-soft transition-colors"
                >
                  Shop {shopCollection.name}
                </Link>
              ) : null}
            </div>
          )}

          <h1
            className="blog-fade-up mt-3 text-3xl sm:text-[2.75rem] lg:text-5xl font-extrabold leading-[1.15] text-ink text-balance"
            style={{ animationDelay: "0.1s" }}
          >
            {post.title}
          </h1>

          {(post.excerpt || description) && (
            <p
              className="blog-fade-up mt-3.5 text-sm sm:text-base text-ink/60 leading-relaxed"
              style={{ animationDelay: "0.14s" }}
            >
              {post.excerpt || description}
            </p>
          )}

          <div
            className="blog-fade-up mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink/60"
            style={{ animationDelay: "0.18s" }}
          >
            <span className="inline-flex items-center gap-1.5">
              <AuthorAvatar name={author} size={24} />
              <span className="font-medium text-ink/80">{author}</span>
            </span>
            {formatDate(post.publishedAt) && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={13} /> {formatDate(post.publishedAt)}
              </span>
            )}
            {post.readMinutes && (
              <span className="inline-flex items-center gap-1.5">
                <Clock3 size={13} /> {post.readMinutes} min read
              </span>
            )}
          </div>
        </div>
      </div>

      {/* —— Cover image —— contained card, never full-bleed so small/odd-ratio
          source photos still look intentional instead of stretched or floating. */}
      <div className={`${BLOG_SHELL} -mt-4 sm:-mt-6`}>
        {post.coverImage ? (
          <div
            className="blog-fade-up relative w-full aspect-[16/9] sm:aspect-[21/9] overflow-hidden rounded-2xl sm:rounded-3xl shadow-[0_16px_44px_-16px_rgba(47,54,69,0.35)] bg-cream-dark"
            style={{ animationDelay: "0.22s" }}
          >
            <Image
              src={post.coverImage}
              alt={post.title}
              fill
              sizes="(max-width: 1024px) 100vw, 1152px"
              className="object-cover"
              priority
            />
          </div>
        ) : (
          <div
            className="blog-fade-up relative w-full aspect-[16/9] sm:aspect-[21/9] overflow-hidden rounded-2xl sm:rounded-3xl shadow-[0_16px_44px_-16px_rgba(47,54,69,0.25)] bg-[radial-gradient(circle_at_20%_20%,rgba(255,153,51,0.35),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(16,132,116,0.3),transparent_40%),linear-gradient(135deg,#2f3645,#1c2130)]"
            style={{ animationDelay: "0.22s" }}
          >
            <div
              className="absolute inset-0 opacity-[0.15]"
              style={{
                backgroundImage:
                  "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1.5px)",
                backgroundSize: "22px 22px",
              }}
            />
            <Sparkles
              className="absolute -bottom-6 -right-6 text-white/10"
              size={140}
              strokeWidth={1}
            />
            <span className="absolute inset-0 grid place-items-center text-sm font-semibold text-white/70">
              {BRAND}
            </span>
          </div>
        )}
      </div>

      {/* —— Content —— */}
      <div className={BLOG_SHELL}>
        <div
          className="blog-fade-up mt-7 sm:mt-10 w-full"
          style={{ animationDelay: "0.28s" }}
        >
          <div
            className="text-sm sm:text-[15.5px] text-ink/85 leading-[1.85] space-y-3
              [&_h2]:mt-9 [&_h2]:mb-3 [&_h2]:text-lg sm:[&_h2]:text-xl [&_h2]:font-extrabold [&_h2]:text-ink [&_h2]:relative [&_h2]:pl-3.5
              [&_h2]:before:content-[''] [&_h2]:before:absolute [&_h2]:before:left-0 [&_h2]:before:top-1 [&_h2]:before:bottom-1 [&_h2]:before:w-1 [&_h2]:before:rounded-full [&_h2]:before:bg-bhagva
              [&_h3]:mt-6 [&_h3]:mb-1.5 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-ink
              [&_ul]:space-y-2 [&_ul]:my-4 [&_ul]:pl-0 [&_ul]:list-none
              [&_ul>li]:relative [&_ul>li]:pl-7
              [&_ul>li]:before:content-['✓'] [&_ul>li]:before:absolute [&_ul>li]:before:left-0 [&_ul>li]:before:top-0 [&_ul>li]:before:grid [&_ul>li]:before:h-5 [&_ul>li]:before:w-5 [&_ul>li]:before:place-items-center [&_ul>li]:before:rounded-full [&_ul>li]:before:bg-teal/10 [&_ul>li]:before:text-teal [&_ul>li]:before:text-[11px] [&_ul>li]:before:font-bold
              [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-4 [&_ol]:space-y-1.5
              [&_a]:text-bhagva [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-2
              [&_p]:mb-4 [&_strong]:text-ink [&_strong]:font-bold
              [&_img]:w-full [&_img]:rounded-2xl [&_img]:my-6 [&_blockquote]:border-l-4 [&_blockquote]:border-bhagva/40 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-ink/70"
            dangerouslySetInnerHTML={{ __html: sanitizeProductHtml(post.content) }}
          />

          {!!post.tags?.length && (
            <div className="flex flex-wrap items-center gap-2 mt-8 pt-6 border-t border-border">
              <Tag size={14} className="text-muted shrink-0" />
              {post.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/blogs?tag=${encodeURIComponent(tag)}`}
                  className="text-[11px] font-semibold text-ink/60 bg-cream hover:bg-bhagva-soft hover:text-bhagva-deep transition-colors px-2.5 py-1 rounded-full"
                >
                  #{tag}
                </Link>
              ))}
            </div>
          )}
        </div>

        {!!post.faqItems?.length && (
          <div
            className="blog-fade-up mt-10 w-full"
            style={{ animationDelay: "0.32s" }}
          >
            <h2 className="text-lg sm:text-xl font-extrabold text-ink mb-4 flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-bhagva-soft text-bhagva-deep text-sm font-black">
                ?
              </span>
              Frequently asked questions
            </h2>
            <BlogFaqAccordion items={post.faqItems} />
          </div>
        )}

        <BlogPostRelatedSections
          products={relatedProducts}
          posts={related}
          shopCollection={shopCollection}
          showRatings={settings.store.reviewsOnCards}
        />

        <Link
          href="/blogs"
          className="group inline-flex items-center gap-1.5 mt-10 mb-14 text-sm font-semibold text-ink hover:text-bhagva-deep transition-colors"
        >
          <ArrowLeft
            size={16}
            className="transition-transform duration-300 group-hover:-translate-x-1"
          />
          Back to all blogs
        </Link>
      </div>
    </div>
  );
}
