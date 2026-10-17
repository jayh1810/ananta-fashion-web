"use client";

import { useEffect, useRef, useState } from "react";

/** Mobile: show ~half the description with Read more; desktop always full. */
export function CollectionReadMore({ html }: { html: string }) {
  const [open, setOpen] = useState(false);
  const [halfPx, setHalfPx] = useState<number | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const markup = html.includes("<p") ? html : `<p>${html}</p>`;

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    function measure() {
      if (!el) return;
      // Only clamp on mobile widths
      if (window.matchMedia("(min-width: 640px)").matches) {
        setHalfPx(null);
        return;
      }
      const prev = el.style.maxHeight;
      el.style.maxHeight = "none";
      const full = el.scrollHeight;
      el.style.maxHeight = prev;
      setHalfPx(Math.max(72, Math.round(full / 2)));
    }

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [html]);

  const clamped = !open && halfPx != null;

  return (
    <div className="mt-4">
      <div className="relative">
        <div
          ref={contentRef}
          style={clamped ? { maxHeight: halfPx } : undefined}
          className={`space-y-3 text-sm leading-relaxed text-[#444] [&_strong]:text-ink [&_p]:mb-2 ${
            clamped ? "overflow-hidden" : ""
          }`}
          dangerouslySetInnerHTML={{ __html: markup }}
        />
        {clamped ? (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent sm:hidden"
            aria-hidden
          />
        ) : null}
      </div>
      {halfPx != null ? (
        <button
          type="button"
          className="relative z-[1] mt-1 text-[12px] font-medium text-teal/90 underline-offset-2 hover:underline sm:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? "Read less" : "Read more"}
        </button>
      ) : null}
    </div>
  );
}
