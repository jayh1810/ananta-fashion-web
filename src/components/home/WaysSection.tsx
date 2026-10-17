import Link from "next/link";
import { Container } from "@/components/ui";
import { LocalImage } from "@/components/LocalImage";
import { SectionTitle } from "@/components/HomePromoSections";
import { directMediaSrc } from "@/lib/api";

export type WayItem = {
  key: string;
  href: string;
  title: string;
  imageUrl?: string | null;
};

/** Numbered lifestyle grid (up to 9). Every tile is a real link from the homepage content. */
export function WaysSection({
  items,
  title = "9 ways to attract abundance",
  subtitle,
}: {
  items: WayItem[];
  title?: string;
  subtitle?: string;
}) {
  const list = items.filter((it) => it.title && it.href).slice(0, 9);
  if (!list.length) return null;
  return (
    <section className="bg-[var(--page-band)] py-6 sm:py-9">
      <Container>
        <SectionTitle title={title} subtitle={subtitle} center />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          {list.map((it, i) => {
            const img = directMediaSrc(it.imageUrl);
            return (
              <Link
                key={it.key}
                href={it.href}
                className="group relative block aspect-[4/3] overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-card)]"
              >
                {img ? (
                  <LocalImage
                    src={img}
                    alt={it.title}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <span className="absolute inset-0 bg-brand-soft" aria-hidden />
                )}
                <span className="absolute left-2.5 top-2.5 grid h-7 min-w-7 place-items-center rounded-full bg-brand px-1.5 text-[12px] font-bold text-white">
                  {i + 1}
                </span>
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-3 pt-10 font-heading text-[14px] font-bold leading-tight text-white sm:text-lg">
                  {it.title}
                </span>
              </Link>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
