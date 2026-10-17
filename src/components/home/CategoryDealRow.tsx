import Link from "next/link";
import { Container } from "@/components/ui";
import { LocalImage } from "@/components/LocalImage";
import { SectionTitle } from "@/components/HomePromoSections";
import { directMediaSrc, type Category } from "@/lib/api";

/** Category deal tiles — circles stay at the bottom of the page; these are the wide offer cards. */
export function CategoryDealRow({
  categories,
  title = "Shop by focus",
}: {
  categories: Category[];
  title?: string;
}) {
  const items = categories.filter((c) => c?.slug && c?.name).slice(0, 8);
  if (!items.length) return null;
  return (
    <section className="py-5 sm:py-7">
      <Container>
        <SectionTitle title={title} center />
        <div className="scrollbar-hide -mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((c) => {
            const img = directMediaSrc(c.imageUrl);
            return (
              <Link
                key={c.id || c.slug}
                href={`/collections/${c.slug}`}
                className="group relative block aspect-[4/5] w-[62vw] max-w-[220px] shrink-0 snap-start overflow-hidden rounded-2xl bg-brand-soft shadow-[var(--shadow-card)] sm:w-auto sm:max-w-none"
              >
                {img ? (
                  <LocalImage
                    src={img}
                    alt={c.name}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                ) : null}
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-3 pt-12">
                  <span className="block font-heading text-[15px] font-bold leading-tight text-white sm:text-lg">
                    {c.name}
                  </span>
                  <span className="mt-1 inline-flex rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-brand">
                    Shop
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
