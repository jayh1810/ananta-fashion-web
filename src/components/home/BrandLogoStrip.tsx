import Link from "next/link";
import { Container } from "@/components/ui";
import { LocalImage } from "@/components/LocalImage";
import { SectionTitle } from "@/components/HomePromoSections";
import { directMediaSrc } from "@/lib/api";
import type { BrandLite } from "@/components/HomeSections";

/** Horizontal brand row. Scrolls on small screens, wraps into a tight strip on desktop. */
export function BrandLogoStrip({
  brands,
  title = "Top brands",
}: {
  brands: BrandLite[];
  title?: string;
}) {
  if (brands.length < 2) return null;
  return (
    <section className="bg-white py-5 sm:py-7">
      <Container>
        <SectionTitle title={title} center />
        <div className="scrollbar-hide -mx-3 flex gap-3 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:justify-center sm:gap-4 sm:overflow-visible sm:px-0">
          {brands.map((b) => {
            const logo = directMediaSrc(b.logoUrl);
            return (
              <Link
                key={b.id}
                href={b.slug ? `/brands/${b.slug}` : `/search?q=${encodeURIComponent(b.name)}`}
                className="group flex w-[28vw] max-w-[120px] shrink-0 flex-col items-center gap-2 sm:w-[104px]"
              >
                <span className="relative grid aspect-square w-full place-items-center overflow-hidden rounded-2xl border border-line bg-white shadow-[var(--shadow-card)]">
                  {logo ? (
                    <LocalImage src={logo} alt={b.name} className="absolute inset-0 h-full w-full object-contain p-3" />
                  ) : (
                    <span className="px-2 text-center font-heading text-sm font-bold text-ink">{b.name}</span>
                  )}
                </span>
                <span className="line-clamp-2 text-center text-[12px] font-semibold text-text group-hover:text-brand">
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
