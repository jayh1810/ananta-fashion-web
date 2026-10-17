import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { preload } from "react-dom";
import { api, fetchPdpBanner, type Product } from "@/lib/api";
import { productHeroPreloadArgs } from "@/lib/product-hero-image";
import { getDefaultPackIndex } from "@/lib/product-packs";
import { ProductDetail } from "@/components/ProductDetail";
import { ProductSeoShell } from "@/components/ProductSeoShell";
import { ProductGuidesSection } from "@/components/ProductGuidesSection";
import { ProductInternalLinks } from "@/components/ProductInternalLinks";
import { ProductSeoContent } from "@/components/ProductSeoContent";
import {
  fetchRelatedBlogs,
  generateProductMetadata,
  getCachedProduct,
  getCachedProductInternalLinks,
  productSeoDescription,
  stripHtml,
} from "@/lib/seo";
import {
  generateBreadcrumbSchema,
  generateFAQSchema,
  generateHowToSchema,
  generateWebPageSchema,
} from "@/lib/schema";
import { ProductJsonLd } from "@/components/ProductJsonLd";
import { FrequentlyBoughtTogether } from "@/components/FrequentlyBoughtTogether";
import { getCachedSettings } from "@/lib/settings";

/**
 * ISR: keep product HTML cacheable for crawlers while refreshing often enough
 * for admin price/stock edits. Prefer this over force-dynamic for crawl budget.
 */
export const revalidate = 120;

/** Pull Q&A pairs from the FAQs accordion (AI / admin HTML). */
function extractFaqPairs(
  product: Product,
): { question: string; answer: string }[] {
  const accordion = (product.pdpAccordions || []).find(
    (a) =>
      /^faq/i.test(a.title.trim()) || /^frequently asked/i.test(a.title.trim()),
  );
  if (!accordion?.body) return [];

  const body = accordion.body;
  const pairs: { question: string; answer: string }[] = [];

  const samePara = [
    ...body.matchAll(
      /<p[^>]*>\s*<strong[^>]*>([\s\S]*?)<\/strong>\s*(?:<br\s*\/?>)+\s*([\s\S]*?)<\/p>/gi,
    ),
  ];
  for (const m of samePara) {
    const question = stripHtml(m[1] || "").replace(
      /^Q(?:uestion)?\s*[:.)-]?\s*/i,
      "",
    );
    const answer = stripHtml(m[2] || "");
    if (question.length >= 8 && answer.length >= 8) {
      pairs.push({ question, answer });
    }
  }
  if (pairs.length) return pairs.slice(0, 12);

  const strongBlocks = [
    ...body.matchAll(
      /<p[^>]*>\s*(?:<strong[^>]*>|<b[^>]*>)\s*(?:Q(?:uestion)?\s*[:.)-]?\s*)?([^<]{8,180}?)\s*(?:<\/strong>|<\/b>)\s*<\/p>\s*<p[^>]*>([\s\S]*?)<\/p>/gi,
    ),
  ];
  for (const m of strongBlocks) {
    const question = stripHtml(m[1] || "").replace(
      /^Q(?:uestion)?\s*[:.)-]?\s*/i,
      "",
    );
    const answer = stripHtml(m[2] || "");
    if (question.length >= 8 && answer.length >= 8) {
      pairs.push({ question, answer });
    }
  }
  if (pairs.length) return pairs.slice(0, 12);

  const text = body
    .replace(/<\/p>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n• ");
  const plain = stripHtml(text);
  const qaRegex =
    /(?:^|\n)\s*(?:Q(?:uestion)?\s*[:.)-]\s*)(.+?)(?:\n)\s*(?:A(?:nswer)?\s*[:.)-]\s*)([\s\S]+?)(?=(?:\n\s*Q(?:uestion)?\s*[:.)-])|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = qaRegex.exec(plain)) !== null) {
    const question = m[1].trim();
    const answer = m[2].trim().replace(/\s+/g, " ");
    if (question.length >= 8 && answer.length >= 8) {
      pairs.push({ question, answer });
    }
  }
  if (pairs.length) return pairs.slice(0, 12);

  const lines = plain
    .split(/\n+/)
    .map((l) => l.replace(/^[-•*\d.)\s]+/, "").trim())
    .filter(Boolean);
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i].endsWith("?") && lines[i + 1] && !lines[i + 1].endsWith("?")) {
      pairs.push({ question: lines[i], answer: lines[i + 1] });
      i += 1;
    }
  }
  return pairs.slice(0, 12);
}

function breadcrumbTrail(product: Product) {
  const primaryCollection = product.collections?.[0];
  const primaryCategory = product.categories?.[0];

  if (primaryCollection?.slug) {
    return [
      { name: "Home", href: "/" },
      {
        name: primaryCollection.name,
        href: `/collections/${primaryCollection.slug}`,
      },
      { name: product.title, href: `/products/${product.slug}` },
    ];
  }

  if (primaryCategory?.slug) {
    return [
      { name: "Home", href: "/" },
      {
        name: primaryCategory.name,
        href: `/collections/${primaryCategory.slug}`,
      },
      { name: product.title, href: `/products/${product.slug}` },
    ];
  }

  return [
    { name: "Home", href: "/" },
    { name: "All Products", href: "/collections/all" },
    { name: product.title, href: `/products/${product.slug}` },
  ];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const product = await getCachedProduct(slug);
    return generateProductMetadata(slug, product);
  } catch {
    return generateProductMetadata(slug, null);
  }
}

/**
 * Product JSON-LD is its own script so Google never treats FAQ/Breadcrumb
 * as a second incomplete Product. Offers always come from live catalog price.
 */
function ProductPageJsonLd({
  product,
  faqs,
}: {
  product: Product;
  faqs: { question: string; answer: string }[];
}) {
  const url = `/products/${product.slug}`;
  const crumbs = breadcrumbTrail(product);
  const description = productSeoDescription(product);
  const breadcrumbLd = generateBreadcrumbSchema(crumbs);
  const faqLd = generateFAQSchema(faqs, url);
  const howToFromAccordion = (product.pdpAccordions || []).find((a) =>
    /^how to wear|^how to use/i.test(a.title.trim()),
  )?.body;
  const howToText = stripHtml(product.howToWear || howToFromAccordion || "");
  const howToLd = generateHowToSchema({
    url,
    name: `How to wear or use ${product.title}`,
    text: howToText,
  });
  const speakable = ["h1"];
  if (faqs.length) speakable.push("#product-faqs");
  if (howToLd) speakable.push("#product-how-to-use");
  const webpageLd = generateWebPageSchema({
    url,
    name: product.title,
    description,
    speakable,
  });

  return (
    <>
      <ProductJsonLd product={product} description={description} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webpageLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      {faqLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
        />
      ) : null}
      {howToLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(howToLd) }}
        />
      ) : null}
    </>
  );
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getCachedProduct(slug);
  if (!product) notFound();

  const [internalLinks, relatedResult, pdpBanner, settings] = await Promise.all([
    getCachedProductInternalLinks(slug),
    (async () => {
      try {
        return await api<Product[]>(
          `/products/${encodeURIComponent(slug)}/related?limit=8`,
        );
      } catch {
        if (product.relatedProductIds?.length) {
          try {
            const all = await api<{ data: Product[] }>("/products?limit=48");
            return all.data
              .filter((p) => product.relatedProductIds!.includes(p.id))
              .slice(0, 8);
          } catch {
            return [] as Product[];
          }
        }
        return [] as Product[];
      }
    })(),
    fetchPdpBanner(slug),
    getCachedSettings(),
  ]);

  let related = relatedResult;
  // Review JSON-LD / crawler copy must match what shoppers see on the PDP.
  const productForSeo: Product =
    settings.store.reviewsOnProductPage || settings.store.reviewsSlider
      ? product
      : { ...product, reviewList: [] };

  const faqsFromAccordion = extractFaqPairs(product);
  const suggestedFaqs = product.seo?.suggestedFaqs || [];
  const faqs =
    faqsFromAccordion.length > 0 ? faqsFromAccordion : suggestedFaqs;

  const relatedTopic =
    product.categories?.[0]?.name || product.collections?.[0]?.name || "";
  let relatedGuides: Awaited<ReturnType<typeof fetchRelatedBlogs>> = [];
  let guideLinks = internalLinks.guides;
  if (!guideLinks.length && relatedTopic) {
    try {
      relatedGuides = await fetchRelatedBlogs(relatedTopic);
      guideLinks = relatedGuides.map((b) => ({
        label: b.title,
        href: `/blogs/${b.slug}`,
        kind: "blog" as const,
      }));
    } catch {
      guideLinks = [];
      relatedGuides = [];
    }
  } else if (guideLinks.length) {
    relatedGuides = guideLinks.map((g) => ({
      title: g.label,
      slug: g.href.replace(/^\/blogs\//, ""),
      excerpt: null,
    }));
  }
  const linksForUi = { ...internalLinks, guides: guideLinks };

  const productForUi: Product =
    !faqsFromAccordion.length && faqs.length
      ? {
          ...product,
          pdpAccordions: [
            ...(product.pdpAccordions || []),
            {
              title: "FAQs",
              body: faqs
                .map(
                  (f) =>
                    `<p><strong>${f.question}</strong><br/>${f.answer}</p>`,
                )
                .join(""),
            },
          ],
        }
      : product;

  const crumbs = breadcrumbTrail(product);
  const defaultPackIdx = getDefaultPackIndex(product);
  const heroImage =
    product.image ||
    (product.images && product.images.length > 0 ? product.images[0] : null);
  if (heroImage) {
    // Preload the same `/_next/image` URL the gallery uses — raw CDN preload wastes bandwidth.
    const args = productHeroPreloadArgs(heroImage);
    preload(args.href, {
      as: "image",
      imageSrcSet: args.imageSrcSet,
      imageSizes: args.imageSizes,
      fetchPriority: args.fetchPriority,
    });
  }

  return (
    <>
      <ProductPageJsonLd product={productForSeo} faqs={faqs} />
      <div className="bg-white lg:bg-[var(--page-band)]">
        <div className="mx-auto max-w-[1180px] px-3 pb-1 pt-4 sm:px-5 sm:pt-5 md:px-6">
          <nav className="text-xs text-muted lg:text-[13px]" aria-label="Breadcrumb">
            {crumbs.map((c, i) => {
              const last = i === crumbs.length - 1;
              return (
                <span key={`${c.href}-${i}`}>
                  {i > 0 ? <span className="mx-1.5" aria-hidden>›</span> : null}
                  {last ? (
                    <span className="text-ink">{c.name}</span>
                  ) : (
                    <Link href={c.href} className="hover:text-brand">
                      {c.name}
                    </Link>
                  )}
                </span>
              );
            })}
          </nav>
        </div>
      </div>
      <ProductSeoShell product={product} />
      <ProductDetail
        product={productForUi}
        related={related}
        titleAs="h1"
        initialPackIdx={defaultPackIdx}
        pdpBanner={pdpBanner}
      />
      <FrequentlyBoughtTogether product={product} />
      <ProductSeoContent product={productForSeo} />
      {/* Hidden on PDP UI — keep for SEO/data; toggle `hidden` to show again */}
      <div className="hidden" aria-hidden="true">
        <ProductInternalLinks links={linksForUi} variant="explore" />
        <ProductGuidesSection posts={relatedGuides} />
      </div>
    </>
  );
}
