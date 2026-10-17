"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Clock,
  ExternalLink,
  Package,
  Phone,
  Video,
} from "lucide-react";
import { api, formatINR } from "@/lib/api";
import { useCustomerAuth } from "@/lib/customer-auth";
import { useHydrated } from "@/lib/useHydrated";
import {
  ORDER_FLOW_STEPS,
  customerHistoryNote,
  formatOrderNumber,
  orderStatusDot,
  orderStatusLabel,
  orderStatusTone,
  orderTimelineStepIndex,
  paymentMethodLabel,
  paymentStatusLabel,
  paymentStatusTone,
} from "@/lib/order-status";
import {
  ShipmentTrackingCard,
  type ShipmentInfo,
} from "@/components/ShipmentTrackingCard";
import { OrderTicketsSection } from "@/components/support/OrderTicketsSection";

type OrderDetail = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  grandTotal: number;
  subtotal: number;
  shippingTotal: number;
  discountTotal: number;
  taxTotal?: number;
  placedAt: string;
  phone?: string;
  email?: string;
  razorpayPaymentId?: string | null;
  shippingAddress?: Record<string, string>;
  items?: {
    id: string;
    productTitle: string;
    variantTitle?: string;
    quantity: number;
    unitPrice: number;
    lineTotal?: number;
  }[];
  codDue?: number;
  codCollected?: number | null;
  codCollectedAt?: string | null;
  statusHistory?: {
    id: string;
    status: string;
    note?: string;
    createdAt: string;
  }[];
  shipment?: ShipmentInfo;
  shiprocketAwb?: string | null;
  shiprocketStatus?: string | null;
  shiprocketCourierName?: string | null;
  shiprocketTracking?: ShipmentInfo | null;
  trackingNumber?: string | null;
  trackingCarrier?: string | null;
  trackingUrl?: string | null;
};

export default function MyOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const hydrated = useHydrated();
  const { token } = useCustomerAuth();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) {
      router.replace(`/account/login?next=/account/orders/${params.id}`);
      return;
    }
    if (!params.id) return;
    setLoading(true);
    api<OrderDetail>(`/orders/me/${params.id}`, { token })
      .then(setOrder)
      .catch((e) => setError(e.message || "Order not found"))
      .finally(() => setLoading(false));
  }, [hydrated, token, router, params.id]);

  if (!hydrated || !token || loading) {
    return <p className="text-sm text-[#7A6E62]">Loading order…</p>;
  }

  if (error || !order) {
    return (
      <div>
        <Link
          href="/account/orders"
          className="inline-flex items-center gap-1 text-sm font-semibold mb-4 text-[#3F342C]"
        >
          <ArrowLeft size={16} /> Your orders
        </Link>
        <p className="text-red-600 text-sm">{error || "Order not found"}</p>
      </div>
    );
  }

  const addr = order.shippingAddress || {};
  const stepIdx = orderTimelineStepIndex(order.status);
  const cancelled =
    order.status === "CANCELLED" || order.status === "RETURNED";
  const refunded = order.paymentStatus === "REFUNDED";
  const razorpayPaymentId = order.razorpayPaymentId;
  const deliveredAt =
    [...(order.statusHistory || [])]
      .reverse()
      .find((h) => h.status === "DELIVERED")?.createdAt || null;

  return (
    <div>
      <Link
        href="/account/orders"
        className="inline-flex items-center gap-1 text-sm font-semibold text-[#6B5E52] hover:text-[#1C1410] mb-5"
      >
        <ArrowLeft size={16} /> Your orders
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8A7355]">
            Order number
          </p>
          <h2 className="mt-1 text-2xl sm:text-[1.75rem] font-extrabold tracking-tight font-sans text-[#1C1410] tabular-nums">
            {formatOrderNumber(order.orderNumber)}
          </h2>
          <p className="text-sm text-[#7A6E62] mt-1.5">
            Placed{" "}
            {new Date(order.placedAt).toLocaleString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-[#1C1410] font-sans tabular-nums">
            {formatINR(order.grandTotal)}
          </p>
          <span
            className={`mt-1.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold leading-none sm:mt-1 sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-[11px] sm:font-semibold ${orderStatusTone(order.status)}`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${orderStatusDot(order.status)}`}
            />
            {orderStatusLabel(order.status)}
          </span>
        </div>
      </div>

      {order.status === "PAID" && (
        <div className="mb-5 rounded-2xl bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-950">
          Payment received. We are reviewing your order — status will update to{" "}
          <strong>Approved</strong> once confirmed.
        </div>
      )}
      {order.status === "APPROVED" && (
        <div className="mb-5 rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-950">
          Your order is <strong>approved</strong> and will be packed for
          shipping soon.
        </div>
      )}
      {cancelled && (
        <div className="mb-5 rounded-2xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-900">
          This order was cancelled
          {refunded
            ? ". Your payment has been refunded — it may take 5–7 business days to reflect in your account."
            : "."}
        </div>
      )}

      {/* Timeline — horizontal */}
      {!cancelled && (
        <section className="mb-5 rounded-2xl border border-[#E8E1D6] bg-white p-3.5 shadow-[0_6px_20px_rgba(28,20,16,0.04)] sm:mb-6 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-2 sm:mb-5">
            <h3 className="text-[13px] font-bold text-[#1C1410] sm:text-sm">
              Order progress
            </h3>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold leading-none text-emerald-800 ring-1 ring-emerald-100">
              {orderStatusLabel(order.status)}
            </span>
          </div>

          <ol className="flex w-full">
            {ORDER_FLOW_STEPS.map((step, i) => {
              const done = stepIdx >= i;
              const current = stepIdx === i;
              const label =
                step === "PAID" ? "Paid" : orderStatusLabel(step);
              return (
                <li
                  key={step}
                  className="relative flex min-w-0 flex-1 flex-col items-center"
                >
                  {i > 0 ? (
                    <span
                      aria-hidden
                      className={`absolute left-0 right-1/2 top-[13px] h-0.5 sm:top-[15px] sm:h-1 ${
                        stepIdx >= i ? "bg-emerald-500" : "bg-[#EDE8DF]"
                      }`}
                    />
                  ) : null}
                  {i < ORDER_FLOW_STEPS.length - 1 ? (
                    <span
                      aria-hidden
                      className={`absolute left-1/2 right-0 top-[13px] h-0.5 sm:top-[15px] sm:h-1 ${
                        stepIdx > i ? "bg-emerald-500" : "bg-[#EDE8DF]"
                      }`}
                    />
                  ) : null}

                  <span
                    className={`relative z-[1] grid h-7 w-7 place-items-center rounded-full text-[10px] font-bold sm:h-8 sm:w-8 sm:text-[11px] ${
                      current
                        ? "bg-emerald-600 text-white shadow-[0_0_0_3px_rgba(5,150,105,0.2)]"
                        : done
                          ? "bg-emerald-600 text-white"
                          : "bg-[#F7F3EC] text-[#B0A090] ring-1 ring-[#E0D5C4]"
                    }`}
                  >
                    {done ? <Check size={13} strokeWidth={3} /> : i + 1}
                  </span>
                  <p
                    className={`mt-1.5 max-w-full truncate px-0.5 text-center text-[9px] leading-tight sm:mt-2 sm:text-[11px] ${
                      current
                        ? "font-bold text-emerald-900"
                        : done
                          ? "font-semibold text-[#1C1410]"
                          : "font-medium text-[#A89880]"
                    }`}
                  >
                    {label}
                  </p>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <div className="mb-6">
        <ShipmentTrackingCard shipment={order.shipment} order={order} />
      </div>

      <section className="mb-4 rounded-xl border border-[#E8E1D6] bg-[#FAF8F4] p-4 sm:p-5">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-[#1C1410]">
          <Package size={16} strokeWidth={1.75} /> Items
        </h3>
        <ul className="divide-y divide-[#f0f0f0]">
          {order.items?.map((item) => (
            <li
              key={item.id}
              className="py-3 flex justify-between gap-3 text-sm"
            >
              <div>
                <p className="font-medium">{item.productTitle}</p>
                <p className="text-xs text-[#888]">
                  {item.variantTitle} · Qty {item.quantity}
                </p>
              </div>
              <p className="font-semibold whitespace-nowrap">
                {formatINR(item.lineTotal ?? item.unitPrice * item.quantity)}
              </p>
            </li>
          ))}
        </ul>
        <div className="mt-3 pt-3 border-t border-[#f0f0f0] space-y-1.5 text-sm">
          <div className="flex justify-between text-[#666]">
            <span>Subtotal</span>
            <span>{formatINR(order.subtotal)}</span>
          </div>
          {order.discountTotal > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span>Discount</span>
              <span>-{formatINR(order.discountTotal)}</span>
            </div>
          )}
          <div className="flex justify-between text-[#666]">
            <span>Shipping</span>
            <span>
              {order.shippingTotal ? formatINR(order.shippingTotal) : "Free"}
            </span>
          </div>
          {!!order.taxTotal && (
            <div className="flex justify-between text-[#666]">
              <span>Tax / GST</span>
              <span>{formatINR(order.taxTotal)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base pt-1">
            <span>Total</span>
            <span>{formatINR(order.grandTotal)}</span>
          </div>
          <div className="flex items-center gap-2 pt-1 text-xs text-[#888]">
            <span>Payment</span>
            <span
              className={`font-semibold px-2 py-0.5 rounded-full border ${paymentStatusTone(order.paymentStatus)}`}
            >
              {paymentStatusLabel(order.paymentStatus)}
            </span>
            <span>· {paymentMethodLabel(order.paymentMethod)}</span>
          </div>
          {razorpayPaymentId && (
            <p className="text-xs text-[#666] pt-1 break-all">
              Transaction ID:{" "}
              <span className="font-mono font-semibold text-[#333]">
                {razorpayPaymentId}
              </span>
            </p>
          )}
        </div>

        {order.paymentMethod === "PARTIAL_COD" && (order.codDue || 0) > 0 && (
          <div className="relative mt-4 rounded-xl border border-[#E8E1D6] bg-white p-4">
            <span
              className="absolute left-[26px] top-[30px] bottom-[26px] w-px bg-[#E8E1D6]"
              aria-hidden
            />
            <div className="relative flex items-start gap-3 pb-4">
              <span className="relative z-[1] grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-600 text-white">
                <Check size={13} strokeWidth={3} />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-[13px] font-bold text-[#1C1410]">
                  Paid online
                </p>
                <p className="text-[11px] text-[#8A7355]">
                  Received via Razorpay
                </p>
              </div>
              <span className="shrink-0 pt-0.5 text-sm font-bold text-[#1C1410]">
                {formatINR(order.grandTotal - (order.codDue || 0))}
              </span>
            </div>
            <div className="relative flex items-start gap-3">
              <span
                className={`relative z-[1] grid h-6 w-6 shrink-0 place-items-center rounded-full text-white ${
                  order.codCollected != null ? "bg-emerald-600" : "bg-amber-500"
                }`}
              >
                {order.codCollected != null ? (
                  <Check size={13} strokeWidth={3} />
                ) : (
                  <Clock size={12} strokeWidth={2.5} />
                )}
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p
                  className={`text-[13px] font-bold ${
                    order.codCollected != null
                      ? "text-[#1C1410]"
                      : "text-amber-800"
                  }`}
                >
                  {order.codCollected != null
                    ? "Collected on delivery"
                    : "Cash on delivery"}
                </p>
                <p
                  className={`text-[11px] ${
                    order.codCollected != null
                      ? "text-[#8A7355]"
                      : "text-amber-700"
                  }`}
                >
                  {order.codCollected != null
                    ? "Received by the delivery agent"
                    : "Pending · pay this to the delivery agent"}
                </p>
              </div>
              <span
                className={`shrink-0 pt-0.5 text-sm font-bold ${
                  order.codCollected != null
                    ? "text-[#1C1410]"
                    : "text-amber-800"
                }`}
              >
                {formatINR(order.codCollected ?? order.codDue ?? 0)}
              </span>
            </div>
          </div>
        )}
      </section>

      {!cancelled ? (
        <section className="mb-4 overflow-hidden rounded-xl border border-[#E8E1D6] bg-white shadow-[0_4px_16px_rgba(28,20,16,0.04)]">
          <div className="border-b border-[#E8E1D6] bg-[#FAF8F4] px-4 py-3 sm:px-5">
            <h3 className="text-sm font-bold text-[#1C1410]">
              Returns &amp; replacement
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-[#5C534A]">
              Eligible items can be returned within{" "}
              <strong className="font-semibold text-[#1C1410]">
                7 days of delivery
              </strong>{" "}
              if defective, damaged, or incorrect — unused, in original
              packaging, with tags attached. Report missing items within{" "}
              <strong className="font-semibold text-[#1C1410]">72 hours</strong>{" "}
              of delivery.
            </p>
          </div>

          <div className="space-y-3 p-4 sm:p-5">
            <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-[#FFF8EE] px-3.5 py-3.5 sm:px-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-amber-900/80">
                Required for your claim
              </p>
              <ul className="mt-2.5 space-y-2.5">
                <li className="flex gap-2.5 text-sm text-[#3F342C]">
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-900">
                    <Video size={14} strokeWidth={2.25} aria-hidden />
                  </span>
                  <span>
                    <strong className="font-bold text-[#1C1410]">
                      Unboxing video
                    </strong>
                    <span className="text-[#5C534A]">
                      {" "}
                      — record while opening the package so the seal and
                      contents are clearly visible.
                    </span>
                  </span>
                </li>
                <li className="flex gap-2.5 text-sm text-[#3F342C]">
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-900">
                    <Package size={14} strokeWidth={2.25} aria-hidden />
                  </span>
                  <span>
                    <strong className="font-bold text-[#1C1410]">
                      Photo / video proof
                    </strong>
                    <span className="text-[#5C534A]">
                      {" "}
                      — clear images of the issue (damage, defect, or wrong
                      item) with the product and packaging.
                    </span>
                  </span>
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-3 rounded-xl border border-[#E8E1D6] bg-[#FAF8F4] px-3.5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#8A7355]">
                  Contact support
                </p>
                <a
                  href="tel:+919712999954"
                  className="mt-1 inline-flex items-center gap-2 text-base font-extrabold tabular-nums text-[#1C1410] hover:text-[var(--bhagva-deep,#8B4513)]"
                >
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-[var(--bhagva-deep,#8B4513)] ring-1 ring-[#E8E1D6]">
                    <Phone size={15} strokeWidth={2.25} aria-hidden />
                  </span>
                  +91 97129 99954
                </a>
                <p className="mt-1 text-xs text-[#7A6E62]">
                  {order.status === "DELIVERED" ? (
                    <>
                      Fastest:{" "}
                      <a href="#order-help" className="font-semibold text-[var(--bhagva-deep,#8B4513)] underline underline-offset-2">
                        raise a ticket
                      </a>{" "}
                      with your unboxing video and photos.
                    </>
                  ) : (
                    "You can raise a ticket with your unboxing video and photos once the order is delivered."
                  )}
                </p>
              </div>
              <Link
                href="/policies/refund-policy"
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-[#D4C4B0] bg-white px-3.5 py-2 text-xs font-bold text-[#3F342C] hover:border-[#C4A882] hover:bg-[#FFFCF7]"
              >
                Full Return Policy
                <ExternalLink size={13} strokeWidth={2.25} aria-hidden />
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-[#E8E1D6] bg-[#FAF8F4] p-4 sm:p-5 text-sm">
        <h3 className="text-sm font-bold mb-2 text-[#1C1410]">Shipping to</h3>
        <p className="font-medium">{addr.name || "—"}</p>
        <p className="text-[#555]">
          {addr.line1}
          {addr.line2 ? `, ${addr.line2}` : ""}
        </p>
        <p className="text-[#555]">
          {addr.city}, {addr.state} {addr.pincode}
        </p>
        {order.phone && <p className="text-[#555] mt-1">Phone: {order.phone}</p>}
      </section>

      {!!order.statusHistory?.length && (
        <section className="mt-4 rounded-xl border border-[#E8E1D6] bg-[#FAF8F4] p-4 sm:p-5">
          <h3 className="text-sm font-bold mb-3 text-[#1C1410]">Updates</h3>
          <ul className="space-y-3">
            {[...order.statusHistory].reverse().map((h) => {
              const note = customerHistoryNote(h.note);
              return (
                <li key={h.id} className="text-sm flex justify-between gap-3">
                  <div>
                    <p className="font-semibold">{orderStatusLabel(h.status)}</p>
                    {note ? (
                      <p className="text-xs text-[#666] mt-0.5">{note}</p>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-[#999] whitespace-nowrap">
                    {new Date(h.createdAt).toLocaleString("en-IN")}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <OrderTicketsSection order={order} token={token} deliveredAt={deliveredAt} />
    </div>
  );
}
