"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Wallet,
  Sparkles,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  ShoppingBag,
} from "lucide-react";
import { api } from "@/lib/api";
import { useCustomerAuth } from "@/lib/customer-auth";

type WalletSummary = {
  enabled: boolean;
  cashbackEarnEnabled?: boolean;
  creditTiming: string;
  cashbackPercent: number;
  redeemPercentOfBalance: number;
  expiryDays: number;
  balance: number;
  maxRedeem: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  lifetimeExpired: number;
  expiringSoon: {
    amount: number;
    expiresAt: string | null;
    orderNumber: string | null;
    reason: string;
  }[];
};

type HistoryRow = {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  reason: string;
  orderId: string | null;
  orderNumber: string | null;
  expiresAt: string | null;
  createdAt: string;
};

function inr(n: number) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

function typeMeta(type: string, amount: number) {
  if (type === "CASHBACK") {
    return { label: "Cashback", tone: "text-emerald-700 bg-emerald-50" };
  }
  if (type === "ADJUST") {
    return amount >= 0
      ? { label: "Credit", tone: "text-emerald-700 bg-emerald-50" }
      : { label: "Adjustment", tone: "text-slate-700 bg-slate-100" };
  }
  if (type === "REDEEM") {
    return { label: "Used on order", tone: "text-amber-800 bg-amber-50" };
  }
  if (type === "EXPIRE") {
    return { label: "Expired", tone: "text-rose-700 bg-rose-50" };
  }
  if (type === "REVERSE") {
    return { label: "Reversed", tone: "text-slate-700 bg-slate-100" };
  }
  return { label: type, tone: "text-slate-700 bg-slate-100" };
}

export default function AccountWalletPage() {
  const token = useCustomerAuth((s) => s.token);
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [w, h] = await Promise.all([
          api<WalletSummary>("/wallet", { token }),
          api<{ data: HistoryRow[] }>("/wallet/history?limit=40", { token }),
        ]);
        if (cancelled) return;
        setWallet(w);
        setHistory(h.data || []);
        setError("");
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Could not load wallet");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div>
      <div className="flex items-start gap-3 mb-6">
        <span className="mt-0.5 h-10 w-10 rounded-xl bg-[var(--bhagva)]/35 text-[#5C4810] grid place-items-center shrink-0">
          <Wallet size={18} strokeWidth={1.75} />
        </span>
        <div>
          <h2 className="text-xl font-bold text-[#1C1410]">Wallet</h2>
          <p className="text-sm text-[#7A6E62] mt-0.5">
            Cashback balance and activity
          </p>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0c1b54] via-[#16306e] to-[#108474] text-white px-5 py-6 sm:px-6 sm:py-7">
        <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-[var(--bhagva)]/20 blur-2xl pointer-events-none" />
        <div className="absolute -left-6 bottom-0 h-24 w-24 rounded-full bg-white/10 blur-xl pointer-events-none" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--bhagva)]">
              <Sparkles size={13} /> Wallet
            </p>
            <p className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight tabular-nums">
              {loading ? "…" : inr(wallet?.balance || 0)}
            </p>
            <p className="mt-2 text-sm text-white/75 max-w-sm leading-relaxed">
              {wallet?.enabled === false
                ? "Wallet rewards are paused right now."
                : `On checkout, use up to ${wallet?.redeemPercentOfBalance ?? 20}% of your product total from this balance. Unused cashback expires in ${wallet?.expiryDays ?? 30} days.`}
            </p>
          </div>
          <div className="rounded-xl bg-white/12 backdrop-blur-sm border border-white/10 px-4 py-3 min-w-[140px]">
            <p className="text-[10px] uppercase tracking-wide text-white/65 font-semibold">
              Wallet balance
            </p>
            <p className="text-xl font-bold tabular-nums text-[var(--bhagva)] mt-0.5">
              {inr(wallet?.balance || 0)}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2.5 sm:gap-3">
        {[
          {
            label: "Earned",
            value: inr(wallet?.lifetimeEarned || 0),
            icon: ArrowDownLeft,
          },
          {
            label: "Used",
            value: inr(wallet?.lifetimeSpent || 0),
            icon: ArrowUpRight,
          },
          {
            label: "Expired",
            value: inr(wallet?.lifetimeExpired || 0),
            icon: Clock,
          },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="rounded-xl border border-[#EAE4DB] bg-[#FBF9F5] px-3 py-3"
            >
              <div className="flex items-center gap-1.5 text-[#7A6E62]">
                <Icon size={13} />
                <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide">
                  {s.label}
                </span>
              </div>
              <p className="mt-1.5 text-sm sm:text-base font-bold text-[#1C1410] tabular-nums">
                {s.value}
              </p>
            </div>
          );
        })}
      </div>

      {wallet?.expiringSoon?.length ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3.5">
          <p className="text-sm font-semibold text-amber-950 flex items-center gap-2">
            <Clock size={15} /> Expiring soon
          </p>
          <ul className="mt-2 space-y-1.5">
            {wallet.expiringSoon.slice(0, 3).map((e, i) => (
              <li
                key={`${e.orderNumber}-${i}`}
                className="text-sm text-amber-900 flex justify-between gap-3"
              >
                <span>
                  {inr(e.amount)}
                  {e.orderNumber ? ` · #${e.orderNumber}` : ""}
                </span>
                <span className="text-xs font-medium whitespace-nowrap">
                  {e.expiresAt
                    ? new Date(e.expiresAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })
                    : "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        <Link
          href="/cart"
          className="inline-flex items-center gap-2 rounded-full bg-[#0c1b54] text-white text-sm font-semibold px-4 py-2.5 hover:bg-[#16306e] transition"
        >
          <ShoppingBag size={16} /> Shop & use wallet
        </Link>
        <Link
          href="/account/orders"
          className="inline-flex items-center gap-2 rounded-full border border-[#EAE4DB] bg-white text-sm font-semibold px-4 py-2.5 text-[#1C1410] hover:bg-[#F8F6F1] transition"
        >
          View orders
        </Link>
      </div>

      <div className="mt-8 pt-6 border-t border-[#EAE4DB]">
        <h3 className="text-base font-bold text-[#1C1410] mb-3">History</h3>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-3">
            {error}
          </p>
        )}

        {loading && (
          <p className="text-sm text-[#7A6E62] py-8 text-center">
            Loading wallet activity…
          </p>
        )}

        {!loading && history.length === 0 && (
          <div className="rounded-xl border border-dashed border-[#EAE4DB] px-4 py-8 text-center">
            <p className="font-semibold text-[#1C1410]">No wallet activity yet</p>
            <p className="text-sm text-[#7A6E62] mt-1 max-w-sm mx-auto leading-relaxed">
              {wallet?.enabled === false || wallet?.cashbackEarnEnabled === false
                ? "Cashback is turned off right now."
                : `After you buy, ${wallet?.cashbackPercent ?? 0}% cashback lands in your wallet${
                    wallet?.creditTiming === "instant"
                      ? " after payment"
                      : " after delivery"
                  }.`}
            </p>
          </div>
        )}

        <ul className="space-y-2">
          {history.map((h) => {
            const meta = typeMeta(h.type, h.amount);
            const credit = h.amount >= 0;
            return (
              <li
                key={h.id}
                className="rounded-xl border border-[#EAE4DB] bg-white px-3.5 py-3 flex gap-3 items-start"
              >
                <span
                  className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${meta.tone}`}
                >
                  {meta.label}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#1C1410]">
                    {h.reason}
                  </p>
                  <p className="text-xs text-[#7A6E62] mt-0.5">
                    {new Date(h.createdAt).toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {h.orderNumber ? (
                      <>
                        {" · "}
                        <Link
                          href={`/account/orders/${h.orderId || ""}`}
                          className="text-[#108474] font-medium hover:underline"
                        >
                          #{h.orderNumber}
                        </Link>
                      </>
                    ) : null}
                    {h.expiresAt && h.type === "CASHBACK" ? (
                      <>
                        {" · expires "}
                        {new Date(h.expiresAt).toLocaleDateString("en-IN")}
                      </>
                    ) : null}
                  </p>
                </div>
                <p
                  className={`text-sm font-bold tabular-nums shrink-0 ${
                    credit ? "text-emerald-700" : "text-rose-700"
                  }`}
                >
                  {credit ? "+" : ""}
                  {inr(h.amount)}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
