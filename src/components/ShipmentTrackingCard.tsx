"use client";

import {
  Check,
  Copy,
  ExternalLink,
  MapPin,
  Package,
  Phone,
  Truck,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { displayCourierName } from "@/lib/order-status";
import { resolveCourierTrackingUrl } from "@/lib/courier-tracking-url";
import { trackingPageUrl } from "@/lib/tracking-site";

type PublicTrackingResponse = {
  status?: string | null;
  edd?: string | null;
  syncedAt?: string | null;
  events?: {
    title?: string | null;
    location?: string | null;
    time?: string | null;
  }[];
};

export type ShipmentActivity = {
  date?: string | null;
  activity?: string | null;
  location?: string | null;
};

export type CourierAgentInfo = {
  name?: string | null;
  phone?: string | null;
  trackingStatus?: number | null;
};

export type ShipmentInfo = {
  pushed?: boolean;
  awb?: string | null;
  courier?: string | null;
  status?: string | null;
  trackingUrl?: string | null;
  edd?: string | null;
  syncedAt?: string | null;
  courierAgent?: CourierAgentInfo | null;
  activities?: ShipmentActivity[];
};

function statusTone(raw?: string | null) {
  const u = String(raw || "").toUpperCase();
  if (!raw) return "bg-amber-50 text-amber-900 border-amber-200";
  if (
    u.includes("OUT FOR DELIVERY") ||
    /\bOFD\b/.test(u) ||
    u.includes("OUT FOR")
  )
    return "bg-sky-50 text-sky-950 border-sky-200";
  // RTO before DELIVERED — "RTO DELIVERED" must stay rose, not green
  if (u.includes("CANCEL") || u.includes("RTO") || u.includes("LOST"))
    return "bg-rose-50 text-rose-900 border-rose-200";
  if (u.includes("DELIVERED"))
    return "bg-emerald-50 text-emerald-900 border-emerald-200";
  if (u.includes("EXCEPTION") || u.includes("NDR"))
    return "bg-orange-50 text-orange-950 border-orange-200";
  if (u.includes("TRANSIT") || u.includes("SHIPPED") || u.includes("PICK"))
    return "bg-sky-50 text-sky-950 border-sky-200";
  return "bg-[#F3EEE4] text-[#3F342C] border-[#E0D5C4]";
}

function formatWhen(iso?: string | null) {
  if (!iso || iso === "N/A") return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatEdd(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Newest first for Maruti; oldest first for Shiprocket-style journeys. */
function sortActivities(list: ShipmentActivity[], newestFirst: boolean) {
  const withIndex = list.map((a, i) => ({
    a,
    i,
    t: a.date ? Date.parse(String(a.date)) : NaN,
  }));
  const allDated = withIndex.every((x) => Number.isFinite(x.t));
  if (!allDated) {
    return newestFirst ? list : [...list].reverse();
  }
  return withIndex
    .sort((x, y) =>
      newestFirst ? y.t - x.t || x.i - y.i : x.t - y.t || x.i - y.i,
    )
    .map((x) => x.a);
}

function isDeliveredActivity(activity?: string | null) {
  const u = String(activity || "").toUpperCase();
  return u.includes("DELIVERED") && !u.includes("OUT FOR");
}

type Props = {
  shipment?: ShipmentInfo | null;
  order?: {
    orderNumber?: string | null;
    shiprocketAwb?: string | null;
    shiprocketStatus?: string | null;
    shiprocketCourierName?: string | null;
    shiprocketTracking?: ShipmentInfo | null;
    trackingNumber?: string | null;
    trackingCarrier?: string | null;
    trackingUrl?: string | null;
    status?: string;
    marutiTracking?: ShipmentInfo | null;
  } | null;
  compact?: boolean;
};

export function ShipmentTrackingCard({ shipment, order, compact }: Props) {
  const [copied, setCopied] = useState(false);
  const [live, setLive] = useState<PublicTrackingResponse | null>(null);

  const fromOrder: ShipmentInfo | null = order
    ? (() => {
        const maruti = /maruti/i.test(String(order.trackingCarrier || ""));
        const live = order.marutiTracking;
        return {
          pushed: Boolean(
            order.shiprocketAwb ||
              order.trackingNumber ||
              order.shiprocketTracking?.awb,
          ),
          awb: maruti
            ? live?.awb || order.trackingNumber || null
            : order.shiprocketAwb ||
              order.trackingNumber ||
              order.shiprocketTracking?.awb ||
              null,
          courier: maruti
            ? order.trackingCarrier
            : order.shiprocketCourierName ||
              order.trackingCarrier ||
              order.shiprocketTracking?.courier ||
              null,
          status: maruti
            ? live?.status ||
              (order.status === "DELIVERED" ? "Delivered" : "Shipped")
            : order.shiprocketStatus || order.shiprocketTracking?.status || null,
          trackingUrl: maruti
            ? (order.trackingNumber
                ? `https://shreemaruti.com/track-shipment/?awb=${encodeURIComponent(order.trackingNumber)}`
                : null)
            : order.trackingUrl || order.shiprocketTracking?.trackingUrl || null,
          edd: maruti ? null : order.shiprocketTracking?.edd || null,
          syncedAt: maruti
            ? live?.syncedAt || null
            : order.shiprocketTracking?.syncedAt || null,
          courierAgent: maruti
            ? live?.courierAgent || null
            : order.shiprocketTracking?.courierAgent || null,
          activities: maruti
            ? live?.activities || []
            : order.shiprocketTracking?.activities || [],
        };
      })()
    : null;

  const baseInfo = shipment || fromOrder;
  const orderRef =
    String(order?.orderNumber || "").replace(/[^A-Za-z0-9-]/g, "") || null;
  const liveRef = compact ? null : baseInfo?.awb ? orderRef || baseInfo.awb : null;

  useEffect(() => {
    if (!liveRef) return;
    let cancelled = false;
    api<PublicTrackingResponse>(`/tracking/${encodeURIComponent(liveRef)}`)
      .then((res) => {
        if (!cancelled) setLive(res);
      })
      .catch(() => {
        /* keep stored tracking */
      });
    return () => {
      cancelled = true;
    };
  }, [liveRef]);

  const liveActivities: ShipmentActivity[] = (live?.events || []).map((e) => ({
    date: e.time || null,
    activity: e.title || null,
    location: e.location || null,
  }));
  const info: ShipmentInfo | null =
    baseInfo &&
    live &&
    liveActivities.length > (baseInfo.activities?.length || 0)
      ? {
          ...baseInfo,
          status: live.status || baseInfo.status,
          edd: baseInfo.edd || live.edd || null,
          syncedAt: live.syncedAt || baseInfo.syncedAt,
          activities: liveActivities,
        }
      : baseInfo;
  if (!info) return null;

  const isMaruti = /maruti/i.test(String(info.courier || order?.trackingCarrier || ""));
  const hasShiprocket = Boolean(order?.shiprocketAwb);
  const awb = info.awb || null;
  const trackRef = awb ? orderRef || awb : null;
  const ourTrackUrl = trackingPageUrl(trackRef);
  const courierUrl = isMaruti
    ? awb
      ? `https://shreemaruti.com/track-shipment/?awb=${encodeURIComponent(awb)}`
      : null
    : info.trackingUrl ||
      resolveCourierTrackingUrl(
        info.courier || order?.trackingCarrier || null,
        awb || "",
        order?.trackingUrl,
      ) ||
      (hasShiprocket && awb
        ? `https://shiprocket.co/tracking/${awb}`
        : null);
  const label = String(info.status || "").trim() || "Awaiting shipment";
  const tone = statusTone(info.status);
  const activities = sortActivities(info.activities || [], isMaruti);
  const edd = formatEdd(info.edd);
  const courierLabel = displayCourierName(info.courier);
  const agent = info.courierAgent;
  const hasAgent = Boolean(agent?.name || agent?.phone);
  const notShippedYet =
    !info.pushed &&
    !awb &&
    !info.status &&
    order?.status &&
    !["SHIPPED", "DELIVERED"].includes(String(order.status).toUpperCase());

  async function copyAwb() {
    if (!awb) return;
    try {
      await navigator.clipboard.writeText(awb);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  if (notShippedYet && !compact) {
    return (
      <section className="rounded-2xl border border-[#E8E1D6] bg-white p-4 shadow-[0_6px_20px_rgba(28,20,16,0.04)] sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F3EEE4] text-[#3F342C]">
            <Package size={18} strokeWidth={1.75} />
          </span>
          <div>
            <h3 className="text-sm font-bold text-[#1C1410]">
              Shipment tracking
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-[#7A6E62]">
              Your package is being prepared. Tracking will appear here once it
              is with the courier.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (!awb && !info.status && !info.pushed) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-[#E8E1D6] bg-white shadow-[0_6px_20px_rgba(28,20,16,0.04)]">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-[#F0EBE3] px-3.5 py-3 sm:px-5 sm:py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#1C1410] text-white sm:h-10 sm:w-10">
            <Truck size={16} strokeWidth={1.75} className="sm:hidden" />
            <Truck size={18} strokeWidth={1.75} className="hidden sm:block" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-bold leading-tight text-[#1C1410] sm:text-lg">
              {isMaruti ? "Maruti courier" : courierLabel || "Shipment tracking"}
            </h3>
            <p className="mt-0.5 truncate text-[11px] text-[#8A7355] sm:text-xs">
              {isMaruti || courierLabel ? "Shipment tracking" : "Courier update"}
            </p>
          </div>
        </div>
        <span
          className={`inline-flex max-w-[42%] shrink-0 truncate rounded-full border px-2 py-0.5 text-[10px] font-bold sm:max-w-none sm:px-2.5 sm:py-1 sm:text-[11px] ${tone}`}
        >
          {label}
        </span>
      </div>

      <div className="space-y-3.5 px-3.5 py-3.5 sm:space-y-4 sm:px-5 sm:py-4">
        {/* AWB + EDD */}
        <div className="grid grid-cols-1 gap-3 rounded-xl bg-[#FAF8F4] p-3 sm:grid-cols-2 sm:gap-4 sm:p-3.5">
          {awb ? (
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#8A7355] sm:text-[10px]">
                Tracking number
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <p className="min-w-0 break-all font-mono text-[13px] font-bold text-[#1C1410] sm:text-sm">
                  {awb}
                </p>
                <button
                  type="button"
                  onClick={() => void copyAwb()}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#E0D5C4] bg-white px-2 py-1 text-[10px] font-semibold text-[#3F342C] hover:bg-[#F7F3EC] sm:text-[11px]"
                >
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          ) : null}
          {edd ? (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#8A7355] sm:text-[10px]">
                Expected delivery
              </p>
              <p className="mt-1.5 text-[13px] font-bold text-[#1C1410] sm:text-sm">
                {edd}
              </p>
            </div>
          ) : null}
        </div>

        {hasAgent ? (
          <div className="flex items-center gap-3 rounded-xl border border-[#EDE8DF] bg-[#FAF8F4] px-3 py-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-[#3F342C] ring-1 ring-[#E0D5C4]">
              <User size={14} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#8A7355]">
                Delivery agent
              </p>
              <p className="mt-0.5 truncate text-[13px] font-bold text-[#1C1410]">
                {agent?.name || "Courier partner"}
              </p>
              {agent?.phone ? (
                <a
                  href={`tel:${agent.phone}`}
                  className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 hover:underline"
                >
                  <Phone size={11} />
                  Call {agent.phone}
                </a>
              ) : null}
            </div>
          </div>
        ) : null}

        {ourTrackUrl || courierUrl ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <a
              href={ourTrackUrl || courierUrl || undefined}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1C1410] px-4 py-2.5 text-[13px] font-bold text-white hover:bg-[#2a211c] sm:w-auto sm:text-sm"
            >
              Track package <ExternalLink size={14} />
            </a>
            {ourTrackUrl && courierUrl ? (
              <a
                href={courierUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1 text-[12px] font-semibold text-[#8A7355] hover:text-[#1C1410] hover:underline"
              >
                Courier website <ExternalLink size={12} />
              </a>
            ) : null}
          </div>
        ) : null}

        {isMaruti && awb && !activities.length ? (
          <p className="text-[11px] leading-relaxed text-[#8A7355] sm:text-xs">
            Tracking number {awb}. Scan updates from Maruti will appear here
            shortly.
          </p>
        ) : null}

        {!compact && activities.length > 0 ? (
          <div className="pt-1">
            <p className="mb-3 text-[9px] font-bold uppercase tracking-[0.12em] text-[#8A7355] sm:text-[10px]">
              Tracking updates
            </p>
            <ol className="relative">
              {activities.slice(0, 30).map((a, i, arr) => {
                const isLatest = isMaruti ? i === 0 : i === arr.length - 1;
                const delivered = isDeliveredActivity(a.activity);
                const showCheck = isMaruti || !isLatest || delivered;
                return (
                  <li
                    key={`${a.date || ""}-${i}`}
                    className="relative flex gap-3 pb-0 last:pb-0"
                  >
                    {/* Flipkart-style rail: filled green through completed journey */}
                    <div className="relative flex w-5 shrink-0 flex-col items-center">
                      <span
                        className={`relative z-[1] mt-0.5 grid h-5 w-5 place-items-center rounded-full bg-[#26a541] text-white ${
                          isLatest
                            ? "shadow-[0_0_0_3px_rgba(38,165,65,0.22)]"
                            : ""
                        }`}
                      >
                        {showCheck ? (
                          <Check size={11} strokeWidth={3} />
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        )}
                      </span>
                      {!isLatest ? (
                        <span
                          aria-hidden
                          className="mt-0.5 w-[3px] flex-1 min-h-[1.75rem] rounded-full bg-[#26a541]"
                        />
                      ) : null}
                    </div>

                    <div
                      className={`min-w-0 flex-1 ${
                        isLatest ? "pb-0" : "pb-4"
                      }`}
                    >
                      <p
                        className={`text-[13px] leading-snug sm:text-sm ${
                          isLatest
                            ? "font-bold text-[#1C1410]"
                            : "font-medium text-[#5C534A]"
                        }`}
                      >
                        {a.activity || "Update"}
                      </p>
                      <p className="mt-1 flex flex-col gap-0.5 text-[10px] leading-snug text-[#8A7355] sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2 sm:text-[11px]">
                        {a.date ? <span>{formatWhen(a.date)}</span> : null}
                        {a.location ? (
                          <span className="inline-flex min-w-0 items-start gap-0.5">
                            <MapPin size={10} className="mt-0.5 shrink-0" />
                            <span className="break-words">{a.location}</span>
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
            {info.syncedAt ? (
              <p className="mt-3 text-[10px] text-[#A89880]">
                Last updated {formatWhen(info.syncedAt)}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
