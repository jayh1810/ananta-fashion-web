"use client";

import Image from "next/image";
import { Gift } from "lucide-react";
import { formatINR } from "@/lib/api";
import type {
  FreeGiftPreviewLine,
  FreeGiftUnavailable,
} from "@/lib/free-gifts";

type Props = {
  gifts: FreeGiftPreviewLine[];
  unavailable?: FreeGiftUnavailable[];
  /** `card` — cart drawer / cart page; `summary` — checkout order summary. */
  variant?: "card" | "summary";
  className?: string;
  /** Gift variant ids to pulse (just unlocked). */
  highlightIds?: string[];
};

/** ₹0 gift lines the server adds at checkout for qualifying products. */
export function FreeGiftRows({
  gifts,
  unavailable = [],
  variant = "card",
  className = "",
  highlightIds = [],
}: Props) {
  if (!gifts.length && !unavailable.length) return null;
  const card = variant === "card";
  const thumb = card ? 72 : 68;

  return (
    <div className={`space-y-2 ${className}`}>
      {gifts.length ? (
        <ul className={card ? "space-y-2" : "space-y-5"}>
          {gifts.map((g) => (
            <li
              key={g.variantId}
              className={
                card
                  ? `flex gap-3 rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4] p-3${
                      highlightIds.includes(g.variantId) ? " free-gift-row-pop" : ""
                    }`
                  : "flex gap-3.5"
              }
            >
              <div
                className="relative shrink-0 overflow-hidden rounded-xl border border-[#DCFCE7] bg-white"
                style={{ width: thumb, height: thumb }}
              >
                {g.image ? (
                  <Image
                    src={g.image}
                    alt={g.title}
                    fill
                    className="object-cover"
                    sizes={`${thumb}px`}
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center bg-[#DCFCE7]">
                    <Gift size={24} className="text-[#16A34A]" />
                  </div>
                )}
                <span className="absolute left-0 top-0 rounded-br-lg bg-[#16A34A] px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-white">
                  Free
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={`font-semibold leading-snug line-clamp-2 ${
                    card ? "text-[13px] font-bold text-black" : "text-[15px]"
                  }`}
                >
                  {g.title}
                </p>
                <span className="mt-1.5 inline-flex items-center gap-1 rounded bg-[#DCFCE7] px-1.5 py-0.5 text-[10px] font-bold text-[#15803D]">
                  <Gift size={10} />
                  Free gift · added automatically
                </span>
                <p className="mt-1 text-[12px] font-medium text-[#555]">
                  Qty: {g.quantity}
                </p>
              </div>
              <div className="shrink-0 text-right text-sm">
                <p className="font-bold text-[#15803D]">{formatINR(0)}</p>
                {g.worth > 0 ? (
                  <p className="mt-0.5 text-[11px] text-[#999] line-through tabular-nums">
                    {formatINR(g.worth * g.quantity)}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {unavailable.length ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-900">
          {unavailable
            .map((u) =>
              u.given > 0
                ? `Only ${u.given} of ${u.wanted} free ${u.title} left in stock`
                : `Free ${u.title} is currently out of stock`,
            )
            .join(" · ")}
          . Your order is not affected.
        </p>
      ) : null}
    </div>
  );
}
