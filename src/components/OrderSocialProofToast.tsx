"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ShoppingBag, X } from "lucide-react";
import { api } from "@/lib/api";
import { isLikelySearchCrawler } from "@/lib/is-search-crawler";

type ProofProduct = {
  id: string;
  title: string;
  slug: string;
  image: string | null;
};

type ToastItem = {
  key: number;
  location: string;
  action: string;
  product: ProofProduct;
  minutesAgo: number;
};

const LOCATIONS = [
  "Maharashtra, India",
  "Gujarat, India",
  "Delhi, India",
  "Karnataka, India",
  "Tamil Nadu, India",
  "Rajasthan, India",
  "Uttar Pradesh, India",
  "West Bengal, India",
  "Punjab, India",
  "Telangana, India",
  "Kerala, India",
  "Madhya Pradesh, India",
];

const ACTIONS = ["Added to Cart", "Purchased", "Just viewed"];

/** Wait 15–20s after page load before the first toast. */
const INITIAL_DELAY_MS_MIN = 15_000;
const INITIAL_DELAY_MS_MAX = 20_000;

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/**
 * Highlighted social-proof toast — product detail pages only.
 * Admin → Marketing → Order Social Proof.
 */
export function OrderSocialProofToast() {
  const [products, setProducts] = useState<ProofProduct[]>([]);
  const [intervalMs, setIntervalMs] = useState(60_000);
  const [enabled, setEnabled] = useState(false);
  const [toast, setToast] = useState<ToastItem | null>(null);
  const [visible, setVisible] = useState(false);
  const keyRef = useRef(0);
  const hideTimer = useRef<number | null>(null);
  const lastProductId = useRef<string | null>(null);

  useEffect(() => {
    if (isLikelySearchCrawler()) return;
    let cancelled = false;
    api<{
      enabled?: boolean;
      intervalMinutes?: number;
      intervalSeconds?: number;
      products?: ProofProduct[];
    }>("/order-social-proof")
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res.products) ? res.products : [];
        const on = res.enabled === true && list.length > 0;
        setEnabled(on);
        setProducts(list);
        let seconds = Number(res.intervalSeconds);
        if (!Number.isFinite(seconds) || seconds <= 0) {
          const mins = Number(res.intervalMinutes);
          seconds =
            Number.isFinite(mins) && mins > 0 ? Math.round(mins * 60) : 60;
        }
        setIntervalMs(Math.min(1800, Math.max(5, Math.round(seconds))) * 1000);
      })
      .catch(() => {
        if (!cancelled) setEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const showNext = useCallback(() => {
    if (!products.length) return;
    let pool = products;
    if (products.length > 1 && lastProductId.current) {
      const filtered = products.filter((p) => p.id !== lastProductId.current);
      if (filtered.length) pool = filtered;
    }
    const product = pick(pool);
    lastProductId.current = product.id;
    keyRef.current += 1;
    setToast({
      key: keyRef.current,
      location: pick(LOCATIONS),
      action: pick(ACTIONS),
      product,
      minutesAgo: 1 + Math.floor(Math.random() * 12),
    });
    setVisible(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setVisible(false), 9_000);
  }, [products]);

  useEffect(() => {
    if (!enabled || !products.length) return;

    const initialDelay =
      INITIAL_DELAY_MS_MIN +
      Math.floor(
        Math.random() * (INITIAL_DELAY_MS_MAX - INITIAL_DELAY_MS_MIN + 1),
      );
    const first = window.setTimeout(() => showNext(), initialDelay);
    const loop = window.setInterval(() => showNext(), intervalMs);

    return () => {
      window.clearTimeout(first);
      window.clearInterval(loop);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, [enabled, products, intervalMs, showNext]);

  if (!enabled || !toast) return null;

  const href = `/products/${toast.product.slug}`;

  return (
    <div
      key={toast.key}
      className={`fixed z-[60] left-3 right-3 sm:left-5 sm:right-auto top-[calc(3.75rem+env(safe-area-inset-top))] sm:top-auto bottom-auto md:bottom-[5.5rem] w-auto sm:w-[min(calc(100vw-2.5rem),22rem)] max-w-[22rem] sm:max-w-none mx-auto sm:mx-0 transition-all duration-500 ease-out ${
        visible
          ? "opacity-100 translate-y-0 scale-100"
          : "opacity-0 -translate-y-3 sm:translate-y-4 scale-[0.96] pointer-events-none"
      }`}
      role="status"
      aria-live="polite"
    >
      {/* Soft glow — lighter on mobile */}
      <div
        className="pointer-events-none absolute -inset-0.5 sm:-inset-1 rounded-xl sm:rounded-[22px] bg-[var(--bhagva)]/20 sm:bg-[var(--bhagva)]/35 blur-sm sm:blur-md"
        aria-hidden
      />

      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          e.preventDefault();
          window.open(href, "_blank", "noopener,noreferrer");
        }}
        className="relative flex items-center gap-2 sm:gap-3 rounded-xl sm:rounded-2xl bg-gradient-to-br from-[var(--bhagva-soft)] via-[var(--bhagva-soft)] to-[#FFE0C2] border border-[var(--bhagva)] sm:border-2 shadow-[0_8px_20px_rgba(28,20,16,0.14)] sm:shadow-[0_12px_32px_rgba(28,20,16,0.18),0_0_0_1px_rgba(255,122,26,0.35)] px-2.5 py-2 sm:px-3.5 sm:py-3 pr-8 sm:pr-10 hover:border-[var(--bhagva-deep)] transition-shadow"
      >
        <div className="relative h-9 w-9 sm:h-14 sm:w-14 shrink-0">
          <div className="absolute inset-0 rounded-full bg-[var(--bhagva)]/50 animate-ping opacity-30 sm:opacity-40 hidden sm:block" />
          <div className="relative h-9 w-9 sm:h-14 sm:w-14 rounded-full overflow-hidden bg-[#F3EBD7] ring-1 sm:ring-2 ring-[var(--bhagva)] shadow-sm">
            {toast.product.image ? (
              <Image
                src={toast.product.image}
                alt=""
                fill
                className="object-cover"
                sizes="(max-width: 640px) 36px, 56px"
              />
            ) : (
              <span className="grid h-full w-full place-items-center text-[#8A7355]">
                <ShoppingBag className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
              </span>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1 rounded-full bg-[#16A34A] text-white px-1.5 py-0.5 text-[8px] sm:text-[9px] font-extrabold uppercase tracking-wide mb-0.5 sm:mb-1">
            <span className="h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full bg-white animate-pulse" />
            Live
          </span>
          <p className="text-[11px] sm:text-sm font-extrabold text-[#1C1410] leading-snug truncate">
            Someone in {toast.location}
          </p>
          <p className="text-[10px] sm:text-[12px] text-[#3F6212] mt-0.5 line-clamp-1 sm:line-clamp-2 leading-snug">
            <span className="font-bold">{toast.action}</span>{" "}
            <span className="font-semibold text-[#1C1410]">
              {toast.product.title}
            </span>
          </p>
          <p className="text-[9px] sm:text-[11px] font-medium text-[#8A7355] mt-0.5 sm:mt-1">
            {toast.minutesAgo} minute{toast.minutesAgo === 1 ? "" : "s"} ago ·
            Tap to view
          </p>
        </div>
      </a>

      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setVisible(false)}
        className="absolute top-1.5 right-1.5 sm:top-2.5 sm:right-2.5 z-10 h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-white/90 border border-[#E8D9B5] grid place-items-center text-[#6B5E52] shadow-sm hover:bg-white hover:text-[#1C1410]"
      >
        <X className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
      </button>
    </div>
  );
}
