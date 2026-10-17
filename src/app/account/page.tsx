"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  MapPinned,
  PackageSearch,
  Phone,
  Sparkles,
  UserRound,
  Wallet,
} from "lucide-react";
import { api, formatINR } from "@/lib/api";
import { useCustomerAuth } from "@/lib/customer-auth";

type WalletSummary = {
  enabled: boolean;
  balance: number;
  cashbackPercent: number;
  cashbackEarnEnabled?: boolean;
  redeemPercentOfBalance: number;
  maxRedeem: number;
};

export default function AccountPage() {
  const { user, token } = useCustomerAuth();
  const [wallet, setWallet] = useState<WalletSummary | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api<WalletSummary>("/wallet", { token })
      .then((w) => {
        if (!cancelled) setWallet(w);
      })
      .catch(() => {
        if (!cancelled) setWallet(null);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const addresses = user?.addresses || [];
  const defaultAddress =
    addresses.find((a) => a.isDefault) || addresses[0] || null;
  const displayName = defaultAddress?.name || null;
  const displayPhone = user?.phone || null;
  const firstLetter = (displayName || displayPhone || "A")
    .trim()
    .charAt(0)
    .toUpperCase();
  const cashbackPct = wallet?.cashbackPercent ?? 0;
  const walletOn = wallet?.enabled === true;
  const cashbackEarnOn = walletOn && wallet?.cashbackEarnEnabled === true;
  const balance = wallet?.balance ?? 0;

  return (
    <div>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 h-10 w-10 rounded-xl bg-[var(--bhagva)]/35 text-[#5C4810] grid place-items-center shrink-0">
          <UserRound size={18} strokeWidth={1.75} />
        </span>
        <div>
          <h2 className="text-xl font-bold text-[#1C1410]">Overview</h2>
          <p className="text-sm text-[#7A6E62] mt-0.5">
            Your profile at a glance
          </p>
        </div>
      </div>

      <div className="mt-7 space-y-5">
        <div className="flex items-center gap-4 pb-5 border-b border-[#EEE8DE]">
          <div className="h-16 w-16 rounded-2xl bg-[var(--bhagva)] text-[#1a1208] font-bold text-2xl grid place-items-center shrink-0 shadow-[inset_0_-2px_0_rgba(0,0,0,0.06)]">
            {firstLetter}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-[#1C1410] truncate">
              {displayName || "Your profile"}
            </p>
            <p className="text-sm text-[#7A6E62] mt-0.5">
              Signed in with mobile OTP
            </p>
            {displayPhone && (
              <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-medium text-[#3F342C]">
                <Phone
                  size={14}
                  strokeWidth={1.75}
                  className="text-[#8A7355]"
                />
                +91 {displayPhone}
              </p>
            )}
          </div>
        </div>

        {walletOn ? (
        <Link
          href="/account/wallet"
          className="group relative block overflow-hidden rounded-2xl bg-gradient-to-br from-[#0c1b54] via-[#16306e] to-[#108474] text-white p-5 sm:p-6 shadow-md hover:shadow-lg transition-shadow"
        >
          <div className="absolute -right-6 -top-8 h-28 w-28 rounded-full bg-[var(--bhagva)]/20 blur-2xl pointer-events-none" />
          <div className="absolute -left-4 bottom-0 h-20 w-20 rounded-full bg-white/10 blur-xl pointer-events-none" />

          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--bhagva)]">
                <Sparkles size={13} /> Wallet
              </p>
              <p className="mt-2 text-[13px] text-white/70">Wallet balance</p>
              <p className="mt-0.5 text-3xl sm:text-4xl font-bold tracking-tight tabular-nums">
                {wallet ? formatINR(balance) : "…"}
              </p>
              <p className="mt-2 text-sm text-white/75 max-w-sm leading-relaxed">
                Use up to {wallet?.redeemPercentOfBalance ?? 20}% of your product
                total at checkout.
              </p>
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              {cashbackEarnOn ? (
                <span className="inline-flex items-center rounded-full bg-[var(--bhagva)] text-white px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide shadow-sm">
                  {cashbackPct}% Cashback
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-white/90 group-hover:gap-1.5 transition-all">
                Open wallet <ArrowUpRight size={15} />
              </span>
            </div>
          </div>
        </Link>
        ) : null}

        <div className="grid sm:grid-cols-2 gap-3">
          <Link
            href="/account/orders"
            className="group text-left rounded-xl border border-[#E8E1D6] bg-[#FAF8F4] p-4 hover:border-[#C9B896] hover:bg-white transition"
          >
            <span className="h-9 w-9 rounded-lg bg-white border border-[#EDE8DF] grid place-items-center text-[#3F342C] mb-3">
              <PackageSearch size={17} strokeWidth={1.75} />
            </span>
            <p className="font-semibold text-[#1C1410]">Orders</p>
            <p className="text-[13px] text-[#7A6E62] mt-0.5 leading-snug">
              Check status, invoices and delivery updates
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-[#8A6A12] group-hover:gap-1.5 transition-all">
              Open <ArrowUpRight size={14} />
            </span>
          </Link>

          {walletOn ? (
          <Link
            href="/account/wallet"
            className="group text-left rounded-xl border border-[var(--bhagva)]/55 bg-[var(--bhagva-soft)] p-4 hover:border-[var(--bhagva-deep)] hover:bg-[#FFE8D1] transition"
          >
            <span className="h-9 w-9 rounded-lg bg-[var(--bhagva)]/50 border border-[var(--bhagva)]/40 grid place-items-center text-[#5C4810] mb-3">
              <Wallet size={17} strokeWidth={1.75} />
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-[#1C1410]">Wallet</p>
              {cashbackEarnOn ? (
                <span className="rounded-full bg-[var(--bhagva)] text-white px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide">
                  {cashbackPct}% Cashback
                </span>
              ) : null}
            </div>
            <p className="text-[13px] text-[#5C4810] mt-1 font-bold tabular-nums">
              {wallet ? formatINR(balance) : "…"}
              <span className="font-normal text-[#7A6E62]"> balance</span>
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-[#8A6A12] group-hover:gap-1.5 transition-all">
              Open <ArrowUpRight size={14} />
            </span>
          </Link>
          ) : null}

          <Link
            href="/account/addresses"
            className="group text-left rounded-xl border border-[#E8E1D6] bg-[#FAF8F4] p-4 hover:border-[#C9B896] hover:bg-white transition sm:col-span-2"
          >
            <span className="h-9 w-9 rounded-lg bg-white border border-[#EDE8DF] grid place-items-center text-[#1F6B45] mb-3">
              <MapPinned size={17} strokeWidth={1.75} />
            </span>
            <p className="font-semibold text-[#1C1410]">Addresses</p>
            <p className="text-[13px] text-[#7A6E62] mt-0.5 leading-snug">
              {addresses.length
                ? `${addresses.length} saved · edit anytime`
                : "Add a delivery address for faster checkout"}
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-[#8A6A12] group-hover:gap-1.5 transition-all">
              Open <ArrowUpRight size={14} />
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
