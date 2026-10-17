"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, LifeBuoy, PackageSearch } from "lucide-react";
import { api } from "@/lib/api";
import { useCustomerAuth } from "@/lib/customer-auth";
import { useHydrated } from "@/lib/useHydrated";
import { ticketStatusTone, type TicketSummary } from "@/lib/support-tickets";

export default function MyTicketsPage() {
  const hydrated = useHydrated();
  const { token } = useCustomerAuth();
  const [rows, setRows] = useState<TicketSummary[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!hydrated || !token) return;
    api<TicketSummary[]>("/support-tickets/me", { token })
      .then(setRows)
      .catch((e: Error) => setError(e.message || "Could not load tickets"));
  }, [hydrated, token]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#1C1410] sm:text-xl">Support tickets</h2>
          <p className="mt-1 text-sm text-[#6B5E52]">
            Returns, replacements and questions about your delivered orders.
          </p>
        </div>
        <Link
          href="/account/orders"
          className="inline-flex items-center gap-1.5 rounded-full border border-[#D4C4B0] bg-white px-3.5 py-2 text-xs font-bold text-[#3F342C] hover:bg-[#FFFCF7]"
        >
          <PackageSearch size={14} /> Raise from an order
        </Link>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!rows && !error ? <p className="text-sm text-[#7A6E62]">Loading tickets…</p> : null}

      {rows && rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#DDD5C8] bg-[#FBF8F2] px-6 py-12 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white text-[#8B6B3E] ring-1 ring-[#E8E1D6]">
            <LifeBuoy size={22} />
          </span>
          <p className="mt-3 text-sm font-bold text-[#1C1410]">No tickets yet</p>
          <p className="mx-auto mt-1 max-w-sm text-[13px] text-[#6B5E52]">
            Open a delivered order and tap <strong>Raise a ticket</strong> for a return, replacement or any
            question.
          </p>
        </div>
      ) : null}

      {rows?.length ? (
        <ul className="space-y-2.5">
          {rows.map((t) => (
            <li key={t.id}>
              <Link
                href={`/account/tickets/${t.id}`}
                className="flex items-center gap-3 rounded-2xl border border-[#E8E1D6] bg-white px-4 py-3.5 transition hover:border-[#CDBB9F] hover:bg-[#FFFCF7]"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F7F1E6] text-[#8B6B3E]">
                  <LifeBuoy size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-bold text-[#1C1410]">
                    <span className="truncate">{t.subject}</span>
                    {t.customerUnread ? (
                      <span className="shrink-0 rounded-full bg-[#8B4513] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                        New reply
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-[#8A7355]">
                    <span className="font-mono">{t.ticketNumber}</span> · Order #{t.order.orderNumber} · Updated{" "}
                    {new Date(t.lastMessageAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </p>
                </div>
                <span className={`hidden shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold sm:inline-flex ${ticketStatusTone(t.status)}`}>
                  {t.statusLabel}
                </span>
                <ChevronRight size={16} className="shrink-0 text-[#B0A090]" />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
