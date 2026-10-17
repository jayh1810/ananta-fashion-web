"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Plus, Sparkles, Split } from "lucide-react";
import { formatINR, type Product } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { trackAddToCart } from "@/lib/meta-pixel";
import {
  cartAddProductFromSuggestion,
  loadCartSuggestionPool,
  pickCartSuggestions,
} from "@/lib/cart-suggestions";
import { FreePriceLabel } from "@/components/FreeProductBadge";

type Props = {
  minOrderRupees: number;
  cartTotal: number;
  /** When Partial COD is off, still show suggested products. */
  suggestionsOnly?: boolean;
  compact?: boolean;
  className?: string;
};

export function CodUnlockUpsell({
  minOrderRupees,
  cartTotal,
  suggestionsOnly = false,
  compact = false,
  className = "",
}: Props) {
  const { items, addItem } = useCart();
  const [pool, setPool] = useState<Product[]>([]);
  const [addingId, setAddingId] = useState<string | null>(null);

  const unlockAt = Math.max(1, minOrderRupees + 1);
  const shortfall = suggestionsOnly
    ? 0
    : Math.max(0, Math.ceil(unlockAt - cartTotal));
  const unlocked = suggestionsOnly || shortfall <= 0;
  const progress = Math.min(
    100,
    unlockAt > 0 ? (cartTotal / unlockAt) * 100 : 100,
  );

  const cartIdKey = useMemo(
    () =>
      items
        .map((i) => i.product.id)
        .sort()
        .join(","),
    [items],
  );
  const cartIds = useMemo(
    () => new Set(cartIdKey ? cartIdKey.split(",") : []),
    [cartIdKey],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const unique = await loadCartSuggestionPool();
        if (!cancelled) setPool(unique);
      } catch {
        if (!cancelled) setPool([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const suggestions = useMemo(
    () => pickCartSuggestions(pool, cartIds, shortfall, 4),
    [pool, cartIds, shortfall],
  );

  if (!suggestionsOnly && minOrderRupees <= 0) return null;
  if (unlocked && suggestions.length === 0) return null;

  return (
    <div
      className={`overflow-hidden rounded-2xl border shadow-sm ${
        unlocked
          ? "border-[#A7F3D0] bg-gradient-to-br from-[#ECFDF5] via-white to-[#F0FDF4]"
          : "border-[#F5D0A9] bg-gradient-to-br from-[#FFF8F0] via-[#FFFBF5] to-[#F0FDF4]"
      } ${className}`}
    >
      <div className={compact ? "p-3.5" : "p-4"}>
        <div className="flex items-start gap-2.5">
          <span
            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 ${
              unlocked
                ? "bg-success-soft text-success ring-[#A7F3D0]"
                : "bg-[#FEF3C7] text-[#B45309] ring-[#FDE68A]"
            }`}
          >
            {suggestionsOnly ? (
              <Sparkles size={15} />
            ) : unlocked ? (
              <CheckCircle2 size={15} />
            ) : (
              <Split size={15} />
            )}
          </span>
          <div className="min-w-0 flex-1">
            {suggestionsOnly ? (
              <>
                <p className="text-[13px] font-bold leading-snug text-success">
                  You may also like
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-success">
                  Add more from these picks — popular with other customers.
                </p>
              </>
            ) : unlocked ? (
              <>
                <p className="text-[13px] font-bold leading-snug text-success">
                  Partial COD unlocked · keep adding
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-success">
                  You can pay a small amount online and the rest on delivery at
                  checkout.
                </p>
              </>
            ) : (
              <>
                <p className="text-[13px] font-bold leading-snug text-[#78350F]">
                  Add {formatINR(shortfall)} more to unlock Partial COD
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-[#92400E]">
                  Online advance is at least {formatINR(minOrderRupees)}. Your
                  cart must be above that so Partial COD can leave a balance
                  for delivery.
                </p>
              </>
            )}
          </div>
        </div>

        {!unlocked && (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-[10px] font-semibold text-[#A16207]">
              <span>{formatINR(cartTotal)}</span>
              <span>{formatINR(unlockAt)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#FDE68A]/70">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#F59E0B] to-[#16A34A] transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {suggestions.length > 0 && (
        <div
          className={`border-t bg-white/60 px-3 pb-3 pt-2.5 ${
            unlocked ? "border-[#A7F3D0]/80" : "border-[#F5D0A9]/80"
          }`}
        >
          <p
            className={`mb-2 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-success ${
              suggestionsOnly ? "sr-only" : ""
            }`}
          >
            <Sparkles size={12} />{" "}
            {unlocked ? "You may also like" : "Quick add to unlock"}
          </p>
          <ul className="space-y-2">
            {suggestions.map((p) => {
              const unitPrice = p.isFreeProduct ? 0 : p.price;
              const covers = !unlocked && unitPrice >= shortfall;
              return (
                <li
                  key={p.id}
                  className="flex items-center gap-2.5 rounded-xl border border-[#E7E5E4] bg-white p-2 shadow-sm"
                >
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-surface">
                    {p.image ? (
                      <Image
                        src={p.image}
                        alt={p.title}
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-[12px] font-semibold text-[#1c1917]">
                      {p.title}
                    </p>
                    <p className="text-[11px] text-[#57534e]">
                      <span className="font-bold text-black">
                        {p.isFreeProduct ? (
                          <FreePriceLabel size="sm" />
                        ) : (
                          formatINR(p.price)
                        )}
                      </span>
                      {!unlocked &&
                        (covers ? (
                          <span className="ml-1.5 font-medium text-success">
                            · unlocks COD
                          </span>
                        ) : (
                          <span className="ml-1.5 text-[#A16207]">
                            · +{formatINR(unitPrice)} toward min
                          </span>
                        ))}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={addingId === p.id}
                    onClick={() => {
                      const line = cartAddProductFromSuggestion(p);
                      setAddingId(p.id);
                      addItem(line, 1);
                      try {
                        trackAddToCart({
                          content_ids: [p.id],
                          content_name: p.title,
                          value: line.price,
                          num_items: 1,
                          contents: [{ id: p.id, quantity: 1 }],
                        });
                      } catch {}
                      window.setTimeout(() => setAddingId(null), 400);
                    }}
                    className="inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-sm)] border border-brand bg-white px-2.5 py-1.5 text-[11px] font-bold text-brand hover:bg-brand-soft disabled:opacity-60"
                  >
                    <Plus size={12} strokeWidth={2.5} />
                    Add
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
