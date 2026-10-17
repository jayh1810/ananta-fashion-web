"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Menu,
  Search,
  ShoppingBag,
  X,
  ChevronDown,
  ChevronRight,
  CircleUserRound,
  Heart,
  LogOut,
  Package,
  Wallet,
  History,
} from "lucide-react";
import {
  DEFAULT_TRENDING,
  addRecentSearch,
  clearRecentSearches,
  fetchServerHistory,
  fetchTrendingSearches,
  mergeRecent,
  readRecentSearches,
  removeRecentSearch,
  type TrendingSearch,
} from "@/lib/search-history";
import { api, formatINR, navLinks } from "@/lib/api";
import { WALLET_REFRESH_EVENT } from "@/lib/wallet-refresh";
import { useCart } from "@/lib/cart";
import { useStoreOffer } from "@/components/StoreOfferProvider";
import { useWishlist } from "@/lib/wishlist";
import { useCustomerAuth } from "@/lib/customer-auth";
import { useHydrated } from "@/lib/useHydrated";
import { useSiteBranding } from "@/lib/site-branding";
import { buildMenuTree, type ApiMenuRow, type MenuNode } from "@/lib/menu-tree";
import { SiteLogoImage } from "@/components/SiteLogoImage";
import { isUsableImageSrc } from "@/lib/is-usable-image-src";
import { BrandsMegaMenu } from "@/components/BrandsMegaMenu";

type SuggestProduct = {
  id: string;
  title: string;
  slug: string;
  image?: string;
  price?: number;
  isFreeProduct?: boolean;
};

type SuggestResponse = {
  query?: string;
  products?: SuggestProduct[];
  terms?: string[];
  matchType?: string;
  relatedFallback?: boolean;
};

function walletCacheKey(userId: string) {
  return `ananta-wallet:${userId}`;
}

function readCachedWallet(userId?: string | null): number | null {
  if (typeof window === "undefined" || !userId) return null;
  try {
    const raw = localStorage.getItem(walletCacheKey(userId));
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

function writeCachedWallet(userId: string, balance: number) {
  try {
    localStorage.setItem(walletCacheKey(userId), String(balance));
  } catch {
    /* ignore */
  }
}

function useHeaderLinks(initial?: MenuNode[]): MenuNode[] {
  const hasServerLinks = Boolean(initial?.length);
  const [links, setLinks] = useState<MenuNode[]>(
    initial?.length ? initial : navLinks,
  );

  useEffect(() => {
    if (initial?.length) setLinks(initial);
  }, [initial]);

  useEffect(() => {
    if (hasServerLinks) return;
    let cancelled = false;

    async function load() {
      try {
        const data = await api<ApiMenuRow[]>("/content/menus");
        if (cancelled) return;
        const header = Array.isArray(data) ? buildMenuTree(data, "HEADER") : [];
        setLinks(header.length ? header : navLinks);
      } catch {
        if (!cancelled) setLinks(navLinks);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [hasServerLinks]);

  return links;
}

/** Full-width dropdown: second-level items are column headings, third-level their links. */
function MegaMenuPanel({
  node,
  onNavigate,
}: {
  node: MenuNode;
  onNavigate: () => void;
}) {
  const columns = node.children || [];
  const grouped = columns.some((c) => c.children?.length);
  const promoImage = isUsableImageSrc(node.imageUrl) ? node.imageUrl! : "";
  const stacks: MenuNode[][] = grouped
    ? megaColumns(columns)
    : chunk(columns, MEGA_FLAT_COLUMN_SIZE).map((links) => [
        { ...node, children: links },
      ]);
  const headingClass =
    "block text-[14px] font-semibold leading-[22px] text-ink hover:text-brand";
  const linkClass =
    "block text-[14px] leading-[22px] text-muted transition-colors hover:text-brand";
  return (
    <div className="absolute inset-x-0 top-full z-50 border-t border-line bg-white shadow-[var(--shadow-pop)]">
      <div className="mx-auto flex max-w-[1440px] items-stretch gap-6 px-6">
        <div className="flex min-w-0 max-w-full overflow-x-auto scrollbar-hide">
          {stacks.map((stack, i) => (
            <div
              key={i}
              className={`w-[172px] shrink-0 space-y-5 px-4 pb-6 pt-4 ${
                i % 2 === 1 ? "bg-[#F5F5F6]" : ""
              }`}
            >
              {stack.map((col, j) => (
                <div key={col.href + col.label + j}>
                  {grouped ? (
                    <Link href={col.href} onClick={onNavigate} className={headingClass}>
                      {col.label}
                    </Link>
                  ) : i === 0 ? (
                    <Link href={node.href} onClick={onNavigate} className={headingClass}>
                      {node.label}
                    </Link>
                  ) : null}
                  <ul>
                    {(col.children || []).map((leaf) => (
                      <li key={leaf.href + leaf.label}>
                        <Link href={leaf.href} onClick={onNavigate} className={linkClass}>
                          {leaf.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {i === 0 ? (
                <Link
                  href={node.href}
                  onClick={onNavigate}
                  className={`${headingClass} inline-flex items-center gap-0.5`}
                >
                  Shop all {node.label}
                  <ChevronRight size={14} aria-hidden />
                </Link>
              ) : null}
            </div>
          ))}
        </div>
        {promoImage ? (
          <Link
            href={node.href}
            onClick={onNavigate}
            className="group relative my-4 hidden aspect-[9/10] w-[330px] shrink-0 self-start overflow-hidden bg-surface-alt lg:block"
          >
            <Image
              src={promoImage}
              alt={node.label}
              fill
              sizes="330px"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-5 pb-5 pt-20 text-center text-white">
              <span className="block font-heading text-[26px] font-bold uppercase leading-tight tracking-wide">
                {node.label}
              </span>
              <span className="mt-1 block text-[13px] opacity-90">
                Explore the full {node.label.toLowerCase()} range
              </span>
              <span className="mt-2 inline-block text-[15px] font-semibold underline underline-offset-4">
                Shop Now
              </span>
            </span>
          </Link>
        ) : null}
      </div>
    </div>
  );
}

const MEGA_FLAT_COLUMN_SIZE = 10;

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Headings with an admin column stack in that column; the rest flow one per column. */
function megaColumns(columns: MenuNode[]): MenuNode[][] {
  if (!columns.some((c) => c.column)) return columns.map((c) => [c]);
  const fixed = new Map<number, MenuNode[]>();
  const auto: MenuNode[] = [];
  for (const c of columns) {
    if (c.column) fixed.set(c.column, [...(fixed.get(c.column) || []), c]);
    else auto.push(c);
  }
  return [
    ...[...fixed.entries()].sort((a, b) => a[0] - b[0]).map(([, stack]) => stack),
    ...auto.map((c) => [c]),
  ];
}

/** Mobile drawer row: tap label to navigate, chevron to expand children. */
function MobileMenuItem({
  node,
  depth,
  onNavigate,
}: {
  node: MenuNode;
  depth: number;
  onNavigate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const hasKids = Boolean(node.children?.length);
  return (
    <li className={depth === 0 ? "border-b border-line" : ""}>
      <div className="flex items-center">
        <Link
          href={node.href}
          onClick={onNavigate}
          className={`min-w-0 flex-1 truncate py-3 ${
            depth === 0
              ? "px-4 text-[15px] font-semibold text-ink"
              : depth === 1
                ? "pl-7 pr-2 text-[14px] font-medium text-text"
                : "pl-10 pr-2 text-[13px] text-muted"
          }`}
        >
          {node.label}
        </Link>
        {hasKids ? (
          <button
            type="button"
            aria-label={`${open ? "Collapse" : "Expand"} ${node.label}`}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="grid h-11 w-11 shrink-0 place-items-center text-muted"
          >
            <ChevronDown
              size={18}
              className={`transition-transform ${open ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>
        ) : null}
      </div>
      {hasKids && open ? (
        <ul className="pb-1">
          {node.children!.map((c) => (
            <MobileMenuItem
              key={c.href + c.label}
              node={c}
              depth={depth + 1}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function Header({ initialLinks }: { initialLinks?: MenuNode[] }) {
  const router = useRouter();
  const headerLinks = useHeaderLinks(initialLinks);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestProducts, setSuggestProducts] = useState<SuggestProduct[]>([]);
  const [suggestTerms, setSuggestTerms] = useState<string[]>([]);
  const [suggestRelated, setSuggestRelated] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [trendingSearches, setTrendingSearches] = useState<TrendingSearch[]>([]);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const siteName = useSiteBranding((s) => s.siteName);
  const logoUrl = useSiteBranding((s) => s.logoUrl);
  const brandingLoaded = useSiteBranding((s) => s.loaded);
  const ensureLoaded = useSiteBranding((s) => s.ensureLoaded);
  const { openCart, count } = useCart();
  const wishlistCount = useWishlist((s) => s.items.length);
  const { user, token, logout, openLogin } = useCustomerAuth();
  const walletEnabled = useStoreOffer().walletEnabled;
  const hydrated = useHydrated();
  const cartCount = hydrated ? count() : 0;
  const savedCount = hydrated ? wishlistCount : 0;
  const loggedIn = hydrated && !!token && !!user;
  const requestLogin = (next?: string) => {
    openLogin(next);
  };

  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const showLogo = Boolean(logoUrl) && !logoFailed;
  const showAaFallback = brandingLoaded && (!logoUrl || logoFailed);
  const accountRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const menuCloseTimer = useRef<number | null>(null);

  useEffect(() => {
    void ensureLoaded();
  }, [ensureLoaded]);

  useEffect(() => {
    setLogoFailed(false);
  }, [logoUrl]);

  const refreshWallet = useCallback(() => {
    if (!walletEnabled || !loggedIn || !token || !user?.id) {
      setWalletBalance(null);
      setWalletLoading(false);
      return;
    }

    const cached = readCachedWallet(user.id);
    if (cached != null) setWalletBalance(cached);

    setWalletLoading(true);
    api<{ balance?: number }>("/wallet", { token })
      .then((w) => {
        const bal = Math.max(0, Number(w?.balance) || 0);
        setWalletBalance(bal);
        writeCachedWallet(user.id, bal);
      })
      .catch(() => {
        /* keep cached balance if we have one */
      })
      .finally(() => {
        setWalletLoading(false);
      });
  }, [walletEnabled, loggedIn, token, user?.id]);

  useEffect(() => {
    refreshWallet();
    function onRefresh() {
      refreshWallet();
    }
    window.addEventListener(WALLET_REFRESH_EVENT, onRefresh);
    window.addEventListener("focus", onRefresh);
    return () => {
      window.removeEventListener(WALLET_REFRESH_EVENT, onRefresh);
      window.removeEventListener("focus", onRefresh);
    };
  }, [refreshWallet]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!accountRef.current?.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (!searchOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSearchOpen(false);
        searchInputRef.current?.blur();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) {
      setSuggestProducts([]);
      setSuggestTerms([]);
      setSuggestRelated(false);
      setSuggestLoading(false);
      return;
    }

    const q = searchQuery.trim();
    let cancelled = false;
    const handle = window.setTimeout(() => {
      setSuggestLoading(true);
      api<SuggestResponse>(
        `/products/suggest?q=${encodeURIComponent(q)}&limit=6`,
      )
        .then((res) => {
          if (cancelled) return;
          setSuggestProducts(Array.isArray(res.products) ? res.products : []);
          setSuggestTerms(Array.isArray(res.terms) ? res.terms : []);
          setSuggestRelated(!!res.relatedFallback);
        })
        .catch(() => {
          if (cancelled) return;
          setSuggestProducts([]);
          setSuggestTerms([]);
          setSuggestRelated(false);
        })
        .finally(() => {
          if (!cancelled) setSuggestLoading(false);
        });
    }, q ? 220 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [searchOpen, searchQuery]);

  // Recent (device + account) and trending searches for the empty search panel.
  useEffect(() => {
    if (!searchOpen) return;
    let cancelled = false;
    const showLocal = window.setTimeout(
      () => setRecentSearches(readRecentSearches()),
      0,
    );
    void fetchTrendingSearches().then((items) => {
      if (!cancelled) setTrendingSearches(items);
    });
    if (token) {
      void fetchServerHistory(token).then((server) => {
        if (!cancelled && server.length) {
          setRecentSearches(mergeRecent(readRecentSearches(), server));
        }
      });
    }
    return () => {
      cancelled = true;
      window.clearTimeout(showLocal);
    };
  }, [searchOpen, token]);

  function closeSearch() {
    setSearchOpen(false);
    setSearchQuery("");
    setSuggestProducts([]);
    setSuggestTerms([]);
    setSuggestRelated(false);
    searchInputRef.current?.blur();
  }

  function submitSearch(e: FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) addRecentSearch(q);
    closeSearch();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  }

  function removeRecent(term: string) {
    removeRecentSearch(term, token);
    setRecentSearches((prev) =>
      prev.filter((s) => s.toLowerCase() !== term.toLowerCase()),
    );
  }

  function clearRecent() {
    clearRecentSearches(token);
    setRecentSearches([]);
  }

  function goSuggestProduct(slug: string) {
    closeSearch();
    router.push(`/products/${slug}`);
  }

  function prefetchSuggestProduct(slug: string) {
    if (!slug) return;
    try {
      router.prefetch(`/products/${slug}`);
    } catch {
      /* ignore */
    }
  }

  function goSuggestTerm(term: string) {
    addRecentSearch(term);
    closeSearch();
    router.push(`/search?q=${encodeURIComponent(term)}`);
  }

  function openMega(label: string) {
    if (menuCloseTimer.current) window.clearTimeout(menuCloseTimer.current);
    setOpenMenu(label);
  }

  function scheduleMegaClose() {
    if (menuCloseTimer.current) window.clearTimeout(menuCloseTimer.current);
    menuCloseTimer.current = window.setTimeout(() => setOpenMenu(null), 120);
  }

  const shownWalletBalance =
    walletBalance ?? (loggedIn ? readCachedWallet(user?.id) : null);
  const walletAmountLabel =
    shownWalletBalance != null
      ? formatINR(shownWalletBalance)
      : walletLoading
        ? "…"
        : "₹0";
  const walletChipClass =
    "group hidden sm:inline-flex h-9 items-center gap-1.5 rounded-full border border-brand/30 bg-brand-soft px-2.5 text-brand-hover transition-colors hover:border-brand";
  const iconBtnClass =
    "relative grid h-10 w-10 place-items-center rounded-full text-ink transition-colors hover:bg-surface";
  const countBadgeClass =
    "absolute -top-0.5 -right-0.5 grid min-w-[18px] h-[18px] place-items-center rounded-full bg-brand px-1 text-[10px] font-bold leading-none text-white";

  const logoMark = showLogo ? (
    <SiteLogoImage
      src={logoUrl!}
      size={40}
      priority
      className="h-9 w-9 shrink-0 rounded-full object-cover bg-brand/20"
      onFailed={() => setLogoFailed(true)}
    />
  ) : showAaFallback ? (
    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-white font-bold text-sm">
      AF
    </span>
  ) : (
    <span className="inline-flex h-9 w-9 shrink-0 rounded-full bg-brand/30" aria-hidden />
  );
  const megaNode = headerLinks.find(
    (l) => l.label === openMenu && l.children?.length,
  );

  return (
    <header
      className="sticky top-0 z-50 bg-white shadow-[0_1px_0_var(--border)]"
      data-store-chrome="header"
      onMouseLeave={scheduleMegaClose}
    >
      <div className="relative z-[60] bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-2 gap-y-2 px-3 py-2 sm:px-4 lg:flex-nowrap lg:gap-x-6 lg:px-6 lg:py-3">
          <button
            className="lg:hidden -ml-1 grid h-10 w-10 place-items-center"
            aria-label="Menu"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={22} />
          </button>

          <Link href="/" className="flex min-w-0 flex-1 items-center gap-2 lg:flex-none">
            {logoMark}
            <span className="truncate font-heading text-lg font-extrabold italic tracking-tight text-brand sm:text-[22px]">
              {siteName}
            </span>
          </Link>

          <nav aria-label="Primary" className="hidden items-center lg:flex">
            <BrandsMegaMenu />
            <Link
              href="/collections/new-arrivals"
              className="inline-flex h-10 items-center px-2 text-[15px] font-medium text-ink transition-colors hover:text-brand"
            >
              New Arrivals
            </Link>
            <Link
              href="/blogs"
              className="inline-flex h-10 items-center px-2 text-[15px] font-medium text-ink transition-colors hover:text-brand"
            >
              Beauty Advice
            </Link>
          </nav>

          <form
            role="search"
            onSubmit={submitSearch}
            className="order-last w-full lg:order-none lg:w-auto lg:max-w-xl lg:flex-1"
          >
            <label className="relative flex items-center">
              <Search
                size={18}
                strokeWidth={2}
                className="pointer-events-none absolute left-3 text-muted"
                aria-hidden
              />
              <input
                ref={searchInputRef}
                name="q"
                type="search"
                value={searchQuery}
                onFocus={() => setSearchOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (!searchOpen) setSearchOpen(true);
                }}
                placeholder="Search for products, brands and more"
                aria-label="Search products"
                className="h-10 w-full rounded-[var(--radius-md)] border border-transparent bg-surface pl-10 pr-10 text-[14px] text-ink outline-none transition-colors placeholder:text-subtle focus:border-brand focus:bg-white"
                autoComplete="off"
                enterKeyHint="search"
              />
              {searchOpen ? (
                <button
                  type="button"
                  aria-label="Close search"
                  className="absolute right-2 grid h-7 w-7 place-items-center rounded-full text-muted hover:bg-line"
                  onClick={closeSearch}
                >
                  <X size={15} strokeWidth={2.25} />
                </button>
              ) : null}
            </label>
          </form>

          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            <div className="relative" ref={accountRef}>
              {loggedIn ? (
                <>
                  <button
                    type="button"
                    className={iconBtnClass}
                    aria-label="Account"
                    aria-expanded={accountOpen}
                    onClick={() => setAccountOpen((v) => !v)}
                  >
                    <CircleUserRound size={22} strokeWidth={1.75} />
                  </button>
                  {accountOpen && (
                    <div className="absolute right-0 top-full z-50 mt-1 w-60 rounded-[var(--radius-md)] border border-line bg-white py-2 shadow-[var(--shadow-pop)]">
                      <div className="border-b border-line px-4 py-2">
                        <p className="truncate text-sm font-semibold text-ink">
                          Hi, {user?.name || "there"}
                        </p>
                        <p className="text-[11px] text-muted">+91 {user?.phone}</p>
                      </div>
                      <Link
                        href="/account/orders"
                        onClick={() => setAccountOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-text hover:bg-surface-alt"
                      >
                        <Package size={16} strokeWidth={1.75} /> My orders
                      </Link>
                      <Link
                        href="/wishlist"
                        onClick={() => setAccountOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-text hover:bg-surface-alt"
                      >
                        <Heart size={16} strokeWidth={1.75} /> Wishlist
                      </Link>
                      {walletEnabled ? (
                        <Link
                          href="/account/wallet"
                          onClick={() => setAccountOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-text hover:bg-surface-alt"
                        >
                          <Wallet size={16} strokeWidth={1.75} /> Wallet
                          {shownWalletBalance != null && (
                            <span className="ml-auto text-[12px] font-bold text-brand-hover">
                              {formatINR(shownWalletBalance)}
                            </span>
                          )}
                        </Link>
                      ) : null}
                      <Link
                        href="/account"
                        onClick={() => setAccountOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-text hover:bg-surface-alt"
                      >
                        <CircleUserRound size={16} strokeWidth={1.75} /> Account
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          logout();
                          setAccountOpen(false);
                        }}
                        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-text hover:bg-surface-alt"
                      >
                        <LogOut size={16} strokeWidth={1.75} /> Logout
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="hidden h-10 items-center gap-1.5 rounded-[var(--radius-md)] bg-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-hover lg:inline-flex"
                    aria-label="Login"
                    onClick={() => requestLogin("/")}
                  >
                    <CircleUserRound size={18} strokeWidth={2} aria-hidden />
                    Sign in
                  </button>
                  <button
                    type="button"
                    className={`${iconBtnClass} lg:hidden`}
                    aria-label="Sign in"
                    onClick={() => requestLogin("/")}
                  >
                    <CircleUserRound size={22} strokeWidth={1.75} />
                  </button>
                </>
              )}
            </div>

            {walletEnabled ? (
              loggedIn ? (
                <Link
                  href="/account/wallet"
                  className={walletChipClass}
                  aria-label={`Wallet balance ${walletAmountLabel}`}
                  title="Wallet"
                >
                  <Wallet size={14} strokeWidth={2.25} aria-hidden />
                  <span className="text-[12px] font-bold tabular-nums leading-none">
                    {walletAmountLabel}
                  </span>
                </Link>
              ) : (
                <button
                  type="button"
                  className={walletChipClass}
                  aria-label="Wallet"
                  title="Login to see your wallet"
                  onClick={() => requestLogin("/account/wallet")}
                >
                  <Wallet size={14} strokeWidth={2.25} aria-hidden />
                  <span className="text-[12px] font-bold leading-none">Wallet</span>
                </button>
              )
            ) : null}

            <Link href="/wishlist" className={iconBtnClass} aria-label="Wishlist">
              <Heart size={21} strokeWidth={1.75} />
              {savedCount > 0 ? (
                <span className={countBadgeClass}>{savedCount > 99 ? "99+" : savedCount}</span>
              ) : null}
            </Link>

            <button
              type="button"
              className={iconBtnClass}
              aria-label="Cart"
              onClick={openCart}
            >
              <ShoppingBag size={21} strokeWidth={1.75} />
              {cartCount > 0 ? (
                <span className={countBadgeClass}>{cartCount > 99 ? "99+" : cartCount}</span>
              ) : null}
            </button>
          </div>
        </div>

        <nav
          aria-label="Shop by category"
          className="hidden border-t border-line lg:block"
        >
          <ul className="mx-auto flex max-w-[1440px] items-center gap-1 overflow-x-auto px-4 scrollbar-hide">
            {headerLinks.map((link) => {
              const hasKids = Boolean(link.children?.length);
              const isOpen = openMenu === link.label && hasKids;
              return (
                <li
                  key={link.href + link.label}
                  onMouseEnter={() => (hasKids ? openMega(link.label) : setOpenMenu(null))}
                >
                  <Link
                    href={link.href}
                    target={link.openInNewTab ? "_blank" : undefined}
                    onFocus={() => (hasKids ? openMega(link.label) : setOpenMenu(null))}
                    onClick={() => setOpenMenu(null)}
                    aria-expanded={hasKids ? isOpen : undefined}
                    className={`inline-flex h-11 items-center whitespace-nowrap border-b-2 px-3 text-[14px] font-medium transition-colors ${
                      isOpen
                        ? "border-brand text-brand"
                        : "border-transparent text-[rgba(3,2,26,0.75)] hover:text-brand"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        {megaNode ? (
          <div onMouseEnter={() => openMega(megaNode.label)}>
            <MegaMenuPanel node={megaNode} onNavigate={() => setOpenMenu(null)} />
          </div>
        ) : null}
      </div>

      {searchOpen && (
        <>
          <button
            type="button"
            aria-label="Close search"
            className="fixed inset-0 z-[45] bg-black/35"
            onClick={closeSearch}
          />
          <div className="absolute inset-x-0 top-full z-[55] border-t border-line bg-white shadow-[var(--shadow-pop)]">
            <div className="mx-auto max-h-[70vh] max-w-3xl overflow-y-auto px-3 py-4 sm:px-5">
              {searchQuery.trim() ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-subtle">
                    {suggestRelated ? "Similar" : "Suggestions"}
                  </span>
                  {(suggestTerms.length
                    ? suggestTerms
                    : DEFAULT_TRENDING.map((t) => t.label)
                  )
                    .slice(0, 6)
                    .map((label) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => goSuggestTerm(label)}
                        className="rounded-full border border-line bg-white px-2.5 py-1 text-[12px] font-medium text-text transition-colors hover:border-brand hover:text-brand"
                      >
                        {label}
                      </button>
                    ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {recentSearches.length > 0 ? (
                    <div>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted">
                          <History size={13} aria-hidden /> Recent searches
                        </p>
                        <button
                          type="button"
                          onClick={clearRecent}
                          className="text-[12px] font-semibold text-brand hover:underline"
                        >
                          Clear all
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {recentSearches.map((term) => (
                          <span
                            key={term}
                            className="inline-flex max-w-full items-center rounded-full border border-line bg-white text-[13px] text-text transition-colors hover:border-line-strong"
                          >
                            <button
                              type="button"
                              onClick={() => goSuggestTerm(term)}
                              className="min-w-0 truncate py-1.5 pl-3.5 pr-1.5 font-medium"
                            >
                              {term}
                            </button>
                            <button
                              type="button"
                              aria-label={`Remove ${term} from recent searches`}
                              onClick={() => removeRecent(term)}
                              className="mr-1 grid h-6 w-6 shrink-0 place-items-center rounded-full text-subtle hover:bg-surface hover:text-ink"
                            >
                              <X size={12} strokeWidth={2.25} />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div>
                    <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted">
                      Trending searches
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(trendingSearches.length
                        ? trendingSearches
                        : DEFAULT_TRENDING
                      )
                        .slice(0, 12)
                        .map((t) => (
                          <button
                            key={`${t.label}-${t.query}`}
                            type="button"
                            onClick={() => goSuggestTerm(t.query || t.label)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-1.5 text-[13px] font-medium text-text transition-colors hover:border-brand hover:text-brand"
                          >
                            <Search size={13} className="text-subtle" aria-hidden />
                            {t.label}
                          </button>
                        ))}
                    </div>
                  </div>
                </div>
              )}

              {(suggestLoading || suggestProducts.length > 0) && (
                <div className="mt-4 border-t border-line pt-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-subtle">
                      {suggestRelated ? "Related products" : "Products"}
                    </p>
                    {suggestLoading ? (
                      <span className="text-[11px] text-subtle">Searching…</span>
                    ) : null}
                  </div>
                  {suggestProducts.length > 0 ? (
                    <ul className="grid gap-1 sm:grid-cols-2">
                      {suggestProducts.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => goSuggestProduct(p.slug)}
                            onMouseEnter={() => prefetchSuggestProduct(p.slug)}
                            onFocus={() => prefetchSuggestProduct(p.slug)}
                            className="flex w-full items-center gap-3 rounded-[var(--radius-md)] px-2 py-2 text-left transition-colors hover:bg-surface-alt"
                          >
                            <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-surface">
                              {p.image ? (
                                <Image
                                  src={p.image}
                                  alt=""
                                  fill
                                  sizes="44px"
                                  className="object-cover"
                                />
                              ) : null}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="line-clamp-1 text-[13px] font-medium text-ink">
                                {p.title}
                              </span>
                              <span className="mt-0.5 block text-[12px] text-muted">
                                {p.isFreeProduct
                                  ? "Free"
                                  : typeof p.price === "number"
                                    ? formatINR(p.price)
                                    : ""}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : !suggestLoading && searchQuery.trim() ? (
                    <p className="px-1 text-[13px] text-muted">
                      No direct matches — press Enter for similar products.
                    </p>
                  ) : null}
                  {searchQuery.trim() ? (
                    <button
                      type="button"
                      onClick={() => {
                        const q = searchQuery.trim();
                        addRecentSearch(q);
                        closeSearch();
                        router.push(`/search?q=${encodeURIComponent(q)}`);
                      }}
                      className="mt-2 w-full rounded-[var(--radius-md)] border border-line py-2 text-[13px] font-semibold text-ink transition-colors hover:border-brand hover:text-brand"
                    >
                      View all results for “{searchQuery.trim()}”
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {mobileOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute bottom-0 left-0 top-0 flex w-[min(86vw,22rem)] max-w-sm flex-col bg-white shadow-xl pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
            <div className="flex shrink-0 items-center justify-between gap-3 bg-brand px-4 py-3.5 text-white">
              {loggedIn ? (
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold">Hi, {user?.name || "there"}</p>
                  <p className="text-xs text-white/80">+91 {user?.phone}</p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    requestLogin("/");
                  }}
                  className="flex items-center gap-2 text-[15px] font-semibold"
                >
                  <CircleUserRound size={22} aria-hidden /> Sign in / Register
                </button>
              )}
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-white/15"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain">
              <p className="px-4 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-subtle">
                Shop by category
              </p>
              <ul>
                {headerLinks.map((link) => (
                  <MobileMenuItem
                    key={link.href + link.label}
                    node={link}
                    depth={0}
                    onNavigate={() => setMobileOpen(false)}
                  />
                ))}
              </ul>
              <ul className="mt-2 border-t-8 border-surface py-2">
                {loggedIn ? (
                  <>
                    <li>
                      <Link
                        href="/account/orders"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-[14px] text-text"
                      >
                        <Package size={18} strokeWidth={1.75} /> My orders
                      </Link>
                    </li>
                    {walletEnabled ? (
                      <li>
                        <Link
                          href="/account/wallet"
                          onClick={() => setMobileOpen(false)}
                          className="flex items-center gap-3 px-4 py-3 text-[14px] text-text"
                        >
                          <Wallet size={18} strokeWidth={1.75} /> Wallet
                          <span className="ml-auto text-[13px] font-semibold tabular-nums text-brand-hover">
                            {walletAmountLabel}
                          </span>
                        </Link>
                      </li>
                    ) : null}
                  </>
                ) : null}
                <li>
                  <Link
                    href="/wishlist"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-[14px] text-text"
                  >
                    <Heart size={18} strokeWidth={1.75} /> Wishlist
                    {savedCount > 0 ? (
                      <span className="ml-auto text-[13px] font-semibold text-brand">{savedCount}</span>
                    ) : null}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/pages/track-order"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-[14px] text-text"
                  >
                    <Package size={18} strokeWidth={1.75} /> Track order
                  </Link>
                </li>
                {loggedIn ? (
                  <li>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-[14px] text-text"
                      onClick={() => {
                        logout();
                        setMobileOpen(false);
                      }}
                    >
                      <LogOut size={18} strokeWidth={1.75} /> Log out
                    </button>
                  </li>
                ) : null}
              </ul>
            </div>
          </aside>
        </div>
      )}
    </header>
  );
}
