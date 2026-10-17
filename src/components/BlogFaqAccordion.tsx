"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

type FaqItem = { question: string; answer: string };

export function BlogFaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  if (!items?.length) return null;

  return (
    <div className="space-y-3">
      {items.map((f, i) => {
        const open = openIndex === i;
        return (
          <div
            key={i}
            className={`group rounded-2xl border transition-colors duration-300 ${
              open
                ? "border-bhagva/30 bg-bhagva-soft/40"
                : "border-border bg-white hover:border-bhagva/25 hover:bg-bhagva-soft/20"
            }`}
          >
            <button
              type="button"
              onClick={() => setOpenIndex(open ? null : i)}
              aria-expanded={open}
              className="flex w-full items-center justify-between gap-4 px-4 sm:px-5 py-4 text-left"
            >
              <span className="font-semibold text-sm sm:text-[15px] text-ink">
                {f.question}
              </span>
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full bg-cream text-ink transition-transform duration-300 ${
                  open ? "rotate-45 bg-bhagva text-white" : ""
                }`}
              >
                <Plus size={15} strokeWidth={2.5} />
              </span>
            </button>
            <div className={`blog-faq-rows ${open ? "is-open" : ""}`}>
              <div>
                <p className="px-4 sm:px-5 pb-4 text-sm text-ink/75 leading-relaxed">
                  {f.answer}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
