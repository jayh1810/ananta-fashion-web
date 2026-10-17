"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, LogIn, Package, Truck } from "lucide-react";
import { formatINR } from "@/lib/api";
import { isUsableImageSrc } from "@/lib/is-usable-image-src";
import { trackingPageUrl } from "@/lib/tracking-site";
import type { CopilotAction, CopilotOrder } from "./copilot-client";

const STATUS: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Confirmed", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  PAID: { label: "Confirmed", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  APPROVED: { label: "Preparing", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  PACKED: { label: "Packed", className: "bg-sky-50 text-sky-700 ring-sky-200" },
  PROCESSING: { label: "Handed to courier", className: "bg-sky-50 text-sky-700 ring-sky-200" },
  SHIPPED: { label: "On the way", className: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
  DELIVERED: { label: "Delivered", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  CANCELLED: { label: "Cancelled", className: "bg-red-50 text-red-700 ring-red-200" },
  RETURNED: { label: "Returned", className: "bg-slate-100 text-slate-700 ring-slate-200" },
};

function placedOn(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function CopilotOrderCards({
  orders,
  onNavigate,
}: {
  orders: CopilotOrder[];
  onNavigate: () => void;
}) {
  return (
    <div className="mt-2 space-y-2">
      {orders.map((o) => {
        const trackUrl = trackingPageUrl(o.awb) ?? o.trackingUrl;
        const status = STATUS[o.status] ?? {
          label: o.status.charAt(0) + o.status.slice(1).toLowerCase(),
          className: "bg-slate-100 text-slate-700 ring-slate-200",
        };
        return (
          <div
            key={o.id}
            className="max-w-[94%] overflow-hidden rounded-xl border border-[var(--cream-dark)] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          >
            <div className="flex items-start gap-2.5 p-2.5">
              <span className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-[var(--cream)]">
                {o.image && isUsableImageSrc(o.image) ? (
                  <Image src={o.image} alt="" fill sizes="48px" className="object-cover" />
                ) : (
                  <Package className="h-5 w-5 text-[var(--bhagva-deep)]" aria-hidden />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[12.5px] font-bold text-ink">#{o.orderNumber.replace(/^#/, "")}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1 ${status.className}`}>
                    {status.label}
                  </span>
                </div>
                <p className="mt-0.5 line-clamp-1 text-[12px] text-[#4b5563]">{o.title}</p>
                <p className="mt-0.5 text-[11px] text-[#8a8170]">
                  {placedOn(o.placedAt)} · {o.itemCount} item{o.itemCount === 1 ? "" : "s"} ·{" "}
                  <span className="font-semibold text-ink">{formatINR(o.total)}</span>
                </p>
                {o.courier || o.awb ? (
                  <p className="mt-0.5 truncate text-[11px] text-[#8a8170]">
                    {o.courier ? o.courier : "Courier"}
                    {o.awb ? ` · AWB ${o.awb}` : ""}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex border-t border-[var(--cream-dark)] text-[12px] font-semibold">
              {trackUrl ? (
                <a
                  href={trackUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-1 items-center justify-center gap-1.5 py-2 text-[var(--bhagva-deep)] hover:bg-[var(--bhagva-soft)]"
                >
                  <Truck className="h-3.5 w-3.5" /> Track shipment
                </a>
              ) : null}
              <Link
                href={`/account/orders/${o.id}`}
                prefetch={false}
                onClick={onNavigate}
                className={`flex flex-1 items-center justify-center gap-1 py-2 text-ink hover:bg-[var(--cream)] ${
                  trackUrl ? "border-l border-[var(--cream-dark)]" : ""
                }`}
              >
                View details <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CopilotActions({
  actions,
  onLogin,
  onNavigate,
}: {
  actions: CopilotAction[];
  onLogin: () => void;
  onNavigate: () => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {actions.map((a) =>
        a.type === "login" ? (
          <button
            key="login"
            type="button"
            onClick={onLogin}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--footer-bg)] px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:brightness-110"
          >
            <LogIn className="h-3.5 w-3.5" /> {a.label}
          </button>
        ) : (
          <Link
            key={a.href}
            href={a.href}
            prefetch={false}
            onClick={onNavigate}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--cream-dark)] bg-white px-3 py-1.5 text-[12px] font-semibold text-ink hover:border-[var(--bhagva)]"
          >
            {a.label} <ArrowUpRight className="h-3.5 w-3.5 text-[var(--bhagva-deep)]" />
          </Link>
        ),
      )}
    </div>
  );
}
