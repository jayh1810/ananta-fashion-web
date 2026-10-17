"use client";

import { ChevronDown, Gift, ShoppingCart } from "lucide-react";

type Props = {
  itemCount: number;
  giftEnabled?: boolean;
  /** Units of product free gifts the server adds at ₹0. */
  autoGiftUnits?: number;
  savings: number;
  compareTotal: number;
  toPay: number;
  walletRedeem?: number;
  cashbackEarn?: number;
  cashbackPercent?: number;
  formatINR: (n: number) => string;
  onOpen: () => void;
};

export function CheckoutOrderSummaryCard({
  itemCount,
  giftEnabled = false,
  autoGiftUnits = 0,
  savings,
  compareTotal,
  toPay,
  walletRedeem = 0,
  cashbackEarn = 0,
  cashbackPercent = 0,
  formatINR,
  onOpen,
}: Props) {
  const units = itemCount + (giftEnabled ? 1 : 0) + autoGiftUnits;
  const giftCount = (giftEnabled ? 1 : 0) + (autoGiftUnits > 0 ? 1 : 0);
  const showStrike = compareTotal > toPay;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-full rounded-xl bg-white px-3 py-2.5 flex items-center gap-2.5 text-left transition-colors hover:bg-[#fafafa] active:bg-[#f5f5f5] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black/10"
    >
      <span className="h-8 w-8 rounded-full bg-[#f3f3f3] grid place-items-center shrink-0">
        <ShoppingCart size={15} className="text-[#444]" strokeWidth={2} />
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-bold text-[13px] text-[#111] leading-tight">
              Order Summary
            </p>

            {giftCount > 0 ? (
              <p className="text-[10px] text-[#555] mt-0.5 flex items-center gap-1">
                <Gift size={11} className="text-[#16A34A] shrink-0" />
                {autoGiftUnits > 1 || giftCount > 1
                  ? "Free gifts added"
                  : "Free gift added"}
              </p>
            ) : null}

            {savings > 0 ? (
              <span className="inline-flex mt-1 text-[10px] font-semibold text-[#15803D] bg-[#DCFCE7] px-2 py-0.5 rounded-full leading-none">
                {formatINR(savings)} saved so far
              </span>
            ) : null}
          </div>

          <div className="text-right shrink-0">
            <p className="text-[10px] font-medium text-[#888]">
              {units} item{units === 1 ? "" : "s"}
            </p>

            <div className="flex items-center justify-end gap-1 mt-0.5">
              {showStrike ? (
                <span className="text-[11px] text-[#aaa] line-through tabular-nums">
                  {formatINR(compareTotal)}
                </span>
              ) : null}
              <span className="font-bold text-[14px] text-[#111] tabular-nums leading-none">
                {formatINR(toPay)}
              </span>
              <ChevronDown
                size={14}
                className="text-[#999] shrink-0"
                aria-hidden
              />
            </div>

            {walletRedeem > 0 ? (
              <p className="text-[10px] font-semibold text-[#15803D] mt-0.5 tabular-nums">
                Wallet −{formatINR(walletRedeem)}
              </p>
            ) : null}

            {cashbackEarn > 0 ? (
              <p className="text-[10px] font-bold text-[#854D0E] mt-0.5">
                {cashbackPercent}% cashback
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </button>
  );
}
