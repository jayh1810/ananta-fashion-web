"use client";

import { useEffect, useRef, useState } from "react";
import { ProductCarousel } from "@/components/ProductCarousel";
import { ProductCard } from "@/components/ProductCard";
import { Container, ProductCardSkeleton, SectionHeader, Skeleton } from "@/components/ui";
import { getApiUrl, rewriteMediaUrls, type Product } from "@/lib/api";
import { BandHeading, bandStyle } from "@/components/HomePromoSections";

export type HomeRailSpec = {
  id: string;
  name: string;
  slug: string;
  limit: number;
  href: string;
  /** Coloured / gradient band with a centred heading (admin `config.background`). */
  band?: { from: string; to?: string; subtitle?: string };
  /** `grid` is the dense “top brands” block; carousels stay the default. */
  layout?: "carousel" | "grid";
};

type ProductsResponse = { data: Product[] };

async function fetchRailProducts(
  slug: string,
  limit: number,
  bestsellersFallback?: Product[],
): Promise<Product[]> {
  if (slug === "__promoted__") return [];

  try {
    const path = `/products?collection=${encodeURIComponent(slug)}&limit=${limit}`;
    const res = await fetch(`${getApiUrl()}${path}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (res.ok) {
      const json = rewriteMediaUrls(
        (await res.json().catch(() => ({}))) as ProductsResponse,
      );
      const list = json.data || [];
      if (list.length) return list.slice(0, limit);
    }
  } catch {
    /* fall through */
  }

  if (slug === "bestsellers" && bestsellersFallback?.length) {
    return bestsellersFallback.slice(0, limit);
  }

  if (slug !== "bestsellers") {
    try {
      const res = await fetch(
        `${getApiUrl()}/products?category=${encodeURIComponent(slug)}&limit=${limit}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        },
      );
      if (res.ok) {
        const json = rewriteMediaUrls(
          (await res.json().catch(() => ({}))) as ProductsResponse,
        );
        return (json.data || []).slice(0, limit);
      }
    } catch {
      /* ignore */
    }
  }
  return [];
}

function RailSkeleton({ title }: { title: string }) {
  return (
    <section className="py-6 sm:py-8" aria-busy="true" aria-label={title}>
      <Container>
        <Skeleton className="mb-4 h-6 w-48 max-w-full" />
        <div className="flex gap-2.5 overflow-hidden sm:gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="w-[44vw] max-w-[230px] shrink-0 sm:w-[220px]">
              <ProductCardSkeleton />
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

function LazyProductRail({
  rail,
  initialProducts,
  bestsellersFallback,
  eager,
}: {
  rail: HomeRailSpec;
  initialProducts?: Product[];
  bestsellersFallback?: Product[];
  eager?: boolean;
}) {
  const rootRef = useRef<HTMLElement | null>(null);
  const seeded = Boolean(initialProducts?.length);
  const [products, setProducts] = useState<Product[] | null>(
    seeded ? initialProducts! : null,
  );
  const [loading, setLoading] = useState(!seeded);
  const [visible, setVisible] = useState(Boolean(eager || seeded));
  const fetchedRef = useRef(seeded);

  useEffect(() => {
    if (eager || seeded) {
      setVisible(true);
      return;
    }
    const el = rootRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { root: null, rootMargin: "480px 0px", threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [eager, seeded]);

  useEffect(() => {
    if (!visible || fetchedRef.current) return;
    if (rail.slug === "__promoted__") {
      fetchedRef.current = true;
      setProducts([]);
      setLoading(false);
      return;
    }
    fetchedRef.current = true;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const list = await fetchRailProducts(
        rail.slug,
        rail.limit,
        bestsellersFallback,
      );
      if (cancelled) return;
      setProducts(list);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, rail.slug, rail.limit, bestsellersFallback]);

  if (products && products.length === 0) return null;

  if (!visible || (loading && !products)) {
    return (
      <section ref={rootRef}>
        <RailSkeleton title={rail.name} />
      </section>
    );
  }

  if (!products?.length) return null;

  if (rail.layout === "grid") {
    return (
      <section ref={rootRef} className="py-6 sm:py-8">
        <Container>
          <SectionHeader title={rail.name} href={rail.href} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
            {products.map((product, i) => (
              <ProductCard
                key={product.id}
                product={product}
                prefetch={false}
                imagePriority={Boolean(eager) && i < 2}
                imageSizes="(max-width:640px) 50vw, (max-width:1280px) 25vw, 240px"
              />
            ))}
          </div>
        </Container>
      </section>
    );
  }

  if (rail.band) {
    return (
      <section
        ref={rootRef}
        className="my-3 py-6 sm:my-5 sm:py-9"
        style={bandStyle(rail.band.from, rail.band.to)}
      >
        <Container>
          <BandHeading title={rail.name} subtitle={rail.band.subtitle} />
          <ProductCarousel products={products} eagerFirst={Boolean(eager)} />
        </Container>
      </section>
    );
  }

  return (
    <section ref={rootRef} className="py-6 sm:py-8">
      <Container>
        <SectionHeader title={rail.name} href={rail.href} />
        <ProductCarousel products={products} eagerFirst={Boolean(eager)} />
      </Container>
    </section>
  );
}

/**
 * Home rails: first rail SSR/eager for LCP; remaining collections fetch on scroll
 * (same idea as collection infinite scroll — no N parallel product APIs on first paint).
 */
export function HomeProductRails({
  rails,
  initialBySlug = {},
  bestsellersFallback = [],
  eagerCount = 1,
}: {
  rails: HomeRailSpec[];
  initialBySlug?: Record<string, Product[]>;
  bestsellersFallback?: Product[];
  eagerCount?: number;
}) {
  if (!rails.length) return null;
  return (
    <>
      {rails.map((rail, index) => (
        <LazyProductRail
          key={rail.id}
          rail={rail}
          initialProducts={initialBySlug[rail.slug]}
          bestsellersFallback={bestsellersFallback}
          eager={index < eagerCount}
        />
      ))}
    </>
  );
}
