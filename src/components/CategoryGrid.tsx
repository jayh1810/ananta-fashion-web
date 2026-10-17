"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LocalImage } from "@/components/LocalImage";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Category } from "@/lib/api";
import { SectionTitle } from "@/components/HomePromoSections";

/**
 * Circular categories — centered when they fit; prev/next + wheel scroll
 * when they overflow. Button clicks use smooth horizontal scroll.
 */
export function CategoryGrid({
  categories,
  title,
}: {
  categories: Category[];
  title?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const overflow = max > 4;
    setOverflows(overflow);
    setCanPrev(overflow && el.scrollLeft > 4);
    setCanNext(overflow && el.scrollLeft < max - 4);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    updateScrollState();
    const track = el.firstElementChild;
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    if (track) ro.observe(track);
    window.addEventListener("resize", updateScrollState);
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const t = window.setTimeout(updateScrollState, 400);

    let target = el.scrollLeft;
    let frame = 0;

    const animate = () => {
      const diff = target - el.scrollLeft;
      if (Math.abs(diff) < 0.5) {
        el.scrollLeft = target;
        frame = 0;
        return;
      }
      el.scrollLeft += diff * 0.18;
      frame = requestAnimationFrame(animate);
    };

    const onWheel = (e: WheelEvent) => {
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 4) return;
      // Trackpads already scroll horizontally with native momentum.
      if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;

      const unit =
        e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? el.clientWidth : 1;
      const delta = e.deltaY * unit;
      const base = frame ? target : el.scrollLeft;
      if ((delta < 0 && base <= 0) || (delta > 0 && base >= max - 1)) return;

      e.preventDefault();
      target = Math.max(0, Math.min(max, base + delta));
      if (!frame) frame = requestAnimationFrame(animate);
    };

    const stopAnimation = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", stopAnimation, { passive: true });

    return () => {
      stopAnimation();
      el.removeEventListener("touchstart", stopAnimation);
      ro.disconnect();
      window.removeEventListener("resize", updateScrollState);
      window.clearTimeout(t);
      el.removeEventListener("scroll", updateScrollState);
      el.removeEventListener("wheel", onWheel);
    };
  }, [categories, updateScrollState]);

  function scrollByDir(dir: -1 | 1) {
    const el = scrollerRef.current;
    if (!el) return;
    const step = Math.min(el.clientWidth * 0.7, 400);
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  }

  if (!categories?.length) return null;

  const navBtn =
    "hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-white text-ink shadow-md transition hover:border-brand hover:text-brand disabled:pointer-events-none disabled:opacity-30 md:flex";

  return (
    <section className="relative w-full bg-white py-5 sm:py-7">
      {title ? (
        <SectionTitle title={title} center className="px-4 sm:px-8" />
      ) : null}
      <div
        className={`flex w-full items-center ${
          overflows ? "px-3 sm:gap-3 sm:px-4" : "px-4 sm:px-8"
        }`}
      >
        {overflows ? (
          <button
            type="button"
            aria-label="Previous categories"
            disabled={!canPrev}
            onClick={() => scrollByDir(-1)}
            className={navBtn}
          >
            <ChevronLeft size={20} strokeWidth={2.25} />
          </button>
        ) : null}

        <div
          ref={scrollerRef}
          className="scrollbar-hide min-w-0 flex-1 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]"
        >
          <div
            className={`flex w-max gap-5 sm:gap-6 lg:gap-7 ${
              overflows ? "justify-start" : "min-w-full justify-center"
            }`}
          >
            {categories.map((c) => (
              <Link
                key={c.slug}
                href={`/collections/${c.slug}`}
                className="group w-[72px] shrink-0 text-center sm:w-[88px] lg:w-[96px]"
              >
                <div className="relative mx-auto h-[64px] w-[64px] overflow-hidden rounded-full border-2 border-transparent bg-brand-soft ring-1 ring-line transition-all group-active:border-brand sm:h-[88px] sm:w-[88px] sm:group-hover:border-brand sm:group-hover:shadow-md lg:h-[96px] lg:w-[96px]">
                  {c.imageUrl ? (
                    <LocalImage src={c.imageUrl} alt={c.name} className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-xs font-bold text-ink">
                      {c.name.slice(0, 2)}
                    </div>
                  )}
                </div>
                <p className="mt-2 line-clamp-2 px-0.5 text-[11px] font-medium leading-tight text-text sm:text-[13px] sm:group-hover:text-brand">
                  {c.name}
                </p>
              </Link>
            ))}
          </div>
        </div>

        {overflows ? (
          <button
            type="button"
            aria-label="Next categories"
            disabled={!canNext}
            onClick={() => scrollByDir(1)}
            className={navBtn}
          >
            <ChevronRight size={20} strokeWidth={2.25} />
          </button>
        ) : null}
      </div>
    </section>
  );
}
