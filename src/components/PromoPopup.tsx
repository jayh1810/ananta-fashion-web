"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { api } from "@/lib/api";
import { isLikelySearchCrawler } from "@/lib/is-search-crawler";

type Popup = {
  id: string;
  title: string;
  body?: string | null;
  imageUrl?: string | null;
  buttonText?: string | null;
  linkUrl?: string | null;
  delaySeconds?: number;
};

const SESSION_KEY = "aa_promo_popup_shown";

/** Fetches the active storefront popup (if any) and shows it once per session. */
export function PromoPopup() {
  const [popup, setPopup] = useState<Popup | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isLikelySearchCrawler()) return;
    let dismissed = false;
    try {
      dismissed = !!sessionStorage.getItem(SESSION_KEY);
    } catch {
      /* sessionStorage unavailable, treat as not dismissed */
    }
    if (dismissed) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    api<Popup[]>("/content/popups")
      .then((rows) => {
        if (cancelled || !Array.isArray(rows) || !rows.length) return;
        const p = rows[0];
        const delayMs = Math.max(0, (p.delaySeconds ?? 3) * 1000);
        timer = setTimeout(() => {
          if (cancelled) return;
          setPopup(p);
          setOpen(true);
          try {
            sessionStorage.setItem(SESSION_KEY, "1");
          } catch {
            /* ignore */
          }
        }, delayMs);
      })
      .catch(() => {
        /* silently do nothing if the endpoint fails or is empty */
      });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (!open || !popup) return null;

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close promotion"
        className="absolute inset-0 bg-black/55 backdrop-blur-[3px]"
        onClick={() => setOpen(false)}
      />
      <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-[0_25px_80px_rgba(0,0,0,0.35)]">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="absolute top-3 right-3 z-20 h-8 w-8 rounded-full bg-white/90 grid place-items-center text-slate-600 hover:text-black shadow"
        >
          <X size={16} />
        </button>
        {popup.imageUrl && (
          <div className="relative w-full h-40">
            <Image
              src={popup.imageUrl}
              alt=""
              fill
              sizes="(max-width: 400px) 100vw, 400px"
              className="object-cover"
            />
          </div>
        )}
        <div className="p-6 text-center">
          <h3 className="text-lg font-bold text-slate-900">{popup.title}</h3>
          {popup.body && (
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
              {popup.body}
            </p>
          )}
          {popup.linkUrl && (
            <a
              href={popup.linkUrl}
              onClick={() => setOpen(false)}
              className="inline-flex mt-4 h-10 px-5 items-center justify-center rounded-xl bg-[#111827] text-white text-sm font-semibold hover:opacity-90"
            >
              {popup.buttonText || "Shop now"}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
