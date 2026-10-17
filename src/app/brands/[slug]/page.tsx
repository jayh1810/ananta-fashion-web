import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api, BRAND, type Product } from "@/lib/api";
import { fetchBrand } from "@/lib/brands";
import { absoluteUrl, metadataForPath } from "@/lib/seo";
import { buildBreadcrumbJsonLd, buildCollectionJsonLd } from "@/lib/schema";
import {
  CollectionProductGrid,
  COLLECTION_PAGE_SIZE,
} from "@/components/CollectionProductGrid";

export const revalidate = 120;

type ProductsResponse = {
  data: Product[];
  meta?: { total: number; page: number; limit: number; pages: number };
};

function productBasePath(slug: string) {
  return `/products?brand=${encodeURIComponent(slug)}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const brand = await fetchBrand(slug).catch(() => null);
  if (!brand) return { title: "Brand not found", robots: { index: false } };
  return metadataForPath(`/brands/${brand.slug}`, {
    title: brand.seoTitle || `${brand.name} – Shop ${brand.name} products online`,
    description:
      brand.seoDescription ||
      brand.description ||
      `Shop ${brand.productCount} ${brand.name} products online at ${BRAND}. Genuine products, offers and fast delivery across India.`,
    image: brand.logoUrl || null,
  });
}

export default async function BrandPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await fetchBrand(slug);
  if (!brand) notFound();

  const basePath = productBasePath(brand.slug);
  let list: Product[] = [];
  let total = 0;
  let pages = 1;
  try {
    const res = await api<ProductsResponse>(
      `${basePath}&limit=${COLLECTION_PAGE_SIZE}&page=1`,
    );
    list = res.data || [];
    total = Math.max(res.meta?.total ?? list.length, list.length);
    pages = res.meta?.pages ?? Math.max(1, Math.ceil(total / COLLECTION_PAGE_SIZE));
  } catch {
    /* grid shows its empty state */
  }

  const url = absoluteUrl(`/brands/${brand.slug}`);
  const pageLd = buildCollectionJsonLd({
    url,
    name: brand.name,
    description: brand.description || `${brand.name} products at ${BRAND}`,
    productUrls: list.slice(0, 24).map((p) => absoluteUrl(`/products/${p.slug}`)),
  });
  const breadcrumbLd = buildBreadcrumbJsonLd([
    { name: "Home", href: "/" },
    { name: "Brands", href: "/brands" },
    { name: brand.name, href: `/brands/${brand.slug}` },
  ]);

  return (
    <div className="bg-[var(--page-band)]">
    <div className="mx-auto max-w-[1400px] px-3 py-4 sm:px-5 sm:py-5">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pageLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <nav className="mb-2 text-xs text-muted lg:text-[13px]" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-brand">
          Home
        </Link>
        <span className="mx-1.5">›</span>
        <Link href="/brands" className="hover:text-brand">
          Brands
        </Link>
        <span className="mx-1.5">›</span>
        <span className="text-ink">{brand.name}</span>
      </nav>

      <div className="mb-4 flex items-center gap-4 rounded-[var(--radius-sm)] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] sm:mb-5">
        {brand.logoUrl ? (
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-line bg-white sm:h-16 sm:w-16">
            <Image
              src={brand.logoUrl}
              alt={brand.name}
              fill
              sizes="64px"
              className="object-contain p-1.5"
            />
          </div>
        ) : null}
        <div className="min-w-0">
          <h1 className="font-heading text-[22px] font-semibold leading-tight text-ink sm:text-[26px]">
            {brand.name}
            <span className="ml-2 align-middle text-sm font-normal text-muted">({total})</span>
          </h1>
          {brand.description ? (
            <p className="mt-1 line-clamp-2 text-[13px] text-muted sm:text-sm">
              {brand.description}
            </p>
          ) : null}
        </div>
      </div>

      <CollectionProductGrid
        cacheKey={`brand:${brand.slug}`}
        productBasePath={basePath}
        initialProducts={list}
        initialTotal={total}
        initialPages={pages}
        emptySlot={
          <p className="py-12 text-center text-sm text-muted">
            No {brand.name} products available right now.
          </p>
        }
      />
    </div>
    </div>
  );
}
