"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  api,
  faqs as fallbackFaqs,
  testimonials as fallbackTestimonials,
} from "@/lib/api";

type ApiTestimonial = {
  id: string;
  name: string;
  text: string;
};

type ApiFaq = {
  id: string;
  question: string;
  answer: string;
};

function useTestimonials() {
  const [items, setItems] = useState<{ name: string; text: string }[]>(
    fallbackTestimonials,
  );

  useEffect(() => {
    let cancelled = false;
    api<ApiTestimonial[]>("/content/testimonials")
      .then((data) => {
        if (cancelled || !Array.isArray(data) || !data.length) return;
        setItems(data.map((t) => ({ name: t.name, text: t.text })));
      })
      .catch(() => {
        /* keep fallback */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return items;
}

function useFaqs(skip = false) {
  const [items, setItems] = useState<{ q: string; a: string }[]>(
    fallbackFaqs,
  );

  useEffect(() => {
    if (skip) return;
    let cancelled = false;
    api<ApiFaq[]>("/content/faqs")
      .then((data) => {
        if (cancelled || !Array.isArray(data) || !data.length) return;
        setItems(data.map((f) => ({ q: f.question, a: f.answer })));
      })
      .catch(() => {
        /* keep fallback */
      });
    return () => {
      cancelled = true;
    };
  }, [skip]);

  return items;
}

export function Testimonials() {
  const testimonials = useTestimonials();
  if (!testimonials.length) return null;
  return (
    <section className="py-10 sm:py-14 bg-cream">
      <div className="mx-auto max-w-[1400px] px-3 sm:px-5">
        <h2 className="section-title text-center mb-2">What our customers say</h2>
        <p className="text-center text-muted text-sm mb-8">Testimonials</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {testimonials.map((t) => (
            <blockquote
              key={t.name}
              className="bg-white rounded-xl border border-border p-5 shadow-sm"
            >
              <div className="text-gold text-lg mb-2">★★★★★</div>
              <p className="text-sm text-ink/90 leading-relaxed">{t.text}</p>
              <footer className="mt-4 text-sm font-semibold text-teal">
                — {t.name}
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FAQSection({
  initial,
}: {
  initial?: { q: string; a: string }[];
}) {
  const [open, setOpen] = useState<number | null>(0);
  const fetched = useFaqs(!!initial?.length);
  const faqs = initial?.length ? initial : fetched;
  if (!faqs.length) return null;

  return (
    <section className="py-10 sm:py-14">
      <div className="mx-auto max-w-3xl px-3 sm:px-5">
        <h2 className="section-title text-center mb-8">FAQs</h2>
        <div className="space-y-2">
          {faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <div
                key={f.q}
                className="border border-border rounded-lg overflow-hidden"
              >
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left font-semibold text-sm sm:text-base"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : i)}
                >
                  <span>
                    Q{i + 1}: {f.q}
                  </span>
                  <ChevronDown
                    size={18}
                    className={`flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
                <div
                  hidden={!isOpen}
                  className="px-4 pb-4 text-sm text-muted leading-relaxed"
                >
                  {f.a}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
