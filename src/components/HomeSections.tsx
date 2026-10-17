import Image from "next/image";
import Link from "next/link";
import {
  BadgeCheck,
  RotateCcw,
  ShieldCheck,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { BRAND, type Product } from "@/lib/api";
import { Container, SectionHeader } from "@/components/ui";
import { isUsableImageSrc } from "@/lib/is-usable-image-src";
import { HorizontalScroll } from "@/components/HorizontalScroll";

export function PromoBanner({
  title,
  subtitle,
  href = "/collections/bestsellers",
  label = "Featured",
  buttonText = "SHOP NOW",
  backgroundColor,
  tone = "warm",
}: {
  title: string;
  subtitle?: string | null;
  href?: string;
  label?: string | null;
  buttonText?: string | null;
  backgroundColor?: string | null;
  tone?: "warm" | "dark";
}) {
  const customBg = backgroundColor?.trim();
  const light = customBg ? isLightHex(customBg) : tone !== "dark";
  const gradientFallback =
    tone === "dark"
      ? "from-ink to-[#1f2a44]"
      : "from-brand-soft to-[#ffd3e4]";
  const text = customBg
    ? light
      ? "text-ink"
      : "text-white"
    : tone === "dark"
      ? "text-white"
      : "text-ink";

  return (
    <section className="py-6 sm:py-8">
      <div className="mx-auto max-w-[1400px] px-3 sm:px-5">
        <Link
          href={href}
          className={`block rounded-2xl ${text} px-6 sm:px-10 py-8 sm:py-12 text-center sm:text-left ${
            customBg ? "" : `bg-gradient-to-r ${gradientFallback}`
          }`}
          style={customBg ? { backgroundColor: customBg } : undefined}
        >
          <p className="text-xs font-bold tracking-[0.2em] uppercase opacity-70 mb-2">
            {label || "Featured"}
          </p>
          <h2 className="font-heading text-2xl sm:text-4xl font-semibold">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-2 text-sm sm:text-base opacity-80 max-w-xl">
              {subtitle}
            </p>
          ) : null}
          <span className="mt-5 inline-flex rounded-[var(--radius-sm)] bg-brand px-6 py-2 text-sm font-semibold text-white">
            {buttonText || "SHOP NOW"}
          </span>
        </Link>
      </div>
    </section>
  );
}

function isLightHex(hex: string) {
  const h = hex.replace("#", "").trim();
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return false;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62;
}

/** Admin-managed collections as pills on the home landing page. */
export function CollectionsStrip({
  collections,
  title = "Explore collections",
}: {
  collections: { id: string; name: string; slug: string }[];
  title?: string;
}) {
  if (!collections?.length) return null;

  const pillClass =
    "inline-flex shrink-0 items-center rounded-full border border-line-strong bg-white px-3.5 py-2 text-[13px] sm:text-sm font-medium text-text hover:border-brand hover:text-brand transition-colors";

  return (
    <section className="py-6 sm:py-8">
      <div className="mx-auto max-w-[1400px] sm:px-5">
        <h2 className="section-title mb-4 sm:mb-5 px-3 sm:px-0">{title}</h2>

        {/* Mobile: single-row horizontal scroll */}
        <HorizontalScroll className="sm:hidden overflow-x-auto scrollbar-hide px-3 pb-1">
          <div className="flex w-max gap-2 pr-3">
            {collections.map((c) => (
              <Link
                key={c.id}
                href={`/collections/${c.slug}`}
                className={pillClass}
              >
                {c.name}
              </Link>
            ))}
          </div>
        </HorizontalScroll>

        {/* Tablet / desktop: wrapping pills */}
        <div className="hidden sm:flex flex-wrap gap-2.5">
          {collections.map((c) => (
            <Link
              key={c.id}
              href={`/collections/${c.slug}`}
              className={pillClass}
            >
              {c.name}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function WhyBrand() {
  const items: {
    title: string;
    body: string;
    icon: LucideIcon;
  }[] = [
    {
      title: "Top Brands",
      body: "Shop a curated range of fashion, beauty and lifestyle brands in one place.",
      icon: BadgeCheck,
    },
    {
      title: "Easy Returns",
      body: "Changed your mind? Raise a return from your account as per our returns policy.",
      icon: RotateCcw,
    },
    {
      title: "Secure Payments",
      body: "Pay safely with UPI, cards, net banking, wallets or cash on delivery.",
      icon: ShieldCheck,
    },
    {
      title: "Fast Delivery",
      body: "Orders are packed with care and shipped across India.",
      icon: Truck,
    },
  ];

  return (
    <section className="py-10 sm:py-14 bg-ink text-white">
      <div className="mx-auto max-w-[1400px] px-3 sm:px-5">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-6 sm:mb-8">
          Why {BRAND}?
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          {items.map(({ title, body, icon: Icon }) => (
            <div
              key={title}
              className="rounded-xl border border-white/15 bg-white/5 p-4 sm:p-5 hover:border-brand/50 hover:bg-white/[0.07] transition-colors"
            >
              <div className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-brand text-white shadow-[0_0_0_4px_rgba(252,39,121,0.18)]">
                <Icon size={20} strokeWidth={2.25} aria-hidden />
              </div>
              <h3 className="font-semibold text-brand mb-1.5 sm:mb-2 text-[15px] sm:text-base leading-snug">
                {title}
              </h3>
              <p className="text-[13px] sm:text-sm text-white/80 leading-relaxed">
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export type HomePromoBanner = {
  id: string;
  title?: string | null;
  label?: string | null;
  subtitle?: string | null;
  buttonText?: string | null;
  linkUrl?: string | null;
  backgroundColor?: string | null;
  imageUrl?: string | null;
  mobileImageUrl?: string | null;
  imageAlt?: string | null;
};

/** Admin `home_promo` banners as a curated 2-up / 3-up card grid. */
export function PromoBannerGrid({ banners }: { banners: HomePromoBanner[] }) {
  const items = banners.filter(
    (b) => b.title?.trim() || isUsableImageSrc(b.imageUrl),
  );
  if (!items.length) return null;
  const cols =
    items.length === 1
      ? "grid-cols-1"
      : items.length === 2 || items.length === 4
        ? "grid-cols-1 sm:grid-cols-2"
        : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <section className="py-5 sm:py-7">
      <Container>
        <div className={`grid gap-3 sm:gap-4 ${cols}`}>
          {items.map((b) => {
            const href = b.linkUrl || "/collections/all";
            const img = isUsableImageSrc(b.imageUrl) ? b.imageUrl! : "";
            if (img) {
              return (
                <Link
                  key={b.id}
                  href={href}
                  className="relative block aspect-[16/7] overflow-hidden rounded-[var(--radius-lg)] bg-surface"
                >
                  <Image
                    src={img}
                    alt={b.imageAlt || b.title || "Offer"}
                    fill
                    className="object-cover transition-transform duration-500 hover:scale-[1.02]"
                    sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw"
                  />
                </Link>
              );
            }
            const bg = b.backgroundColor?.trim() || "#001325";
            const light = isLightHex(bg);
            return (
              <Link
                key={b.id}
                href={href}
                className={`group flex min-h-[150px] flex-col justify-center rounded-[var(--radius-lg)] px-6 py-6 sm:min-h-[180px] sm:px-8 ${
                  light ? "text-ink" : "text-white"
                }`}
                style={{ backgroundColor: bg }}
              >
                {b.label ? (
                  <span className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.18em] opacity-75">
                    {b.label}
                  </span>
                ) : null}
                <span className="font-heading text-xl font-semibold leading-tight sm:text-2xl">
                  {b.title}
                </span>
                {b.subtitle ? (
                  <span className="mt-1 text-sm opacity-85">{b.subtitle}</span>
                ) : null}
                <span className="mt-4 inline-flex w-fit rounded-[var(--radius-sm)] bg-brand px-4 py-1.5 text-xs font-semibold text-white transition-colors group-hover:bg-brand-hover">
                  {b.buttonText || "SHOP NOW"}
                </span>
              </Link>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

export type BrandLite = {
  id: string;
  name: string;
  slug?: string | null;
  logoUrl?: string | null;
};

/** Fallback when GET /brands is unavailable: unique brands from loaded products. */
export function brandsFromProducts(products: Product[], max = 12): BrandLite[] {
  const seen = new Map<string, BrandLite>();
  for (const p of products) {
    const b = p.brand;
    if (!b?.id || !b.name?.trim() || seen.has(b.id)) continue;
    seen.set(b.id, b);
    if (seen.size >= max) break;
  }
  return [...seen.values()];
}

export function FeaturedBrands({
  brands,
  title = "Top brands",
}: {
  brands: BrandLite[];
  title?: string;
}) {
  if (brands.length < 2) return null;
  return (
    <section className="bg-surface-alt py-6 sm:py-8">
      <Container>
        <SectionHeader
          title={title}
          subtitle="Genuine products from brands you love"
          href="/brands"
        />
        <div className="scrollbar-hide -mx-3 flex gap-3 overflow-x-auto px-3 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-6">
          {brands.map((b) => {
            const logo = isUsableImageSrc(b.logoUrl) ? b.logoUrl! : "";
            return (
              <Link
                key={b.id}
                href={b.slug ? `/brands/${b.slug}` : `/search?q=${encodeURIComponent(b.name)}`}
                className="group flex w-[38vw] max-w-[180px] shrink-0 flex-col items-center gap-2 rounded-[var(--radius-md)] border border-line bg-white p-3 text-center transition-shadow hover:shadow-[var(--shadow-pop)] sm:w-auto sm:max-w-none"
              >
                <span className="relative grid aspect-[3/2] w-full place-items-center overflow-hidden rounded-[var(--radius-sm)] bg-white">
                  {logo ? (
                    <Image src={logo} alt={b.name} fill className="object-contain p-2" sizes="180px" />
                  ) : (
                    <span className="font-heading text-lg font-semibold text-ink">{b.name}</span>
                  )}
                </span>
                <span className="truncate text-[13px] font-medium text-text group-hover:text-brand">
                  {b.name}
                </span>
              </Link>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

export type EditorialPost = {
  slug: string;
  title: string;
  excerpt?: string | null;
  coverImage?: string | null;
};

/** Latest blog posts — renders nothing when the blog is empty. */
export function EditorialSection({
  posts,
  title = "The style edit",
  subtitle = "Tips, trends and how-tos",
}: {
  posts: EditorialPost[];
  title?: string;
  subtitle?: string;
}) {
  if (!posts.length) return null;
  return (
    <section className="py-6 sm:py-8">
      <Container>
        <SectionHeader title={title} subtitle={subtitle} href="/blogs" actionLabel="Read more" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {posts.map((p) => {
            const img = isUsableImageSrc(p.coverImage) ? p.coverImage! : "";
            return (
              <Link
                key={p.slug}
                href={`/blogs/${p.slug}`}
                className="group overflow-hidden rounded-[var(--radius-md)] border border-line bg-white transition-shadow hover:shadow-[var(--shadow-pop)]"
              >
                <span className="relative block aspect-[16/10] bg-surface">
                  {img ? (
                    <Image src={img} alt={p.title} fill className="object-cover" sizes="(max-width:640px) 100vw, 25vw" />
                  ) : null}
                </span>
                <span className="block p-3.5">
                  <span className="line-clamp-2 font-heading text-[15px] font-semibold leading-snug text-ink group-hover:text-brand">
                    {p.title}
                  </span>
                  {p.excerpt ? (
                    <span className="mt-1 line-clamp-2 text-[13px] text-muted">{p.excerpt}</span>
                  ) : null}
                </span>
              </Link>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
