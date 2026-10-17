import type { Metadata } from "next";
import { metadataForPath, SEO_API_URL, SITE_NAME } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug: raw } = await params;
  const slug = raw.toLowerCase();
  const path = `/policies/${slug}`;
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
        };
      };
      const page = s.store?.pages?.find(
        (p) => p.slug?.toLowerCase() === slug && p.published !== false,
      );
      if (page) {
        title = page.seoTitle || page.title || title;
        description = page.seoDescription || description;
      }
    }
  } catch {
    /* ignore */
  }

  return metadataForPath(path, {
    title,
    description: description.slice(0, 160),
  });
}

export default function PolicyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
