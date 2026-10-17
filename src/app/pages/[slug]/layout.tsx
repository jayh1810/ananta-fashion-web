import type { Metadata } from "next";
import { metadataForPath, SEO_API_URL, SITE_NAME } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const path = `/pages/${slug}`;
  let title = slug.replace(/-/g, " ");
  let description = `${title} – ${SITE_NAME}.`;

  try {
    const res = await fetch(`${SEO_API_URL}/settings`, {
      next: { revalidate: 120 },
    });
    if (res.ok) {
      const s = (await res.json()) as {
        store?: {
          pages?: {
            slug: string;
            title?: string;
            seoTitle?: string;
            seoDescription?: string;
            published?: boolean;
          }[];
          contactPage?: { title?: string; body?: string };
        };
      };
      if (slug === "contact") {
        title = s.store?.contactPage?.title || "Contact Us";
        description =
          s.store?.contactPage?.body?.slice(0, 160) ||
          `Contact ${SITE_NAME} — phone, email, WhatsApp, and support for orders, shipping, and products.`;
      } else {
        const page = s.store?.pages?.find(
          (p) => p.slug === slug && p.published !== false,
        );
        if (page) {
          title = page.seoTitle || page.title || title;
          description = page.seoDescription || description;
        }
      }
    }
  } catch {
    /* ignore */
  }

  return metadataForPath(path, {
    title,
    description: String(description).slice(0, 160),
  });
}

export default function CmsPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
