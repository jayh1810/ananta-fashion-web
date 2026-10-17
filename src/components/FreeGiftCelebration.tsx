"use client";

import { useEffect, useRef, useState } from "react";
import { Gift, ShoppingBag } from "lucide-react";
import { formatINR } from "@/lib/api";
import type { FreeGiftPreviewLine } from "@/lib/free-gifts";

/** Gift variant ids already celebrated — survives reloads like the cart does. */
const SEEN_KEY = "aa.freeGifts.celebrated";
const SHOW_MS = 3800;
const COLORS = ["#16A34A", "#22C55E", "#F59E0B", "#FACC15", "#EF4444", "#3B82F6", "#A855F7"];

type Piece = {
  left: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
  drift: number;
  rotate: number;
  round: boolean;
};

type Burst = { id: number; gifts: FreeGiftPreviewLine[]; pieces: Piece[] };

function readSeen(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
    return new Set(Array.isArray(raw) ? raw.map(String) : []);
  } catch {
    return new Set();
  }
}

function makePieces(): Piece[] {
  return Array.from({ length: 42 }, () => ({
    left: Math.random() * 100,
    size: 6 + Math.random() * 6,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    delay: Math.random() * 0.5,
    duration: 1.8 + Math.random() * 1.4,
    drift: (Math.random() - 0.5) * 160,
    rotate: 180 + Math.random() * 540,
    round: Math.random() > 0.6,
  }));
}

/**
 * Celebrates when a free gift newly appears in the cart. Gifts that leave the
 * cart are forgotten, so re-qualifying celebrates again.
 */
export function useFreeGiftCelebration(gifts: FreeGiftPreviewLine[], ready: boolean) {
  const [burst, setBurst] = useState<Burst | null>(null);
  const giftKey = gifts.map((g) => g.variantId).sort().join(",");

  useEffect(() => {
    if (!ready) return;
    const seen = readSeen();
    const fresh = gifts.filter((g) => !seen.has(g.variantId));
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(gifts.map((g) => g.variantId)));
    } catch {
      /* storage unavailable — celebrate without persistence */
    }
    if (!fresh.length) return;
    const show = setTimeout(
      () => setBurst({ id: Date.now(), gifts: fresh, pieces: makePieces() }),
      0,
    );
    return () => clearTimeout(show);
    // giftKey captures gift identity; `gifts` array identity changes every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, giftKey]);

  useEffect(() => {
    if (!burst) return;
    const hide = setTimeout(() => setBurst(null), SHOW_MS);
    return () => clearTimeout(hide);
  }, [burst]);

  return {
    burst,
    highlightIds: burst ? burst.gifts.map((g) => g.variantId) : [],
    dismiss: () => setBurst(null),
  };
}

const ADDED_SHOW_MS = 2600;
/** Adds older than this when the drawer renders are not celebrated (e.g. reopening the cart). */
const ADDED_FRESH_MS = 2000;

type AddedLine = { at: number; title: string; image?: string | null; quantity: number };
type AddedBurst = { id: number; line: AddedLine; pieces: Piece[] };

/** Celebrates every successful add-to-cart; yields to the free-gift celebration. */
export function useAddedToCartCelebration(
  lastAdded: AddedLine | null,
  suppressed: boolean,
) {
  const [burst, setBurst] = useState<AddedBurst | null>(null);
  const celebratedAt = useRef(0);

  useEffect(() => {
    if (!lastAdded || lastAdded.at === celebratedAt.current) return;
    celebratedAt.current = lastAdded.at;
    if (Date.now() - lastAdded.at > ADDED_FRESH_MS) return;
    const line = lastAdded;
    const show = setTimeout(
      () => setBurst({ id: line.at, line, pieces: makePieces() }),
      0,
    );
    return () => clearTimeout(show);
  }, [lastAdded]);

  useEffect(() => {
    if (!burst) return;
    const hide = setTimeout(() => setBurst(null), ADDED_SHOW_MS);
    return () => clearTimeout(hide);
  }, [burst]);

  return {
    burst: suppressed ? null : burst,
    dismiss: () => setBurst(null),
  };
}

/** Confetti + "Added to cart" card; render inside a positioned container. */
export function AddedToCartCelebration({
  burst,
  onDismiss,
}: {
  burst: AddedBurst | null;
  onDismiss: () => void;
}) {
  if (!burst) return null;
  const { line } = burst;
  return (
    <div
      key={burst.id}
      className="pointer-events-none absolute inset-0 z-30 overflow-hidden"
      aria-live="polite"
    >
      <div className="free-gift-confetti" aria-hidden>
        {burst.pieces.map((p, i) => (
          <span
            key={i}
            className="order-confetti-piece"
            style={
              {
                left: `${p.left}%`,
                width: p.size,
                height: p.round ? p.size : p.size * 0.45,
                background: p.color,
                borderRadius: p.round ? "50%" : 2,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
                "--confetti-drift": `${p.drift}px`,
                "--confetti-rotate": `${p.rotate}deg`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
      <div className="absolute inset-x-4 top-16 flex justify-center">
        <button
          type="button"
          onClick={onDismiss}
          className="free-gift-toast pointer-events-auto flex w-full max-w-[360px] items-center gap-3 rounded-2xl border border-[#FED7AA] bg-white px-3.5 py-3 text-left shadow-[0_12px_32px_rgba(234,88,12,0.22)]"
        >
          {line.image ? (
            <span
              className="free-gift-toast-icon h-11 w-11 shrink-0 rounded-xl bg-surface-alt bg-cover bg-center"
              style={{ backgroundImage: `url("${line.image}")` }}
              aria-hidden
            />
          ) : (
            <span className="free-gift-toast-icon grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-white">
              <ShoppingBag size={22} />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-extrabold text-[#C2410C]">
              🎉 Added to cart!
            </span>
            <span className="mt-0.5 block truncate text-[12px] font-semibold text-black">
              {line.title}
            </span>
            {line.quantity > 1 ? (
              <span className="block text-[11px] text-[#555]">
                Qty {line.quantity} added
              </span>
            ) : null}
          </span>
        </button>
      </div>
    </div>
  );
}

/** Confetti + "Free gift unlocked" card; render inside a positioned container. */
export function FreeGiftCelebration({
  burst,
  onDismiss,
}: {
  burst: Burst | null;
  onDismiss: () => void;
}) {
  if (!burst) return null;
  const worth = burst.gifts.reduce((s, g) => s + g.worth * g.quantity, 0);
  const title =
    burst.gifts.length === 1
      ? burst.gifts[0].title
      : `${burst.gifts.length} free gifts`;

  return (
    <div
      key={burst.id}
      className="pointer-events-none absolute inset-0 z-30 overflow-hidden"
      aria-live="polite"
    >
      <div className="free-gift-confetti" aria-hidden>
        {burst.pieces.map((p, i) => (
          <span
            key={i}
            className="order-confetti-piece"
            style={
              {
                left: `${p.left}%`,
                width: p.size,
                height: p.round ? p.size : p.size * 0.45,
                background: p.color,
                borderRadius: p.round ? "50%" : 2,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
                "--confetti-drift": `${p.drift}px`,
                "--confetti-rotate": `${p.rotate}deg`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
      <div className="absolute inset-x-4 top-16 flex justify-center">
        <button
          type="button"
          onClick={onDismiss}
          className="free-gift-toast pointer-events-auto flex w-full max-w-[360px] items-center gap-3 rounded-2xl border border-[#BBF7D0] bg-white px-3.5 py-3 text-left shadow-[0_12px_32px_rgba(22,163,74,0.25)]"
        >
          <span className="free-gift-toast-icon grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#16A34A] text-white">
            <Gift size={22} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-extrabold text-[#15803D]">
              🎉 Free gift unlocked!
            </span>
            <span className="mt-0.5 block truncate text-[12px] font-semibold text-black">
              {title}
            </span>
            <span className="block text-[11px] text-[#555]">
              {worth > 0 ? `Worth ${formatINR(worth)} · ` : ""}added free to your order
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}
