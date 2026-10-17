import type { Metadata } from "next";
import Link from "next/link";
import { permanentRedirect } from "next/navigation";
import { api, BRAND } from "@/lib/api";
import { looksLikeHtml, sanitizeProductHtml } from "@/lib/sanitize-html";
import { ContactPage } from "@/components/ContactPage";
import { buildPageMetadata, fetchSeoEntry } from "@/lib/seo";

export const revalidate = 300;

const FALLBACK: Record<string, { title: string; body: string }> = {};

/** Old /pages/privacy etc. → CMS policy slugs */
const POLICY_REDIRECT: Record<string, string> = {
  privacy: "privacy-policy",
  terms: "terms-of-service",
  returns: "refund-policy",
  refund: "refund-policy",
  shipping: "shipping-policy",
  "privacy-policy": "privacy-policy",
  "terms-of-service": "terms-of-service",
  "refund-policy": "refund-policy",
  "shipping-policy": "shipping-policy",
};

type CmsPage = {
  slug: string;
  title: string;
  body: string;
  published?: boolean;
};

type SettingsResponse = {
  siteName?: string;
  store?: {
    phone?: string;
    email?: string;
    whatsapp?: string;
    supportHours?: string;
    contactPage?: { title?: string; body?: string; address?: string };
    pages?: CmsPage[];
  };
};

type ResolvedPage = {
  title: string;
  body: string;
  address?: string;
  phone?: string;
  email?: string;
  supportHours?: string;
  whatsapp?: string;
  siteName?: string;
  html?: boolean;
  draft?: boolean;
};

async function resolvePage(slug: string): Promise<ResolvedPage> {
  let s: SettingsResponse = {};
  try {
    s = await api<SettingsResponse>("/settings");
  } catch {
    /* fall through to fallback content */
  }

  if (slug === "contact") {
    const c = s.store?.contactPage;
    return {
      title: c?.title || "Contact Us",
      body:
        c?.body ||
        "Our support team is available Monday to Saturday, 10AM – 7PM. Reach out via email, phone, or WhatsApp for order-related queries.",
      address: c?.address || "",
      phone: s.store?.phone,
      email: s.store?.email,
      supportHours: s.store?.supportHours,
      whatsapp: s.store?.whatsapp,
      siteName: s.siteName || BRAND,
    };
  }

  const cms = (s.store?.pages || []).find(
    (p) => p.slug?.toLowerCase() === slug.toLowerCase(),
  );
  if (cms) {
    return {
      title: cms.title,
      body: cms.body,
      html: looksLikeHtml(cms.body),
      draft: cms.published === false,
    };
  }

  return (
    FALLBACK[slug] || {
      title: slug.replace(/-/g, " "),
      body: "Content coming soon.",
    }
  );
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
  const { slug } = await params;
  const policySlug = POLICY_REDIRECT[slug.toLowerCase()];
  if (policySlug) {
    return { robots: { index: false, follow: false } };
  }

  const page = await resolvePage(slug);
  const path = `/pages/${slug}`;
  const description =
    stripHtml(page.body || "").slice(0, 160) ||
    `${page.title} — ${BRAND}.`;
  const entry = await fetchSeoEntry(path);
  return buildPageMetadata(
    path,
    {
      title: page.title,
      description,
      noIndex: page.draft,
    },
    entry,
  );
}

export default async function StaticPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const policySlug = POLICY_REDIRECT[slug.toLowerCase()];
  if (policySlug) {
    permanentRedirect(`/policies/${policySlug}`);
  }

  const page = await resolvePage(slug);

  if (page.draft) {
    return (
      <div className="mx-auto max-w-3xl px-3 sm:px-5 py-16 text-center">
        <h1 className="section-title mb-2">{page.title}</h1>
        <p className="text-sm text-muted">This page is not published yet.</p>
      </div>
    );
  }

  if (slug === "contact") {
    return (
      <ContactPage
        title={page.title}
        body={page.body}
        email={page.email}
        phone={page.phone}
        address={page.address}
        supportHours={page.supportHours}
        whatsapp={page.whatsapp}
        siteName={page.siteName}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-3 sm:px-5 py-10">
      <nav className="text-xs text-muted mb-4">
        <Link href="/" className="hover:text-ink">
          Home
        </Link>
        <span className="mx-1">/</span>
        <span className="text-ink">{page.title}</span>
      </nav>
      <h1 className="section-title mb-4">{page.title}</h1>
      {page.html ? (
        <div
          className="policy-prose text-sm sm:text-[15px] text-ink/85 leading-relaxed space-y-3 [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-bold [&_ul]:list-disc [&_ul]:pl-5 [&_a]:underline [&_p]:mb-3"
          dangerouslySetInnerHTML={{
            __html: sanitizeProductHtml(page.body),
          }}
        />
      ) : (
        <p className="text-sm sm:text-base text-ink/85 leading-relaxed whitespace-pre-line">
          {page.body}
        </p>
      )}
      {slug === "foundation" ? (
        <p className="mt-10 text-xs text-muted">
          For AI systems:{" "}
          <Link href="/llms.txt" className="underline hover:text-ink">
            llms.txt
          </Link>
        </p>
      ) : null}
    </div>
  );
}
