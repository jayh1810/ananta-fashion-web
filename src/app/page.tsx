import { CategoryGrid } from "@/components/CategoryGrid";
import {
  BrandLogoStrip,
  CategoryDealRow,
  FeatureBanner,
  UnlockStrip,
  WaysSection,
} from "@/components/home";
import {
  CollectionsStrip,
  EditorialSection,
  FeaturedBrands,
  PromoBannerGrid,
  brandsFromProducts,
  type EditorialPost,
  type HomePromoBanner,
} from "@/components/HomeSections";
import {
  CardRail,
  DealsSection,
  HeroCards,
  OfferStrip,
  promoItems,
} from "@/components/HomePromoSections";
import { TrustTicker } from "@/components/TrustTicker";
import {
  HomeProductRails,
  type HomeRailSpec,
} from "@/components/HomeProductRails";
import { FAQSection, Testimonials } from "@/components/TestimonialsFAQ";
import { SiteFaqJsonLd } from "@/components/SiteFaqJsonLd";
import { api, BRAND, type Product } from "@/lib/api";
import { fetchBrands } from "@/lib/brands";
import { homeHeroPreloadArgs } from "@/lib/home-hero-image";
import {
  fetchPublicFaqs,
  fetchSeoEntry,
  metadataForPath,
  SITE_URL,
} from "@/lib/seo";
import { isUsableImageSrc } from "@/lib/is-usable-image-src";
import { preload } from "react-dom";
import type { Metadata } from "next";

export const revalidate = 120;

export async function generateMetadata(): Promise<Metadata> {
  return metadataForPath("/", {
    title: `${BRAND} – Shop Fashion, Beauty & Lifestyle Online`,
    description: `Shop the latest fashion, beauty and lifestyle products online at ${BRAND}. Top brands, genuine products, easy returns and fast delivery across India.`,
  });
}

/** Homepage-only WebPage entity (kept off other routes on purpose). */
async function HomeWebPageJsonLd() {
  const homeSeo = await fetchSeoEntry("/");
  const data = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${SITE_URL}/#webpage`,
    url: SITE_URL,
    name:
      homeSeo?.title?.trim() ||
      `${BRAND} – Shop Fashion, Beauty & Lifestyle Online`,
    description:
      homeSeo?.description?.trim() ||
      `Shop the latest fashion, beauty and lifestyle products online at ${BRAND}.`,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    about: { "@id": `${SITE_URL}/#organization` },
    inLanguage: "en-IN",
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: ["h1", "h2", "#faqs"],
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

type HomeCollection = {
  id: string;
  name: string;
  slug: string;
  sortOrder?: number;
  showOnHome?: boolean;
  _count?: { products?: number };
};

async function safeHome() {
  try {
    return await api<{
      bestsellers: Product[];
      promoted?: Product[];
      categories: any[];
      collections?: HomeCollection[];
      banners: any[];
      promoBanners?: HomePromoBanner[];
    }>("/home");
  } catch {
    return {
      bestsellers: [],
      promoted: [],
      categories: [],
      collections: [],
      banners: [],
      promoBanners: [],
    };
  }
}

async function fetchCollection(slug: string, limit = 8) {
  try {
    const res = await api<{ data: Product[] }>(
      `/products?collection=${slug}&limit=${limit}`,
    );
    return res.data || [];
  } catch {
    return [];
  }
}

async function fetchEditorial(): Promise<EditorialPost[]> {
  try {
    const res = await api<{ data?: EditorialPost[] }>("/content/blogs?limit=4");
    return (res.data || []).filter((p) => p?.slug && p?.title).slice(0, 4);
  } catch {
    return [];
  }
}

/** Prefer top-level categories for the icon row; fall back to all when the tree is shallow. */
function homeCategories<T extends { parentId?: string | null }>(categories: T[]) {
  const top = categories.filter((c) => !c?.parentId);
  return top.length >= 4 ? top : categories;
}

type HomeSection = {
  id: string;
  type: string;
  title?: string | null;
  subtitle?: string | null;
  config?: Record<string, unknown> | null;
};

/** Built-in layout, used until admin saves one (Admin → Homepage sections). */
const DEFAULT_SECTIONS: HomeSection[] = [
  { id: "d-ticker", type: "trust_ticker" },
  { id: "d-hero", type: "hero" },
  { id: "d-categories", type: "categories" },
  { id: "d-promo", type: "promo_banners" },
  { id: "d-rail-first", type: "product_rail", config: { rail: 0 } },
  { id: "d-brands", type: "brands" },
  { id: "d-collections", type: "collections" },
  { id: "d-rail-rest", type: "product_rail", config: { rail: "rest" } },
  { id: "d-editorial", type: "editorial" },
  { id: "d-testimonials", type: "testimonials" },
  { id: "d-faq", type: "faq" },
];

async function fetchHomeSections(): Promise<HomeSection[]> {
  try {
    const rows = await api<HomeSection[]>("/content/home-sections");
    return Array.isArray(rows) && rows.length ? rows : DEFAULT_SECTIONS;
  } catch {
    return DEFAULT_SECTIONS;
  }
}

/** Repeatable blocks; every other type renders once (first occurrence wins). */
const REPEATABLE = new Set(["product_rail", "offer_strip", "deals", "card_rail"]);

const configText = (cfg: HomeSection["config"], key: string) =>
  typeof cfg?.[key] === "string" ? (cfg[key] as string).trim() : "";

/** Colour keys are injected into inline styles — accept only #RRGGBB. */
const configHex = (cfg: HomeSection["config"], key: string) => {
  const v = configText(cfg, key);
  return /^#[0-9a-f]{6}$/i.test(v) ? v : undefined;
};

function visibleSections(sections: HomeSection[]) {
  const seen = new Set<string>();
  return sections.filter((s) => {
    if (REPEATABLE.has(s.type)) return true;
    if (seen.has(s.type)) return false;
    seen.add(s.type);
    return true;
  });
}

export default async function HomePage() {
  const [home, faqRows, editorial, sectionRows, apiBrands] = await Promise.all([
    safeHome(),
    fetchPublicFaqs(),
    fetchEditorial(),
    fetchHomeSections(),
    fetchBrands({ featured: true, limit: 12 }),
  ]);
  const sections = visibleSections(sectionRows);
  const hasSection = (type: string) => sections.some((s) => s.type === type);
  const collections = home.collections || [];
  const homeRailCollections = collections.filter((c) => c.showOnHome !== false);
  const promoted = home.promoted?.length ? home.promoted.slice(0, 8) : [];

  const rails: HomeRailSpec[] = [];
  if (promoted.length) {
    rails.push({
      id: "promoted-top-picks",
      name: "Top picks",
      slug: "__promoted__",
      limit: 8,
      href: "/collections/all",
    });
  }
  for (const col of homeRailCollections) {
    rails.push({
      id: col.id,
      name: col.name,
      slug: col.slug,
      limit: col.slug === "featured-picks" ? 28 : 8,
      href: `/collections/${col.slug}`,
    });
  }

  // SSR only the first rail for LCP/SEO — remaining rails fetch on scroll.
  const initialBySlug: Record<string, Product[]> = {};
  if (promoted.length) {
    initialBySlug.__promoted__ = promoted;
  } else if (homeRailCollections[0]) {
    const first = homeRailCollections[0];
    const limit = first.slug === "featured-picks" ? 28 : 8;
    let products = await fetchCollection(first.slug, limit);
    if (
      first.slug === "bestsellers" &&
      !products.length &&
      home.bestsellers?.length
    ) {
      products = home.bestsellers.slice(0, 8);
    }
    if (products.length) initialBySlug[first.slug] = products;
  }

  const featuredBrands =
    apiBrands.length >= 2
      ? apiBrands
      : brandsFromProducts([
          ...promoted,
          ...Object.values(initialBySlug).flat(),
          ...(home.bestsellers || []),
        ]);

  const firstBanner = home.banners?.find(
    (b) => b?.imageUrl || b?.mobileImageUrl,
  );
  // Preload the mobile LCP candidate via /_next/image (not raw CDN).
  const heroSection = sections.find((s) => s.type === "hero");
  const heroPreloadSrc =
    heroSection && configText(heroSection.config, "layout") !== "cards"
    ? firstBanner?.mobileImageUrl || firstBanner?.imageUrl || null
    : null;
  if (heroPreloadSrc) {
    try {
      const args = homeHeroPreloadArgs(heroPreloadSrc);
      preload(args.href, {
        as: "image",
        imageSrcSet: args.imageSrcSet,
        imageSizes: args.imageSizes,
        fetchPriority: args.fetchPriority,
      });
    } catch {
      /* invalid remote URL — skip preload */
    }
  }

  const railsFor = (section: HomeSection): { list: HomeRailSpec[]; eager: number } => {
    const cfg = section.config || {};
    const collectionSlug =
      typeof cfg.collectionSlug === "string" ? cfg.collectionSlug.trim() : "";
    if (collectionSlug) {
      const col = collections.find((c) => c.slug === collectionSlug);
      const limit = Math.min(28, Math.max(4, Number(cfg.limit) || 8));
      const bandFrom = configHex(cfg, "background");
      return {
        list: [
          {
            id: section.id,
            name: section.title?.trim() || col?.name || collectionSlug.replace(/-/g, " "),
            slug: collectionSlug,
            limit,
            href: `/collections/${collectionSlug}`,
            band: bandFrom
              ? {
                  from: bandFrom,
                  to: configHex(cfg, "backgroundTo"),
                  subtitle: section.subtitle?.trim() || undefined,
                }
              : undefined,
          },
        ],
        eager: 0,
      };
    }
    if (cfg.rail === "rest") return { list: rails.slice(1), eager: 0 };
    return { list: rails.slice(0, 1), eager: 1 };
  };

  const renderSection = (section: HomeSection) => {
    const title = section.title?.trim() || undefined;
    switch (section.type) {
      case "trust_ticker":
        return <TrustTicker key={section.id} />;
      case "hero":
        return (
          <HeroCards
            key={section.id}
            banners={home.banners || []}
            bandColor={configHex(section.config, "background")}
            bandTo={configHex(section.config, "backgroundTo")}
            title={title || "Celebration mode: on"}
            subtitle={section.subtitle?.trim() || undefined}
          />
        );
      case "offer_strip":
        return <OfferStrip key={section.id} items={promoItems(section.config)} title={title} />;
      case "deals":
        return (
          <DealsSection
            key={section.id}
            items={promoItems(section.config)}
            title={title}
            endsAt={configText(section.config, "endsAt") || null}
          />
        );
      case "card_rail":
        return (
          <CardRail
            key={section.id}
            items={promoItems(section.config)}
            title={title}
            subtitle={section.subtitle?.trim() || undefined}
            variant={configText(section.config, "variant") === "caption" ? "caption" : "overlay"}
            background={configHex(section.config, "background")}
            backgroundTo={configHex(section.config, "backgroundTo")}
          />
        );
      case "categories":
        return (
          <CategoryGrid
            key={section.id}
            categories={homeCategories(home.categories || [])}
            title={title || "Shop by category"}
          />
        );
      case "promo_banners":
        return <PromoBannerGrid key={section.id} banners={home.promoBanners || []} />;
      case "product_rail": {
        const { list, eager } = railsFor(section);
        return list.length ? (
          <HomeProductRails
            key={section.id}
            rails={list}
            initialBySlug={initialBySlug}
            bestsellersFallback={home.bestsellers || []}
            eagerCount={eager}
          />
        ) : null;
      }
      case "brands":
        return <FeaturedBrands key={section.id} brands={featuredBrands} title={title} />;
      case "collections":
        return <CollectionsStrip key={section.id} collections={collections} title={title} />;
      case "editorial":
        return (
          <EditorialSection
            key={section.id}
            posts={editorial}
            title={title}
            subtitle={section.subtitle?.trim() || undefined}
          />
        );
      case "testimonials":
        return <Testimonials key={section.id} />;
      case "faq":
        return (
          <div key={section.id} id="faqs">
            <FAQSection initial={faqRows.map((f) => ({ q: f.question, a: f.answer }))} />
          </div>
        );
      default:
        return null;
    }
  };

  const ofType = (type: string) => sections.filter((s) => s.type === type);
  const hero = sections.find((s) => s.type === "hero");
  const deals = sections.find((s) => s.type === "deals");
  const offer = sections.find((s) => s.type === "offer_strip");
  const brandsSection = sections.find((s) => s.type === "brands");
  const categorySection = sections.find((s) => s.type === "categories");
  const productSections = ofType("product_rail");
  const cardSections = ofType("card_rail");
  const [waysRail, ...restCardRails] = cardSections;
  const topCategories = homeCategories(home.categories || []);
  const promoBanners = (home.promoBanners || []).filter(
    (b) =>
      isUsableImageSrc(b.imageUrl) ||
      isUsableImageSrc(b.mobileImageUrl) ||
      Boolean(b.title?.trim()),
  );
  const [feature, ...restPromos] = promoBanners;
  const waysItems = promoItems(waysRail?.config).map((it, i) => {
    const raw = (it.href || "").trim();
    const href = !raw
      ? "/collections/all"
      : raw.startsWith("/") || /^https?:\/\//i.test(raw)
        ? raw
        : `/${raw.replace(/^\/+/, "")}`;
    return {
      key: `${waysRail?.id || "ways"}-${i}`,
      href,
      title: it.title || it.label || "Shop",
      imageUrl: it.imageUrl,
    };
  });

  const renderRail = (section: HomeSection, layout?: "grid") => {
    const { list, eager } = railsFor(section);
    const rails = layout ? list.map((rail) => ({ ...rail, layout })) : list;
    return rails.length ? (
      <HomeProductRails
        key={section.id}
        rails={rails}
        initialBySlug={initialBySlug}
        bestsellersFallback={home.bestsellers || []}
        eagerCount={eager}
      />
    ) : null;
  };

  return (
    <>
      <HomeWebPageJsonLd />
      {/* FAQ schema only when the FAQ block is visible on the page. */}
      {hasSection("faq") ? <SiteFaqJsonLd /> : null}
      <h1 className="sr-only">
        {BRAND} – Shop Fashion, Beauty &amp; Lifestyle Online
      </h1>
      {hasSection("trust_ticker") ? <TrustTicker /> : null}
      {hero ? (
        <HeroCards
          banners={home.banners || []}
          bandColor={configHex(hero.config, "background")}
          bandTo={configHex(hero.config, "backgroundTo")}
          title={hero.title?.trim() || "Celebration mode: on"}
          subtitle={hero.subtitle?.trim() || undefined}
        />
      ) : null}
      {deals ? (
        <DealsSection
          items={promoItems(deals.config)}
          title={deals.title?.trim() || undefined}
          endsAt={configText(deals.config, "endsAt") || null}
        />
      ) : null}
      {feature ? (
        <FeatureBanner
          heading={feature.label?.trim() || "Big deals incoming"}
          href={feature.linkUrl || "/collections/all"}
          imageUrl={feature.imageUrl || feature.mobileImageUrl}
          imageAlt={feature.imageAlt}
          title={feature.title}
          subtitle={feature.subtitle}
        />
      ) : null}
      {restPromos.length ? <PromoBannerGrid banners={restPromos} /> : null}
      {brandsSection ? (
        <BrandLogoStrip
          brands={featuredBrands}
          title={brandsSection.title?.trim() || "Top brands"}
        />
      ) : null}
      {productSections[0] ? renderRail(productSections[0], "grid") : null}
      {offer ? (
        <OfferStrip items={promoItems(offer.config)} title={offer.title?.trim() || undefined} />
      ) : null}
      <CategoryDealRow
        categories={topCategories}
        title={categorySection?.title?.trim() || "Shop by focus"}
      />
      <WaysSection
        items={waysItems}
        title={waysRail?.title?.trim() || "9 ways to attract abundance"}
        subtitle={waysRail?.subtitle?.trim() || undefined}
      />
      {restCardRails.map((section) => (
        <CardRail
          key={section.id}
          items={promoItems(section.config)}
          title={section.title?.trim() || undefined}
          subtitle={section.subtitle?.trim() || undefined}
          variant={configText(section.config, "variant") === "caption" ? "caption" : "overlay"}
          background={configHex(section.config, "background")}
          backgroundTo={configHex(section.config, "backgroundTo")}
        />
      ))}
      {productSections.slice(1).map((section) => renderRail(section))}
      <UnlockStrip />
      <CategoryGrid
        categories={topCategories}
        title={categorySection?.title?.trim() || "Shop by category"}
      />
      {hasSection("collections") ? (
        <CollectionsStrip
          collections={collections}
          title={sections.find((s) => s.type === "collections")?.title?.trim() || undefined}
        />
      ) : null}
      {hasSection("editorial")
        ? renderSection(sections.find((s) => s.type === "editorial")!)
        : null}
      {hasSection("testimonials") ? <Testimonials /> : null}
      {hasSection("faq") ? (
        <div id="faqs">
          <FAQSection initial={faqRows.map((f) => ({ q: f.question, a: f.answer }))} />
        </div>
      ) : null}
    </>
  );
}
