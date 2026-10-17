"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { api } from "@/lib/api";
import { brandHref, type StoreBrand } from "@/lib/brands";
import { isUsableImageSrc } from "@/lib/is-usable-image-src";

const LETTERS = ["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];

function letterOf(name: string) {
  const c = name.trim().charAt(0).toUpperCase();
  return c >= "A" && c <= "Z" ? c : "#";
}

/** Desktop "Brands" dropdown: popular / A–Z list on the left, featured logos on the right. */
export function BrandsMegaMenu() {
  const [open, setOpen] = useState(false);
  const [brands, setBrands] = useState<StoreBrand[] | null>(null);
  const [tab, setTab] = useState<"popular" | "az">("popular");
  const [letter, setLetter] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || brands) return;
    let cancelled = false;
    api<StoreBrand[]>("/brands")
      .then((rows) => !cancelled && setBrands(Array.isArray(rows) ? rows : []))
      .catch(() => !cancelled && setBrands([]));
    return () => {
      cancelled = true;
    };
  }, [open, brands]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDoc);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [open]);

  const show = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hide = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  };

  const list = useMemo(() => brands || [], [brands]);
  const popular = useMemo(() => {
    const featured = list.filter((b) => b.isFeatured);
    return (featured.length ? featured : [...list].sort((a, b) => b.productCount - a.productCount)).slice(0, 14);
  }, [list]);
  const sorted = useMemo(() => [...list].sort((a, b) => a.name.localeCompare(b.name)), [list]);
  const available = useMemo(() => new Set(sorted.map((b) => letterOf(b.name))), [sorted]);
  const leftList =
    tab === "popular" ? popular : letter ? sorted.filter((b) => letterOf(b.name) === letter) : sorted;
  const logos = popular.filter((b) => isUsableImageSrc(b.logoUrl)).slice(0, 8);

  return (
    <div ref={rootRef} onMouseEnter={show} onMouseLeave={hide}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => (open ? setOpen(false) : show())}
        className={`inline-flex h-10 items-center gap-1 px-2 text-[15px] font-medium transition-colors ${
          open ? "text-brand" : "text-ink hover:text-brand"
        }`}
      >
        Brands <ChevronDown size={15} aria-hidden className={open ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>
      {open ? (
        <div className="absolute left-0 right-0 top-full z-[70] border-t border-line bg-white shadow-[var(--shadow-pop)]">
          <div className="mx-auto flex max-w-[1440px] gap-6 px-6 py-5">
            <div className="w-[300px] shrink-0">
              <div className="mb-3 flex gap-2">
                {(["popular", "az"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                      tab === t ? "bg-brand text-white" : "bg-surface text-text hover:text-brand"
                    }`}
                  >
                    {t === "popular" ? "Popular" : "All brands A–Z"}
                  </button>
                ))}
              </div>
              {tab === "az" ? (
                <div className="mb-3 flex flex-wrap gap-1">
                  {LETTERS.map((l) => (
                    <button
                      key={l}
                      type="button"
                      disabled={!available.has(l)}
                      onClick={() => setLetter(letter === l ? null : l)}
                      className={`grid h-6 w-6 place-items-center rounded text-[11px] font-semibold disabled:text-line-strong ${
                        letter === l ? "bg-brand text-white" : "text-ink hover:bg-surface"
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              ) : null}
              <ul className="max-h-[320px] space-y-1 overflow-y-auto pr-2">
                {brands === null ? (
                  <li className="text-[13px] text-muted">Loading brands…</li>
                ) : leftList.length ? (
                  leftList.map((b) => (
                    <li key={b.id}>
                      <Link
                        href={brandHref(b.slug)}
                        onClick={() => setOpen(false)}
                        className="block truncate py-0.5 text-[14px] text-text hover:text-brand"
                      >
                        {b.name}
                      </Link>
                    </li>
                  ))
                ) : (
                  <li className="text-[13px] text-muted">No brands yet.</li>
                )}
              </ul>
              <Link
                href="/brands"
                onClick={() => setOpen(false)}
                className="mt-3 inline-block text-[13px] font-semibold text-brand hover:text-brand-hover"
              >
                View all brands →
              </Link>
            </div>
            {logos.length ? (
              <div className="grid flex-1 grid-cols-4 content-start gap-3 border-l border-line pl-6">
                {logos.map((b) => (
                  <Link
                    key={b.id}
                    href={brandHref(b.slug)}
                    onClick={() => setOpen(false)}
                    className="group relative aspect-[3/2] overflow-hidden rounded-[var(--radius-md)] border border-line bg-white"
                    aria-label={b.name}
                  >
                    <Image
                      src={b.logoUrl!}
                      alt={b.name}
                      fill
                      sizes="200px"
                      className="object-contain p-3 transition-transform duration-300 group-hover:scale-105"
                    />
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
