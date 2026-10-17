"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Horizontal scroll strip that still allows vertical page scrolling.
 * Locks to one axis after the first ~10px of movement.
 */
export function HorizontalScroll({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number; left: number } | null>(null);
  const axis = useRef<"x" | "y" | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      start.current = { x: t.clientX, y: t.clientY, left: el.scrollLeft };
      axis.current = null;
    };

    const onMove = (e: TouchEvent) => {
      const t = e.touches[0];
      const s = start.current;
      if (!t || !s) return;

      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;

      if (!axis.current) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        axis.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      }

      if (axis.current === "y") return; // page scrolls vertically

      el.scrollLeft = s.left - dx;
      e.preventDefault(); // only when horizontal — needs passive: false
    };

    const onEnd = () => {
      start.current = null;
      axis.current = null;
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  return (
    <div ref={ref} className={className} style={{ touchAction: "pan-y" }}>
      {children}
    </div>
  );
}
