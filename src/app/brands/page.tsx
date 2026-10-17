import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { BRAND } from "@/lib/api";
import { fetchBrands, type StoreBrand } from "@/lib/brands";
import { metadataForPath } from "@/lib/seo";
import { buildBreadcrumbJsonLd } from "@/lib/schema";
import { isUsableImageSrc } from "@/lib/is-usable-image-src";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return metadataForPath("/brands", {
    title: `All brands A–Z | ${BRAND}`,
    description: `Browse every brand available at ${BRAND} — genuine products, offers and fast delivery across India.`,
  });
}

function groupByLetter(brands: StoreBrand[]) {
  const groups = new Map<string, StoreBrand[]>();
  for (const b of [...brands].sort((a, z) => a.name.localeCompare(z.name))) {
    const first = b.name.trim().charAt(0).toUpperCase();
    const key = /[A-Z]/.test(first) ? first : "#";
    groups.set(key, [...(groups.get(key) || []), b]);
  }
  return [...groups.entries()];
}

export default async function BrandsPage() {
  const [brands, featured] = await Promise.all([
    fetchBrands(),
    fetchBrands({ featured: true, limit: 12 }),
  ]);
  const groups = groupByLetter(brands);
  const breadcrumbLd = buildBreadcrumbJsonLd([
    { name: "Home", href: "/" },
    { name: "Brands", href: "/brands" },
  ]);

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-4 sm:px-5 sm:py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <nav className="mb-2 text-xs text-muted" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-brand">
          Home
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-ink">Brands</span>
      </nav>
      <h1 className="mb-4 font-heading text-[22px] font-semibold text-ink sm:mb-6 sm:text-[28px]">
        All brands
      </h1>

      {featured.length > 1 ? (
        <section className="mb-8">
          <h2 className="section-title mb-3">Top brands</h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {featured.map((b) => (
              <Link
                key={b.id}
                href={`/brands/${b.slug}`}
                className="group flex flex-col items-center gap-2 rounded-[var(--radius-md)] border border-line bg-white p-3 text-center transition-shadow hover:shadow-[var(--shadow-pop)]"
              >
                <span className="relative grid aspect-[3/2] w-full place-items-center overflow-hidden">
                  {isUsableImageSrc(b.logoUrl) ? (
                    <Image
                      src={b.logoUrl!}
                      alt={b.name}
                      fill
                      sizes="160px"
                      className="object-contain p-1.5"
                    />
                  ) : (
                    <span className="font-heading text-base font-semibold text-ink">{b.name}</span>
                  )}
                </span>
                <span className="w-full truncate text-[13px] font-medium text-text group-hover:text-brand">
                  {b.name}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {groups.length ? (
        <>
          <nav aria-label="Brands by letter" className="mb-4 flex flex-wrap gap-1.5">
            {groups.map(([letter]) => (
              <a
                key={letter}
                href={`#brands-${letter}`}
                className="grid h-8 min-w-8 place-items-center rounded-[var(--radius-sm)] border border-line bg-white px-2 text-[13px] font-semibold text-ink hover:border-brand hover:text-brand"
              >
                {letter}
              </a>
            ))}
          </nav>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {groups.map(([letter, list]) => (
              <section key={letter} id={`brands-${letter}`} className="scroll-mt-28">
                <h2 className="mb-2 border-b border-line pb-1 text-[15px] font-semibold text-brand">
                  {letter}
                </h2>
                <ul className="space-y-1">
                  {list.map((b) => (
                    <li key={b.id}>
                      <Link
                        href={`/brands/${b.slug}`}
                        className="flex items-center justify-between gap-2 py-0.5 text-[14px] text-text hover:text-brand"
                      >
                        <span className="truncate">{b.name}</span>
                        <span className="text-[12px] text-subtle">{b.productCount}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      ) : (
        <p className="py-12 text-center text-sm text-muted">Brands are coming soon.</p>
      )}
    </div>
  );
}
