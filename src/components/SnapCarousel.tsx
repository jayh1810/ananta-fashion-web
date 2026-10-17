"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Snap-scrolling row with round desktop arrows (Nykaa banner/card carousels). */
export function SnapCarousel({
  children,
  label,
  className = "",
  trackClassName = "gap-3 sm:gap-4",
  arrowTop = "50%",
}: {
  children: ReactNode;
  label: string;
  className?: string;
  trackClassName?: string;
  arrowTop?: string;
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
  }, [update]);

  function step(dir: -1 | 1) {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" });
  }

  const arrow =
    "absolute z-10 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-line bg-white text-ink shadow-[var(--shadow-pop)] transition-opacity hover:text-brand md:grid disabled:pointer-events-none disabled:opacity-0";

  return (
    <div className={`relative ${className}`} role="region" aria-label={label}>
      <button
        type="button"
        aria-label={`Previous — ${label}`}
        className={`${arrow} -left-2 lg:-left-5`}
        style={{ top: arrowTop }}
        disabled={!canPrev}
        onClick={() => step(-1)}
      >
        <ChevronLeft size={22} aria-hidden />
      </button>
      <div
        ref={ref}
        className={`scrollbar-hide flex snap-x snap-mandatory overflow-x-auto scroll-px-3 px-3 pb-1 sm:scroll-px-0 sm:px-0 ${trackClassName}`}
      >
        {children}
      </div>
      <button
        type="button"
        aria-label={`Next — ${label}`}
        className={`${arrow} -right-2 lg:-right-5`}
        style={{ top: arrowTop }}
        disabled={!canNext}
        onClick={() => step(1)}
      >
        <ChevronRight size={22} aria-hidden />
      </button>
    </div>
  );
}
