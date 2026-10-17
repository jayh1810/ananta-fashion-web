import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { looksLikeHtml, sanitizeProductHtml } from "@/lib/sanitize-html";
import { buildPageMetadata, fetchSeoEntry } from "@/lib/seo";

export const revalidate = 300;

type CmsPage = {
  slug: string;
  title: string;
  body: string;
  published?: boolean;
  showInFooter?: boolean;
};

const ALIASES: Record<string, string> = {
  privacy: "privacy-policy",
  terms: "terms-of-service",
  returns: "refund-policy",
  refund: "refund-policy",
  shipping: "shipping-policy",
};

function resolveSlug(rawSlug: string) {
  const lower = (rawSlug || "").toLowerCase();
  return ALIASES[lower] || lower;
}

async function getPolicy(slug: string): Promise<CmsPage | null> {
  try {
    const s = await api<{ store?: { pages?: CmsPage[] } }>("/settings");
    const pages = Array.isArray(s.store?.pages) ? s.store!.pages! : [];
    return (
      pages.find((p) => p.slug?.toLowerCase() === slug && p.title) || null
    );
  } catch {
    return null;
  }
}

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = resolveSlug(rawSlug);
  const page = await getPolicy(slug);

  if (!page) {
    return { title: "Page not found", robots: { index: false, follow: false } };
  }

  const path = `/policies/${slug}`;
  const description =
    stripHtml(page.body || "").slice(0, 160) || `${page.title} policy.`;
  const entry = await fetchSeoEntry(path);
  return buildPageMetadata(
    path,
    {
      title: page.title,
      description,
      noIndex: page.published === false,
    },
    entry,
  );
}

export default async function PolicyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = await params;
  const slug = resolveSlug(rawSlug);
  const page = await getPolicy(slug);

  if (!page) {
    notFound();
  }

  if (page.published === false) {
    return (
      <div className="mx-auto max-w-3xl px-3 sm:px-5 py-16 text-center">
        <h1 className="section-title mb-2">{page.title}</h1>
        <p className="text-sm text-muted">This page is not published yet.</p>
        <Link href="/" className="inline-block mt-6 text-sm font-semibold underline">
          Back to home
        </Link>
      </div>
    );
  }

  const html = looksLikeHtml(page.body) ? sanitizeProductHtml(page.body) : "";

  return (
    <div className="mx-auto max-w-3xl px-3 sm:px-5 py-10 pb-16">
      <nav className="text-xs text-muted mb-4">
        <Link href="/" className="hover:text-ink">
          Home
        </Link>
        <span className="mx-1">/</span>
        <span className="text-ink">Policies</span>
        <span className="mx-1">/</span>
        <span className="text-ink">{page.title}</span>
      </nav>
      <h1 className="section-title mb-6">{page.title}</h1>
      {html ? (
        <div
          className="policy-prose text-sm sm:text-[15px] text-ink/85 leading-relaxed space-y-3 [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-ink [&_h3]:mt-5 [&_h3]:mb-1.5 [&_h3]:text-sm [&_h3]:font-bold [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_a]:underline [&_a]:font-semibold [&_p]:mb-3"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <p className="text-sm sm:text-base text-ink/85 leading-relaxed whitespace-pre-line">
          {page.body}
        </p>
      )}
    </div>
  );
}
