import Link from "next/link";
import Image from "next/image";
import type { Category } from "@/lib/api";
import { HorizontalScroll } from "@/components/HorizontalScroll";

export function CategoryStripe({ categories }: { categories: Category[] }) {
  if (!categories?.length) return null;
  return (
    <section className="border-b border-border bg-white">
      <div className="mx-auto max-w-[1400px] px-3 sm:px-5 py-4 sm:py-5">
        <HorizontalScroll className="flex gap-3 sm:gap-5 overflow-x-auto scrollbar-hide pb-1">
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={`/collections/${c.slug}`}
              className="flex-shrink-0 w-[72px] sm:w-[88px] text-center group"
            >
              <div className="relative w-[72px] h-[72px] sm:w-[88px] sm:h-[88px] rounded-full overflow-hidden bg-cream border border-border mx-auto group-hover:border-gold transition-colors">
                {c.imageUrl ? (
                  <Image
                    src={c.imageUrl}
                    alt={c.name}
                    fill
                    className="object-cover"
                    sizes="88px"
                  />
                ) : (
                  <div className="w-full h-full grid place-items-center text-xs font-bold text-ink">
                    {c.name.slice(0, 2)}
                  </div>
                )}
              </div>
              <p className="mt-2 text-[11px] sm:text-xs font-medium leading-tight group-hover:text-teal">
                {c.name}
              </p>
            </Link>
          ))}
        </HorizontalScroll>
      </div>
    </section>
  );
}
