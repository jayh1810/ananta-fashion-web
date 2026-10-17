import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LocalImage } from "@/components/LocalImage";
import { Container } from "@/components/ui";
import { SnapCarousel } from "@/components/SnapCarousel";
import { DealCountdown } from "@/components/DealCountdown";
import { isUsableImageSrc } from "@/lib/is-usable-image-src";

/** One admin-managed image card (`HomeSection.config.items[]`). */
export type PromoItem = {
  imageUrl?: string;
  imageAlt?: string;
  title?: string;
  subtitle?: string;
  label?: string;
  href?: string;
};

export function promoItems(config?: Record<string, unknown> | null): PromoItem[] {
  const raw = config?.items;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (it): it is PromoItem =>
      !!it && typeof it === "object" && (isUsableImageSrc((it as PromoItem).imageUrl) || !!(it as PromoItem).title),
  );
}

function hrefOf(href?: string | null) {
  const v = (href || "").trim();
  if (!v) return "/collections/all";
  if (v.startsWith("/") || /^https?:\/\//i.test(v)) return v;
  return `/${v.replace(/^\/+/, "")}`;
}

/** Solid colour, or a top-to-bottom gradient when `to` is set. */
export function bandStyle(from?: string, to?: string): CSSProperties | undefined {
  if (!from) return undefined;
  return to
    ? { backgroundImage: `linear-gradient(180deg, ${from} 0%, ${to} 100%)` }
    : { backgroundColor: from };
}

/** Nykaa-style home heading: accent uppercase text between gold diamond ornaments. */
export function SectionTitle({
  title,
  subtitle,
  center,
  className = "",
}: {
  title: string;
  subtitle?: string;
  center?: boolean;
  className?: string;
}) {
  return (
    <div className={`mb-3 sm:mb-5 ${center ? "text-center" : ""} ${className}`}>
      <h2
        className={`flex items-center gap-2 font-heading text-[17px] font-bold uppercase leading-tight tracking-[0.04em] text-[var(--heading-accent)] sm:gap-3 sm:text-[24px] ${
          center ? "justify-center" : ""
        }`}
      >
        <Ornament />
        <span className="min-w-0">{title}</span>
        <Ornament flip />
      </h2>
      {subtitle ? (
        <p className="mt-1 text-[13px] text-text sm:text-[15px]">{subtitle}</p>
      ) : null}
    </div>
  );
}

function Ornament({ flip }: { flip?: boolean }) {
  return (
    <svg
      width="28"
      height="16"
      viewBox="0 0 28 16"
      aria-hidden
      className={`shrink-0 text-[var(--heading-ornament)] ${flip ? "-scale-x-100" : ""}`}
    >
      <path d="M2 8 5 5l3 3-3 3z" fill="currentColor" />
      <path d="M9 8 13 3l4 5-4 5z" fill="currentColor" opacity="0.85" />
      <path d="M18 8 23 2l5 6-5 6z" fill="currentColor" />
    </svg>
  );
}

/** Right-aligned heading used on coloured homepage bands. */
export function BandHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-4 text-right sm:mb-5">
      <h2 className="font-heading text-[20px] font-bold uppercase leading-tight tracking-[0.04em] text-[#2E2121] sm:text-[28px]">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[#2E2121]/75 sm:text-[13px]">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

/** Bottom-left caption + "Shop Now" chip over a gradient (Nykaa hero / offer cards). */
function OverlayCaption({ item }: { item: PromoItem }) {
  if (!item.title && !item.subtitle) return null;
  return (
    <span className="absolute inset-x-0 bottom-0 block bg-gradient-to-t from-black/75 via-black/35 to-transparent px-3.5 pb-3.5 pt-16 text-white lg:px-4 lg:pb-4">
      {item.title ? (
        <span className="line-clamp-2 font-heading text-lg font-bold leading-tight xl:text-[22px]">
          {item.title}
        </span>
      ) : null}
      <span className="mt-1 flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[13px] opacity-90 xl:text-[15px]">{item.subtitle}</span>
        <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-white px-3 py-1 text-[12px] font-semibold text-brand xl:px-3.5 xl:py-1.5 xl:text-[13px]">
          Shop Now <ArrowRight size={12} aria-hidden />
        </span>
      </span>
    </span>
  );
}

function CardImage({
  item,
  priority,
  className = "object-cover",
}: {
  item: PromoItem;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  const src = isUsableImageSrc(item.imageUrl) ? item.imageUrl! : "";
  if (!src) return <span className="absolute inset-0 bg-gradient-to-br from-brand-soft to-[#ffd3e4]" aria-hidden />;
  return (
    <LocalImage
      src={src}
      alt={item.imageAlt || item.title || "Offer"}
      priority={priority}
      className={`absolute inset-0 h-full w-full ${className} transition-transform duration-500 group-hover:scale-[1.03]`}
    />
  );
}

export type HeroCardBanner = {
  id: string;
  title?: string | null;
  subtitle?: string | null;
  imageUrl?: string | null;
  mobileImageUrl?: string | null;
  imageAlt?: string | null;
  linkUrl?: string | null;
};

/** Nykaa homepage hero: heading over two wide offer banners. */
export function HeroCards({
  banners,
  bandColor,
  bandTo,
  title,
  subtitle,
}: {
  banners: HeroCardBanner[];
  bandColor?: string;
  bandTo?: string;
  title?: string;
  subtitle?: string;
}) {
  const items = banners
    .map((b) => ({
      id: b.id,
      imageUrl: (isUsableImageSrc(b.mobileImageUrl) ? b.mobileImageUrl : b.imageUrl) || undefined,
      imageAlt: b.imageAlt || undefined,
      title: b.title || undefined,
      subtitle: b.subtitle || undefined,
      href: b.linkUrl || undefined,
    }))
    .filter((b) => isUsableImageSrc(b.imageUrl));
  if (!items.length) return null;
  return (
    <section
      className="py-4 sm:py-6"
      style={bandStyle(bandColor, bandTo) || { backgroundColor: "var(--hero-band)" }}
    >
      <Container>
        {title ? <SectionTitle title={title} subtitle={subtitle} center /> : null}
        <SnapCarousel label={title || "Featured offers"}>
          {items.map((it, i) => (
            <Link
              key={it.id}
              href={hrefOf(it.href)}
              className="group relative block aspect-[4/5] w-[72vw] max-w-[280px] shrink-0 snap-start overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-card)] sm:w-[calc((100%-1rem)/2)] sm:max-w-none lg:w-[calc((100%-3rem)/4)]"
            >
              <CardImage
                item={it}
                priority={i === 0}
                sizes="(max-width:640px) 72vw, (max-width:1024px) 50vw, 25vw"
              />
              <OverlayCaption item={it} />
            </Link>
          ))}
        </SnapCarousel>
      </Container>
    </section>
  );
}

/** Thin bordered offer strips (bank / payment offers) — one per slide. */
export function OfferStrip({ items, title }: { items: PromoItem[]; title?: string }) {
  if (!items.length) return null;
  return (
    <section className="py-3 sm:py-5" aria-label={title || "Offers"}>
      <Container>
        <SnapCarousel label={title || "Offers"}>
          {items.map((it, i) => (
            <Link
              key={i}
              href={hrefOf(it.href)}
              className="group flex w-[92vw] shrink-0 snap-center items-center gap-3 overflow-hidden rounded-2xl border border-[var(--offer-border)] bg-white px-3 py-3 sm:w-[calc(100%-2.5rem)] sm:gap-5 sm:px-5 sm:py-4"
            >
              {isUsableImageSrc(it.imageUrl) ? (
                <span className="relative h-11 w-16 shrink-0 sm:h-14 sm:w-24">
                  <Image
                    src={it.imageUrl!}
                    alt={it.imageAlt || it.label || ""}
                    fill
                    sizes="96px"
                    className="object-contain"
                  />
                </span>
              ) : it.label ? (
                <span className="shrink-0 rounded-md bg-ink px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white sm:text-xs">
                  {it.label}
                </span>
              ) : null}
              <span className="h-10 w-px shrink-0 bg-line-strong" aria-hidden />
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold text-ink sm:text-lg">{it.title}</span>
                {it.subtitle ? (
                  <span className="block truncate text-[11px] text-muted sm:text-sm">{it.subtitle}</span>
                ) : null}
              </span>
            </Link>
          ))}
        </SnapCarousel>
      </Container>
    </section>
  );
}

/** "Limited-time deals" — wide offer cards with an optional live countdown. */
export function DealsSection({
  items,
  title,
  endsAt,
}: {
  items: PromoItem[];
  title?: string;
  endsAt?: string | null;
}) {
  if (!items.length) return null;
  return (
    <section className="py-4 sm:py-6">
      <Container>
        <div className="relative">
          <SectionTitle title={title || "Limited-time deals"} center />
          {endsAt ? (
            <div className="mb-3 flex justify-center sm:absolute sm:right-0 sm:top-1 sm:mb-0">
              <DealCountdown endsAt={endsAt} />
            </div>
          ) : null}
        </div>
        <SnapCarousel label={title || "Limited-time deals"}>
          {items.map((it, i) => (
            <Link
              key={i}
              href={hrefOf(it.href)}
              className="group relative block aspect-[2.2/1] w-[88vw] shrink-0 snap-start overflow-hidden rounded-2xl bg-surface sm:w-[calc((100%-1rem)/2)]"
            >
              <CardImage item={it} sizes="(max-width:640px) 82vw, 33vw" />
              <OverlayCaption item={it} />
            </Link>
          ))}
        </SnapCarousel>
      </Container>
    </section>
  );
}

/**
 * Titled card rail.
 * - `overlay`: landscape cards with caption on the image ("Popular this season").
 * - `caption`: portrait tiles with caption underneath on a coloured band ("Top brands").
 */
export function CardRail({
  items,
  title,
  subtitle,
  variant = "overlay",
  background,
  backgroundTo,
}: {
  items: PromoItem[];
  title?: string;
  subtitle?: string;
  variant?: "overlay" | "caption";
  background?: string;
  backgroundTo?: string;
}) {
  if (!items.length) return null;
  const band = variant === "caption" || !!background;
  return (
    <section
      className={band ? "my-3 py-6 sm:my-5 sm:py-8" : "py-4 sm:py-6"}
      style={band ? bandStyle(background || "#fde6ee", backgroundTo) : undefined}
    >
      <Container>
        {title ? (
          variant === "caption" || background ? (
            <BandHeading title={title} subtitle={subtitle} />
          ) : (
            <SectionTitle title={title} subtitle={subtitle} />
          )
        ) : null}
        {variant === "caption" ? (
          <SnapCarousel label={title || "Featured"} arrowTop="40%" trackClassName="gap-3 sm:gap-4">
            {items.map((it, i) => (
              <Link
                key={i}
                href={hrefOf(it.href)}
                className="group w-[40vw] max-w-[200px] shrink-0 snap-start text-center sm:w-[calc((100%-5rem)/6)]"
              >
                <span className="relative block aspect-[3/4] overflow-hidden rounded-xl bg-white">
                  <CardImage item={it} sizes="(max-width:640px) 40vw, 200px" />
                  {it.label ? (
                    <span className="absolute inset-x-2 bottom-2 truncate rounded-md bg-black/55 px-2 py-1 text-[11px] font-medium text-white">
                      {it.label}
                    </span>
                  ) : null}
                </span>
                {it.title ? (
                  <span className="mt-2 block truncate font-heading text-[15px] font-bold text-ink sm:text-lg">{it.title}</span>
                ) : null}
                {it.subtitle ? (
                  <span className="block truncate text-[13px] text-text sm:text-sm">{it.subtitle}</span>
                ) : null}
              </Link>
            ))}
          </SnapCarousel>
        ) : (
          <SnapCarousel label={title || "Featured"}>
            {items.map((it, i) => (
              <Link
                key={i}
                href={hrefOf(it.href)}
                className="group relative block aspect-[4/3] w-[78vw] max-w-[440px] shrink-0 snap-start overflow-hidden rounded-xl bg-surface sm:w-[calc((100%-2rem)/3)]"
              >
                <CardImage item={it} sizes="(max-width:640px) 78vw, 33vw" />
                <OverlayCaption item={it} />
              </Link>
            ))}
          </SnapCarousel>
        )}
      </Container>
    </section>
  );
}
