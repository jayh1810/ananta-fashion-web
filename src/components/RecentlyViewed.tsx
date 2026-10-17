"use client";

import { useEffect, useState } from "react";
import { api, type Product } from "@/lib/api";
import { ProductCard } from "@/components/ProductCard";
import {
  forgetViewed,
  readRecentlyViewed,
  rememberViewed,
} from "@/lib/recently-viewed";

const SHOW = 4;

export function RecentlyViewed({ currentSlug }: { currentSlug: string }) {
  const [items, setItems] = useState<Product[]>([]);

  useEffect(() => {
    let cancelled = false;
    const previous = readRecentlyViewed().filter((s) => s !== currentSlug);
    rememberViewed(currentSlug);
    const wanted = previous.slice(0, SHOW);
    if (!wanted.length) return;
    api<{ data: Product[] }>(
      `/products?slugs=${encodeURIComponent(wanted.join(","))}`,
    )
      .then((res) => {
        if (cancelled) return;
        const data = Array.isArray(res?.data) ? res.data : [];
        const bySlug = new Map(data.map((p) => [p.slug, p]));
        const ordered = wanted
          .map((s) => bySlug.get(s))
          .filter((p): p is Product => Boolean(p));
        if (data.length <= wanted.length) {
          forgetViewed(wanted.filter((s) => !bySlug.has(s)));
        }
        setItems(ordered);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [currentSlug]);

  const visible = items.filter((p) => p.slug !== currentSlug);
  if (!visible.length) return null;

  return (
    <section className="mt-10 md:mt-14" aria-labelledby="recently-viewed-heading">
      <h2
        id="recently-viewed-heading"
        className="font-heading text-xl sm:text-2xl font-semibold text-black"
      >
        Recently Viewed
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {visible.slice(0, SHOW).map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            prefetch={false}
            imageSizes="(max-width:1024px) 50vw, 280px"
          />
        ))}
      </div>
    </section>
  );
}
