"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Product } from "@/lib/api";
import { ProductCard } from "@/components/ProductCard";

/** Horizontal, snap-scrolling product row with desktop arrows (Nykaa-style rail). */
export function ProductCarousel({
  products,
  eagerFirst = false,
}: {
  products: Product[];
  eagerFirst?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft < max - 4);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [update, products.length]);

  function step(dir: -1 | 1) {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  }

  const arrow =
    "absolute top-[35%] z-10 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white text-ink shadow-[var(--shadow-pop)] transition-opacity hover:text-brand md:grid disabled:pointer-events-none disabled:opacity-0";

  return (
    <div className="relative">
      <button type="button" aria-label="Scroll left" className={`${arrow} -left-3`} disabled={!canPrev} onClick={() => step(-1)}>
        <ChevronLeft size={20} aria-hidden />
      </button>
      <div
        ref={ref}
        className="scrollbar-hide -mx-3 flex snap-x snap-mandatory gap-2.5 overflow-x-auto scroll-px-3 px-3 pb-2 sm:-mx-0 sm:gap-4 sm:px-0 sm:scroll-px-0"
      >
        {products.map((p, i) => (
          <div
            key={p.id}
            className="w-[44vw] max-w-[230px] shrink-0 snap-start sm:w-[220px]"
          >
            <ProductCard
              product={p}
              prefetch={false}
              imagePriority={eagerFirst && i < 2}
              imageSizes="(max-width:640px) 44vw, 230px"
            />
          </div>
        ))}
      </div>
      <button type="button" aria-label="Scroll right" className={`${arrow} -right-3`} disabled={!canNext} onClick={() => step(1)}>
        <ChevronRight size={20} aria-hidden />
      </button>
    </div>
  );
}
