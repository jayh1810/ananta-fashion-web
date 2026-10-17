"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ChevronRight,
  Clock,
  HelpCircle,
  LifeBuoy,
  MessageSquarePlus,
  ShieldAlert,
  Undo2,
} from "lucide-react";
import { api } from "@/lib/api";
import { ticketStatusTone, type TicketSummary } from "@/lib/support-tickets";
import { RaiseTicketModal } from "./RaiseTicketModal";

type OrderLite = React.ComponentProps<typeof RaiseTicketModal>["order"] & {
  status: string;
};

const REASONS = [
  { icon: Undo2, label: "Return / replacement" },
  { icon: ShieldAlert, label: "Damaged or wrong item" },
  { icon: HelpCircle, label: "Any question" },
];

export function OrderTicketsSection({
  order,
  token,
  deliveredAt,
}: {
  order: OrderLite;
  token: string;
  deliveredAt?: string | null;
}) {
  const [tickets, setTickets] = useState<TicketSummary[] | null>(null);
  const [open, setOpen] = useState(false);
  const delivered = order.status === "DELIVERED";

  const load = useCallback(
    () =>
      api<TicketSummary[]>(
        `/support-tickets/me?orderId=${encodeURIComponent(order.id)}`,
        { token },
      )
        .then(setTickets)
        .catch(() => setTickets([])),
    [order.id, token],
  );

  useEffect(() => {
    let alive = true;
    api<TicketSummary[]>(
      `/support-tickets/me?orderId=${encodeURIComponent(order.id)}`,
      { token },
    )
      .then((rows) => alive && setTickets(rows))
      .catch(() => alive && setTickets([]));
    return () => {
      alive = false;
    };
  }, [order.id, token]);

  if (!delivered && !tickets?.length) return null;
  const count = tickets?.length || 0;

  return (
    <section
      id="order-help"
      className="mt-5 scroll-mt-24 overflow-hidden rounded-2xl border border-[#E8DCC8] bg-white shadow-[0_6px_20px_rgba(28,20,16,0.05)]"
    >
      <div className="bg-gradient-to-br from-[#FFF5E4] via-[#FFFAF2] to-white px-4 py-5 sm:px-6">
        <div className="flex items-start gap-3.5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#1C1410] text-[#F2D49B] shadow-sm">
            <LifeBuoy size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-extrabold text-[#1C1410]">Need help with this order?</h3>
            <p className="mt-0.5 text-[13px] leading-relaxed text-[#5C534A]">
              {delivered
                ? "We're here to help with returns, replacements, damaged or wrong items, and any questions."
                : "Your support tickets for this order."}
            </p>
          </div>
        </div>

        {delivered ? (
          <>
            <ul className="mt-4 flex flex-wrap gap-2">
              {REASONS.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#EADCC4] bg-white/80 px-3 py-1.5 text-[12px] font-semibold text-[#3F342C]"
                >
                  <Icon size={13} className="text-[#8B6B3E]" /> {label}
                </li>
              ))}
            </ul>

            <div className="mt-4 flex flex-col gap-3 border-t border-[#F0E6D6] pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-1.5 text-[12px] text-[#7A6A58]">
                <Clock size={13} className="shrink-0" />
                Replies within 24–48 hours · keep your unboxing video &amp; photos ready
              </p>
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-full bg-[#1C1410] px-5 py-3 text-sm font-bold text-white shadow-[0_6px_16px_rgba(28,20,16,0.18)] transition hover:bg-[#3A2D22] active:scale-[0.98] sm:w-auto sm:py-2.5"
              >
                <MessageSquarePlus size={16} /> Raise a ticket
              </button>
            </div>
          </>
        ) : null}
      </div>

      {count ? (
        <div className="border-t border-[#E8DCC8]">
          <div className="flex items-center justify-between px-4 pb-1 pt-3 sm:px-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#8A7355]">
              Your tickets ({count})
            </p>
            <Link href="/account/tickets" className="text-[12px] font-semibold text-[#8B4513] hover:underline">
              View all
            </Link>
          </div>
          <ul className="px-2 pb-2 sm:px-3">
            {tickets!.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/account/tickets/${t.id}`}
                  className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-[#FBF6EE] sm:px-3"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#F6EEDF] text-[#8B6B3E]">
                    <LifeBuoy size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-semibold text-[#1C1410]">
                      <span className="truncate">{t.categoryLabel}</span>
                      {t.customerUnread ? (
                        <span className="shrink-0 rounded-full bg-[#8B4513] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                          New reply
                        </span>
                      ) : null}
                    </p>
                    <p className="text-[11px] text-[#8A7355]">
                      <span className="font-mono">{t.ticketNumber}</span> ·{" "}
                      {new Date(t.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${ticketStatusTone(t.status)}`}>
                    {t.statusLabel}
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-[#B0A090]" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {open ? (
        <RaiseTicketModal
          order={order}
          token={token}
          deliveredAt={deliveredAt}
          onClose={() => setOpen(false)}
          onCreated={() => void load()}
        />
      ) : null}
    </section>
  );
}
