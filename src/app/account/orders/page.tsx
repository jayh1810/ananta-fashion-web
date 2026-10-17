"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, PackageSearch } from "lucide-react";
import { api, formatINR } from "@/lib/api";
import { useCustomerAuth } from "@/lib/customer-auth";
import { useHydrated } from "@/lib/useHydrated";
import {
  formatOrderNumber,
  orderStatusDot,
  orderStatusLabel,
  orderStatusTone,
  paymentStatusLabel,
} from "@/lib/order-status";

type OrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod?: string;
  grandTotal: number;
  codDue?: number;
  codCollected?: number | null;
  placedAt: string;
  items?: { productTitle: string; quantity: number }[];
  shiprocketAwb?: string | null;
  trackingNumber?: string | null;
  shiprocketStatus?: string | null;
  trackingUrl?: string | null;
};

export default function MyOrdersPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const { token } = useCustomerAuth();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!hydrated) return;
    if (!token) {
      router.replace("/account/login?next=/account/orders");
      return;
    }
    setLoading(true);
    api<OrderRow[]>("/orders/me", { token })
      .then(setOrders)
      .catch((e) => setError(e.message || "Failed to load orders"))
      .finally(() => setLoading(false));
  }, [hydrated, token, router]);

  if (!hydrated || !token) {
    return <p className="text-sm text-[#7A6E62]">Loading…</p>;
  }

  return (
    <div>
      <div className="flex items-start gap-3 mb-5 sm:mb-6">
        <span className="mt-0.5 h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-[#EDE8DF] text-[#3F342C] grid place-items-center shrink-0">
          <PackageSearch size={18} strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-bold text-[#1C1410]">Your Orders</h2>
          <p className="text-xs sm:text-sm text-[#7A6E62] mt-0.5">
            {loading
              ? "Loading…"
              : `${orders.length} order${orders.length === 1 ? "" : "s"}`}
          </p>
        </div>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      {loading && <p className="text-sm text-[#7A6E62]">Loading orders…</p>}

      {!loading && !orders.length && (
        <div className="rounded-xl border border-dashed border-[#D8CFC0] bg-[#FAF8F4] p-10 text-center">
          <PackageSearch
            className="mx-auto text-[#C4B8A8] mb-3"
            size={32}
            strokeWidth={1.5}
          />
          <p className="text-[#7A6E62] mb-4">You have no orders yet.</p>
          <Link
            href="/collections/all"
            className="inline-block bg-[#1C1410] text-white px-5 py-2.5 rounded-xl text-sm font-bold"
          >
            Start shopping
          </Link>
        </div>
      )}

      <ul className="space-y-3">
        {orders.map((o) => (
          <li key={o.id}>
            <Link
              href={`/account/orders/${o.id}`}
              className="block rounded-xl border border-[#E8E1D6] bg-[#FAF8F4] p-3.5 sm:p-5 hover:border-[#C9B896] hover:bg-white transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold text-[#1C1410] text-sm sm:text-base break-all font-sans tracking-tight tabular-nums">
                    {formatOrderNumber(o.orderNumber)}
                  </p>
                  <p className="text-[11px] sm:text-xs text-[#8A7355] mt-0.5">
                    {new Date(o.placedAt).toLocaleString("en-IN")}
                  </p>
                </div>
                <p className="font-bold text-[#1C1410] text-sm sm:text-base tabular-nums shrink-0">
                  {formatINR(o.grandTotal)}
                </p>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span
                  className={`inline-flex max-w-full items-center gap-1.5 text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full border ${orderStatusTone(o.status)}`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full shrink-0 ${orderStatusDot(o.status)}`}
                  />
                  <span className="truncate">{orderStatusLabel(o.status)}</span>
                </span>
                {(o.shiprocketAwb || o.trackingNumber) && (
                  <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold text-sky-900">
                    Tracking {o.shiprocketAwb || o.trackingNumber}
                  </span>
                )}
              </div>
              {o.items?.[0] && (
                <p className="text-xs sm:text-sm text-[#555] mt-2 line-clamp-2">
                  {o.items[0].productTitle}
                  {(o.items.length || 0) > 1
                    ? ` +${o.items.length - 1} more`
                    : ""}
                </p>
              )}
              {o.paymentMethod === "PARTIAL_COD" && (o.codDue || 0) > 0 && (
                <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800">
                  <span
                    className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                      o.codCollected != null ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                  />
                  {o.codCollected != null
                    ? `${formatINR(o.codCollected)} COD collected`
                    : `${formatINR(o.codDue || 0)} due as COD on delivery`}
                </div>
              )}
              <div className="mt-3 flex items-center justify-between gap-2 text-[11px] sm:text-xs text-[#8A7355]">
                <span className="truncate">
                  Payment: {paymentStatusLabel(o.paymentStatus)}
                </span>
                <span className="inline-flex items-center gap-0.5 font-semibold text-[#1C1410] shrink-0">
                  View details <ChevronRight size={14} />
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
