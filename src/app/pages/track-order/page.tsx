"use client";

import { FormEvent, useState } from "react";
import { Loader2, PackageSearch } from "lucide-react";
import { api, formatINR } from "@/lib/api";
import {
  formatOrderNumber,
  orderStatusLabel,
  orderStatusTone,
  parseOrderNumberInput,
  paymentStatusLabel,
} from "@/lib/order-status";
import {
  ShipmentTrackingCard,
  type ShipmentInfo,
} from "@/components/ShipmentTrackingCard";

type TrackResult = {
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  grandTotal: number;
  placedAt?: string;
  shipment?: ShipmentInfo;
  shiprocketAwb?: string | null;
  shiprocketStatus?: string | null;
  shiprocketCourierName?: string | null;
  shiprocketTracking?: ShipmentInfo | null;
  trackingNumber?: string | null;
  trackingCarrier?: string | null;
  trackingUrl?: string | null;
  items?: { productTitle: string; quantity: number }[];
};

export default function TrackOrderPage() {
  const [result, setResult] = useState<TrackResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const orderNumber = parseOrderNumberInput(
      String(fd.get("orderNumber") || ""),
    );
    try {
      const order = await api<TrackResult>(
        `/orders/track?orderNumber=${encodeURIComponent(orderNumber)}&phone=${encodeURIComponent(String(fd.get("phone") || "").trim())}`,
      );
      setResult(order);
    } catch (err: any) {
      setError(err.message || "Order not found");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-3 sm:px-5 py-10">
      <div className="flex items-start gap-3 mb-6">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#EDE8DF] text-[#3F342C] shrink-0">
          <PackageSearch size={20} strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="section-title mb-1">Track Order</h1>
          <p className="text-sm text-muted">
            Enter your order number and the phone used at checkout to see live
            courier updates.
          </p>
        </div>
      </div>

      <form className="space-y-3" onSubmit={onSubmit}>
        <input
          name="orderNumber"
          required
          placeholder="Order number (e.g. #AA6354250474)"
          className="w-full border border-border rounded-xl px-3.5 py-3 text-sm outline-none focus:border-[#C9B896] bg-white"
          autoComplete="off"
        />
        <input
          name="phone"
          required
          type="tel"
          inputMode="numeric"
          placeholder="Phone number"
          className="w-full border border-border rounded-xl px-3.5 py-3 text-sm outline-none focus:border-[#C9B896] bg-white"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full btn-primary py-3 text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Checking…
            </>
          ) : (
            "Track package"
          )}
        </button>
      </form>

      {error && (
        <div className="mt-5 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl p-4">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-4">
          <div className="rounded-xl border border-[#E8E1D6] bg-[#FAF8F4] p-4 text-sm space-y-2.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#8A7355]">
                  Order
                </p>
                <p className="font-extrabold text-[#1C1410] text-lg break-all font-sans tracking-tight tabular-nums">
                  {formatOrderNumber(result.orderNumber)}
                </p>
                {result.placedAt ? (
                  <p className="text-xs text-[#8A7355] mt-0.5">
                    Placed {new Date(result.placedAt).toLocaleString("en-IN")}
                  </p>
                ) : null}
              </div>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-bold leading-none sm:px-2.5 sm:py-1 sm:text-[11px] sm:font-semibold ${orderStatusTone(result.status)}`}
              >
                {orderStatusLabel(result.status)}
              </span>
            </div>
            <p>
              <span className="text-[#8A7355]">Payment:</span>{" "}
              {paymentStatusLabel(result.paymentStatus)} ({result.paymentMethod})
            </p>
            <p>
              <span className="text-[#8A7355]">Total:</span>{" "}
              <strong>{formatINR(result.grandTotal)}</strong>
            </p>
            {result.items?.[0] ? (
              <p className="text-xs text-[#666] pt-1 border-t border-[#E8E1D6]">
                {result.items[0].productTitle}
                {(result.items.length || 0) > 1
                  ? ` +${result.items.length - 1} more`
                  : ""}
              </p>
            ) : null}
            {result.status === "CANCELLED" &&
              result.paymentStatus === "REFUNDED" && (
                <p className="text-xs text-emerald-800 bg-emerald-50 rounded-lg px-3 py-2">
                  Refund initiated. It may take 5–7 business days to appear in
                  your account.
                </p>
              )}
          </div>

          <ShipmentTrackingCard
            shipment={result.shipment}
            order={result}
          />
        </div>
      )}
    </div>
  );
}
