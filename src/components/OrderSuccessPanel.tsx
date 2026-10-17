"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  Check,
  Clock,
  Copy,
  Package,
  PartyPopper,
  Plus,
  Sparkles,
  Wallet,
} from "lucide-react";
import { api, formatINR, type Product } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { trackAddToCart } from "@/lib/meta-pixel";

export type OrderSuccessDetails = {
  orderNumber: string;
  paid: number;
  cashbackEarn: number;
  walletRedeemed: number;
  creditTiming?: "instant" | "on_delivery";
  brandName: string;
  /** Partial COD — remaining amount to pay in cash at delivery. */
  codDue?: number;
};

type Props = {
  details: OrderSuccessDetails;
  onContinue: () => void;
};

const CONFETTI_COLORS = [
  "#16A34A",
  "#F59E0B",
  "#EF4444",
  "#3B82F6",
  "#EC4899",
  "#A855F7",
  "#14B8A6",
  "#F97316",
];

function ConfettiBurst() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 48 }, (_, i) => ({
        id: i,
        left: `${(i * 17 + 7) % 100}%`,
        delay: `${(i % 12) * 0.05}s`,
        duration: `${1.6 + (i % 5) * 0.25}s`,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        rotate: `${(i * 47) % 360}deg`,
        width: 6 + (i % 4) * 2,
        height: 8 + (i % 3) * 3,
        drift: `${((i % 7) - 3) * 18}px`,
      })),
    [],
  );

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      {pieces.map((p) => (
        <span
          key={p.id}
          className="order-confetti-piece"
          style={
            {
              left: p.left,
              backgroundColor: p.color,
              width: p.width,
              height: p.height,
              animationDelay: p.delay,
              animationDuration: p.duration,
              ["--confetti-rotate" as string]: p.rotate,
              ["--confetti-drift" as string]: p.drift,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

export function OrderSuccessPanel({ details, onContinue }: Props) {
  const { addItem } = useCart();
  const [copied, setCopied] = useState(false);
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [showPoppers, setShowPoppers] = useState(true);

  useEffect(() => {
    const t = window.setTimeout(() => setShowPoppers(false), 4200);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const home = await api<{
          bestsellers?: Product[];
          promoted?: Product[];
        }>("/home");
        const pool: Product[] = [
          ...(home.promoted || []),
          ...(home.bestsellers || []),
        ];
        if (pool.length < 4) {
          const more = await api<{ data: Product[] }>("/products?limit=12");
          pool.push(...(more.data || []));
        }
        const seen = new Set<string>();
        const unique = pool.filter((p) => {
          if (!p?.id || p.soldOut || seen.has(p.id)) return false;
          seen.add(p.id);
          return true;
        });
        if (!cancelled) setSuggestions(unique.slice(0, 4));
      } catch {
        if (!cancelled) setSuggestions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function copyOrder() {
    try {
      await navigator.clipboard.writeText(details.orderNumber);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }

  const isInstantCredit = details.creditTiming === "instant";
  const cashbackHeadline = isInstantCredit
    ? `${formatINR(details.cashbackEarn)} cashback credited`
    : `${formatINR(details.cashbackEarn)} cashback on the way`;
  const creditLabel = isInstantCredit
    ? "Wallet reward credited after payment"
    : "Wallet reward credited after delivery";

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-gradient-to-b from-[#ECFDF5] via-white to-[#FFF7ED]">
      {showPoppers ? <ConfettiBurst /> : null}

      <div className="relative z-[1] flex-1 overflow-y-auto px-5 pb-6 pt-8">
        {/* Success mark */}
        <div className="order-success-hero mx-auto mb-5 flex flex-col items-center text-center">
          <div className="relative mb-4">
            <span className="order-success-ring absolute inset-[-10px] rounded-full" />
            <span className="order-success-ring-delay absolute inset-[-18px] rounded-full" />
            <div className="order-success-check relative grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-[#22C55E] to-[#15803D] text-white shadow-[0_12px_32px_rgba(22,163,74,0.45)]">
              <Check size={36} strokeWidth={3} className="order-success-tick" />
            </div>
            <span className="absolute -right-3 -top-2 animate-bounce text-[#F59E0B]">
              <PartyPopper size={22} />
            </span>
            <span className="absolute -left-4 top-1 animate-bounce text-[#EC4899] [animation-delay:150ms]">
              <Sparkles size={18} />
            </span>
          </div>

          <p className="order-success-fade mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#15803D]">
            Payment successful
          </p>
          <h2 className="order-success-fade-delay text-[28px] font-bold leading-tight tracking-tight text-[#0f172a]">
            Order Placed!
          </h2>
          <p className="order-success-fade-delay2 mt-1.5 text-sm text-[#64748b]">
            Thank you for shopping with {details.brandName}
          </p>
        </div>

        {/* Order card */}
        <div className="order-success-card mb-4 overflow-hidden rounded-2xl border border-[#D1FAE5] bg-white/90 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between gap-3 border-b border-[#ECFDF5] px-4 py-3">
            <div className="min-w-0 text-left">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748b]">
                Order number
              </p>
              <p className="truncate font-bold text-[#0f172a]">
                #{details.orderNumber}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void copyOrder()}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1.5 text-[11px] font-semibold text-[#334155] hover:bg-[#F1F5F9]"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          {(details.codDue || 0) > 0 ? (
            <div className="relative px-4 py-3.5">
              <span
                className="absolute left-[26px] top-[30px] bottom-[30px] w-px bg-[#E2E8F0]"
                aria-hidden
              />
              <div className="relative flex items-start gap-3 pb-4">
                <span className="relative z-[1] grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#16A34A] text-white">
                  <Check size={13} strokeWidth={3} />
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-[13px] font-bold text-[#0f172a]">
                    Paid online
                  </p>
                  <p className="text-[11px] text-[#64748b]">
                    Received via Razorpay
                  </p>
                </div>
                <span className="shrink-0 pt-0.5 text-sm font-bold text-[#0f172a]">
                  {formatINR(details.paid)}
                </span>
              </div>
              <div className="relative flex items-start gap-3">
                <span className="relative z-[1] grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#F59E0B] text-white">
                  <Clock size={12} strokeWidth={2.5} />
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-[13px] font-bold text-[#92400E]">
                    Cash on delivery
                  </p>
                  <p className="text-[11px] text-[#B45309]">
                    Pending · keep this ready for the delivery agent
                  </p>
                </div>
                <span className="shrink-0 pt-0.5 text-sm font-bold text-[#92400E]">
                  {formatINR(details.codDue || 0)}
                </span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-px bg-[#F1F5F9]">
              <div className="bg-white px-4 py-3 text-left">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94a3b8]">
                  Paid online
                </p>
                <p className="text-base font-bold text-[#0f172a]">
                  {formatINR(details.paid)}
                </p>
              </div>
              <div className="bg-white px-4 py-3 text-left">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94a3b8]">
                  Status
                </p>
                <p className="text-sm font-bold text-[#15803D]">Confirmed</p>
              </div>
            </div>
          )}
        </div>

        {details.cashbackEarn > 0 && (
          <div className="order-success-card mb-4 flex items-start gap-3 rounded-2xl border border-[#FDE68A] bg-gradient-to-r from-[var(--bhagva-soft)] to-[#ECFDF5] px-4 py-3.5">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FEF3C7] text-[#B45309]">
              <Wallet size={16} />
            </span>
            <div className="min-w-0 text-left">
              <p className="text-[13px] font-bold text-[#78350F]">
                {cashbackHeadline}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-[#92400E]">
                {creditLabel}
                {details.walletRedeemed > 0
                  ? ` · you saved ${formatINR(details.walletRedeemed)} on this order`
                  : ""}
                .
              </p>
            </div>
          </div>
        )}

        <div className="order-success-card mb-5 flex items-center gap-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5 text-left">
          <Package size={16} className="shrink-0 text-[#64748b]" />
          <p className="text-[12px] text-[#475569]">
            Track updates anytime in{" "}
            <Link
              href="/account/orders"
              onClick={onContinue}
              className="font-bold text-[#0f172a] underline-offset-2 hover:underline"
            >
              My Orders
            </Link>
          </p>
        </div>

        {suggestions.length > 0 && (
          <div className="order-success-card text-left">
            <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#166534]">
              <Sparkles size={13} /> You may also like
            </p>
            <ul className="space-y-2">
              {suggestions.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-2.5 rounded-xl border border-[#E7E5E4] bg-white p-2 shadow-sm"
                >
                  <Link
                    href={`/products/${p.slug}`}
                    onClick={onContinue}
                    className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[#F5F5F4]"
                  >
                    {p.image ? (
                      <Image
                        src={p.image}
                        alt={p.title}
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    ) : null}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/products/${p.slug}`}
                      onClick={onContinue}
                      className="line-clamp-1 text-[12px] font-semibold text-[#1c1917]"
                    >
                      {p.title}
                    </Link>
                    <p className="text-[12px] font-bold text-black">
                      {formatINR(p.price)}
                      {p.compareAt > p.price ? (
                        <span className="ml-1.5 text-[11px] font-normal text-[#a8a29e] line-through">
                          {formatINR(p.compareAt)}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={addingId === p.id}
                    onClick={() => {
                      setAddingId(p.id);
                      addItem(p, 1);
                      try {
                        trackAddToCart({
                          content_ids: [p.id],
                          content_name: p.title,
                          value: p.price,
                          num_items: 1,
                          contents: [{ id: p.id, quantity: 1 }],
                        });
                      } catch {}
                      onContinue();
                      window.setTimeout(() => setAddingId(null), 300);
                    }}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#166534] px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-[#14532D] disabled:opacity-60"
                  >
                    <Plus size={12} strokeWidth={2.5} />
                    Add
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="relative z-[1] border-t border-[#E2E8F0] bg-white/95 p-4 backdrop-blur safe-pb">
        <button
          type="button"
          onClick={onContinue}
          className="w-full rounded-xl bg-black py-3.5 text-sm font-bold text-white transition hover:bg-[#111] active:scale-[0.99]"
        >
          Continue Shopping
        </button>
      </div>
    </div>
  );
}
