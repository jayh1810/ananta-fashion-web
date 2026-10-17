import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui";

/** Full-bleed festive closer. Copy stays general until a spiritual catalog is loaded. */
export function UnlockStrip({
  title = "Unlock more energy",
  subtitle = "Browse the collections, festive edits, and new arrivals in the shop.",
  href = "/collections/all",
  cta = "Shop the edit",
}: {
  title?: string;
  subtitle?: string;
  href?: string;
  cta?: string;
}) {
  return (
    <section className="py-4 sm:py-6">
      <Container>
        <div className="flex flex-col items-start justify-between gap-4 rounded-2xl bg-brand px-5 py-7 text-white sm:flex-row sm:items-center sm:px-8 sm:py-9">
          <div className="max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">Festive edit</p>
            <h2 className="mt-1 font-heading text-2xl font-bold leading-tight sm:text-4xl">{title}</h2>
            <p className="mt-2 text-sm text-white/90 sm:text-base">{subtitle}</p>
          </div>
          <Link
            href={href}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-brand shadow-sm hover:bg-brand-soft"
          >
            {cta}
            <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
      </Container>
    </section>
  );
}
