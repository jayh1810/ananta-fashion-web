import { cache } from "react";
import { ApiError, api, type Product } from "../api";
import { SEO_API_URL, SEO_REVALIDATE } from "./constants";

export type SeoEntry = {
  path: string;
  title: string | null;
  description: string | null;
  ogImage: string | null;
  keywords: string | null;
  noIndex: boolean;
};

export type PublicFaq = { question: string; answer: string };

export type RelatedBlog = {
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage?: string | null;
  readMinutes?: number | null;
  category?: { name: string; slug: string } | null;
};

async function fetchJson<T>(
  path: string,
  revalidate: number,
  tags?: string[],
): Promise<T | null> {
  try {
    const res = await fetch(`${SEO_API_URL}${path}`, {
      next: tags?.length ? { revalidate, tags } : { revalidate },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Request-deduped: generateMetadata + page share one product fetch. */
export const getCachedProduct = cache(async (slug: string) => {
  try {
    return await api<Product>(`/products/${encodeURIComponent(slug)}`);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 410)) {
      return null;
    }
    throw err;
  }
});

export const getCachedSeoEntry = cache(async (path: string) => {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const data = await fetchJson<SeoEntry>(
    `/content/seo?path=${encodeURIComponent(normalized)}`,
    SEO_REVALIDATE.settings,
  );
  if (!data || typeof data !== "object" || !data.path) return null;
  return data;
});

export const getCachedFaqs = cache(async () => {
  const data = await fetchJson<PublicFaq[]>("/content/faqs", SEO_REVALIDATE.faq);
  if (!Array.isArray(data)) return [] as PublicFaq[];
  return data
    .filter((f) => f?.question && f?.answer)
    .map((f) => ({
      question: String(f.question).trim(),
      answer: String(f.answer).trim(),
    }));
});

export const getCachedRelatedBlogs = cache(
  async (query: string, excludeSlug?: string) => {
    const q = query.trim();
    if (!q) return [] as RelatedBlog[];
    const params = new URLSearchParams({ q, limit: "3" });
    const data = await fetchJson<{ data?: RelatedBlog[] }>(
      `/content/blogs?${params}`,
      SEO_REVALIDATE.article,
    );
    return (data?.data || [])
      .filter((p) => p.slug && p.slug !== excludeSlug)
      .slice(0, 3);
  },
);

export const getCachedCollection = cache(async (slug: string) => {
  return fetchJson<{
    name?: string;
    description?: string | null;
    imageUrl?: string | null;
    seoTitle?: string | null;
    seoDescription?: string | null;
  }>(`/collections/${encodeURIComponent(slug)}`, SEO_REVALIDATE.collection);
});

export const getCachedCategory = cache(async (slug: string) => {
  return fetchJson<{
    name?: string;
    description?: string | null;
    imageUrl?: string | null;
    seoTitle?: string | null;
    seoDescription?: string | null;
  }>(`/categories/${encodeURIComponent(slug)}`, SEO_REVALIDATE.collection);
});

export const getCachedArticle = cache(async (slug: string) => {
  return fetchJson<{
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    content: string;
    coverImage: string | null;
    category: { id: string; name: string; slug: string } | null;
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
    faqItems: PublicFaq[];
  }>(`/content/blogs/${encodeURIComponent(slug)}`, SEO_REVALIDATE.article, [
    "blogs",
    `blog:${slug}`,
  ]);
});
