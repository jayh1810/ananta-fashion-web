"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  Home,
  LifeBuoy,
  LogOut,
  MapPinned,
  PackageSearch,
  ShoppingBag,
  UserRound,
  Wallet,
} from "lucide-react";
import { useCustomerAuth } from "@/lib/customer-auth";
import { useHydrated } from "@/lib/useHydrated";
import { useSiteBranding } from "@/lib/site-branding";
import { useCart } from "@/lib/cart";
import { useStoreOffer } from "@/components/StoreOfferProvider";

const NAV = [
  {
    href: "/account",
    label: "Overview",
    shortLabel: "Home",
    icon: UserRound,
    match: (path: string) => path === "/account",
  },
  {
    href: "/account/orders",
    label: "Orders",
    shortLabel: "Orders",
    icon: PackageSearch,
    match: (path: string) => path.startsWith("/account/orders"),
  },
  {
    href: "/account/tickets",
    label: "Support Tickets",
    shortLabel: "Tickets",
    icon: LifeBuoy,
    match: (path: string) => path.startsWith("/account/tickets"),
  },
  {
    href: "/account/wallet",
    label: "Wallet",
    shortLabel: "Wallet",
    icon: Wallet,
    match: (path: string) => path.startsWith("/account/wallet"),
  },
  {
    href: "/account/addresses",
    label: "Addresses",
    shortLabel: "Address",
    icon: MapPinned,
    match: (path: string) => path.startsWith("/account/addresses"),
  },
  {
    href: "/cart",
    label: "Cart",
    shortLabel: "Cart",
    icon: ShoppingBag,
    match: (path: string) => path === "/cart" || path.startsWith("/cart/"),
  },
] as const;

type Props = {
  children: React.ReactNode;
  /** Require login (account pages). Cart can stay public. */
  requireAuth?: boolean;
};

export function AccountShell({ children, requireAuth = true }: Props) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const hydrated = useHydrated();
  const { token, user, logout, refreshMe } = useCustomerAuth();
  const siteName = useSiteBranding((s) => s.siteName);
  const ensureLoaded = useSiteBranding((s) => s.ensureLoaded);
  const cartCount = useCart((s) => s.count());
  const walletEnabled = useStoreOffer().walletEnabled;
  const safeCartCount = hydrated ? cartCount : 0;
  const safeUser = hydrated ? user : null;
  const safeToken = hydrated ? token : null;

  useEffect(() => {
    void ensureLoaded();
  }, [ensureLoaded]);

  useEffect(() => {
    if (!hydrated || !requireAuth) return;
    if (!token) {
      const next = pathname.startsWith("/") ? pathname : "/account";
      router.replace(`/account/login?next=${encodeURIComponent(next)}`);
      return;
    }
    void refreshMe();
  }, [hydrated, token, requireAuth, router, pathname, refreshMe]);

  if (requireAuth && (!hydrated || !token)) {
    return (
      <div className="min-h-[50vh] bg-[#F4F1EA] grid place-items-center text-sm text-[#6B5E52] px-4">
        Loading your account…
      </div>
    );
  }

  const addresses = safeUser?.addresses || [];
  const defaultAddress =
    addresses.find((a) => a.isDefault) || addresses[0] || null;
  const displayName = defaultAddress?.name || safeUser?.name || null;
  const displayPhone = safeUser?.phone || null;
  const firstName = displayName?.trim().split(/\s+/)[0] || null;
  const firstLetter = (displayName || displayPhone || "A")
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <div className="min-h-[70vh] bg-[#F4F1EA] overflow-x-hidden">
      <div className="mx-auto box-border w-full max-w-5xl px-4 sm:px-5 py-5 sm:py-8 lg:py-11">
        {/* Header */}
        <div className="mb-4 sm:mb-6 lg:mb-8 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8A7355]">
              My account
            </p>
            <h1 className="mt-1 text-xl sm:text-2xl lg:text-[1.75rem] font-bold text-[#1C1410] tracking-tight leading-snug break-words">
              {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[#6B5E52] leading-relaxed line-clamp-2 sm:line-clamp-none">
              Orders, addresses and cart in one place
              <span className="hidden sm:inline"> at {siteName}</span>.
            </p>
          </div>
          {safeToken && (
            <button
              type="button"
              onClick={() => {
                logout();
                router.push("/");
              }}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-[#DDD5C8] bg-white px-2.5 sm:px-3.5 py-2 sm:py-2.5 text-sm font-semibold text-[#3F342C] shadow-[0_1px_2px_rgba(28,20,16,0.04)] hover:bg-[#FAF8F4] transition"
              aria-label="Log out"
            >
              <LogOut size={15} strokeWidth={1.75} />
              <span className="hidden sm:inline">Log out</span>
            </button>
          )}
        </div>

        <div className="grid w-full lg:grid-cols-[220px_minmax(0,1fr)] gap-3 sm:gap-4 lg:gap-5 items-start">
          {/* Sidebar / mobile tab bar */}
          <aside className="w-full min-w-0 rounded-2xl border border-[#E8E1D6] bg-white p-1.5 sm:p-2 shadow-[0_1px_2px_rgba(28,20,16,0.04),0_8px_24px_rgba(28,20,16,0.04)] lg:sticky lg:top-24">
            <div className="hidden lg:flex items-center gap-3 px-2.5 py-3 mb-1 border-b border-[#F0EBE3]">
              <div className="h-10 w-10 rounded-xl bg-[var(--bhagva)] text-[#1a1208] font-bold text-lg grid place-items-center shrink-0">
                {firstLetter}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#1C1410] truncate">
                  {displayName || "Guest"}
                </p>
                {displayPhone ? (
                  <p className="text-[11px] text-[#8A7355] truncate">
                    +91 {displayPhone}
                  </p>
                ) : (
                  <p className="text-[11px] text-[#8A7355]">Browse & shop</p>
                )}
              </div>
            </div>

            <nav
              className="grid grid-cols-4 sm:grid-cols-7 gap-0.5 w-full lg:flex lg:flex-col lg:gap-1"
              aria-label="Account sections"
            >
              {NAV.filter((item) => walletEnabled || item.href !== "/account/wallet").map(({ href, label, shortLabel, icon: Icon, match }) => {
                const active = match(pathname);
                const badge =
                  href === "/cart" && safeCartCount > 0 ? safeCartCount : null;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`relative min-w-0 flex flex-col lg:flex-row items-center lg:items-center justify-center lg:justify-start gap-0.5 lg:gap-2.5 w-full px-1 sm:px-2 lg:px-3 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs lg:text-sm font-medium transition-colors ${
                      active
                        ? "bg-[rgba(176,137,42,0.14)] text-[#8A6A12]"
                        : "text-[#555] hover:bg-[#F7F3EB]"
                    }`}
                  >
                    <span className="relative shrink-0">
                      <Icon
                        size={18}
                        strokeWidth={1.75}
                        className="lg:w-4 lg:h-4"
                      />
                      {badge != null && (
                        <span className="absolute -top-1.5 -right-2 lg:hidden min-w-[14px] h-[14px] rounded-full bg-[#1C1410] text-white text-[9px] font-bold grid place-items-center px-0.5">
                          {badge > 99 ? "99+" : badge}
                        </span>
                      )}
                    </span>
                    <span className="w-full truncate text-center lg:text-left lg:flex-1">
                      <span className="lg:hidden">{shortLabel}</span>
                      <span className="hidden lg:inline">{label}</span>
                    </span>
                    {badge != null && (
                      <span className="hidden lg:grid min-w-[18px] h-[18px] rounded-full bg-[#1C1410] text-white text-[10px] font-bold place-items-center px-1">
                        {badge > 99 ? "99+" : badge}
                      </span>
                    )}
                  </Link>
                );
              })}

              <div className="hidden lg:block px-3 pt-3 pb-1 w-full col-span-full">
                <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-[#aaa]">
                  Also
                </p>
              </div>
              <Link
                href="/"
                className="hidden lg:flex w-full col-span-full items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-[#555] hover:bg-[#F7F3EB]"
              >
                <Home size={16} strokeWidth={1.75} />
                Continue shopping
              </Link>
            </nav>
          </aside>

          {/* Content panel */}
          <div className="w-full min-w-0 rounded-2xl border border-[#E8E1D6] bg-white overflow-hidden shadow-[0_1px_2px_rgba(28,20,16,0.04),0_8px_24px_rgba(28,20,16,0.04)] min-h-[280px] sm:min-h-[360px] lg:min-h-[420px]">
            <div className="p-4 sm:p-6 lg:p-8 min-w-0 overflow-x-hidden">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
