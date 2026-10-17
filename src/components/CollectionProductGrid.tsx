"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent,
  type ReactNode,
} from "react";
import { ChevronDown, LayoutGrid, List, SlidersHorizontal, X } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import {
  CollectionFilterPanel,
  EMPTY_FILTERS,
  PRICE_BUCKETS,
  activeFilterCount,
  filterQuery,
  filtersFromSearch,
  hasActiveFilters,
  writeFiltersToUrl,
  type CategoryFacetLink,
  type CollectionFilterState,
  type ListingFacets,
} from "@/components/CollectionFilters";
import { getApiUrl, type Product } from "@/lib/api";
import {
  applyFreeProductIdSet,
  fetchFreeProductIdSet,
  mergeLiveCatalogFields,
} from "@/lib/free-product-flags";
import {
  patchCollectionScrollPosition,
  readCollectionScrollCache,
  readCollectionScrollMeta,
  saveCollectionScrollCache,
} from "@/lib/collection-scroll-cache";

const PAGE_SIZE = 24;

export const COLLECTION_SORTS = [
  { id: "featured", label: "Featured" },
  { id: "best-selling", label: "Best selling" },
  { id: "title-ascending", label: "Alphabetically, A-Z" },
  { id: "title-descending", label: "Alphabetically, Z-A" },
  { id: "price-ascending", label: "Price, low to high" },
  { id: "price-descending", label: "Price, high to low" },
  { id: "created-ascending", label: "Date, old to new" },
  { id: "created-descending", label: "Date, new to old" },
] as const;
type CollectionSort = (typeof COLLECTION_SORTS)[number]["id"];

function readUrlSort(): CollectionSort {
  if (typeof window === "undefined") return "featured";
  const raw = new URLSearchParams(window.location.search).get("sort") || "";
  return COLLECTION_SORTS.some((s) => s.id === raw) ? (raw as CollectionSort) : "featured";
}

function readUrlFilters(): CollectionFilterState {
  if (typeof window === "undefined") return EMPTY_FILTERS;
  return filtersFromSearch(window.location.search);
}

/** Keeps sort + filters on refresh / share without a Next navigation (page stays ISR). */
function writeUrlState(sort: CollectionSort, filters: CollectionFilterState) {
  const url = new URL(window.location.href);
  if (sort === "featured") url.searchParams.delete("sort");
  else url.searchParams.set("sort", sort);
  writeFiltersToUrl(url, filters);
  window.history.replaceState(window.history.state, "", url.toString());
}

function withQuery(path: string, query: string) {
  return query ? `${path}${path.includes("?") ? "&" : "?"}${query}` : path;
}

function listingPath(basePath: string, sort: CollectionSort, filters: CollectionFilterState) {
  return withQuery(
    withQuery(basePath, filterQuery(filters)),
    sort === "featured" ? "" : `sort=${sort}`,
  );
}

function listingKey(cacheKey: string, sort: CollectionSort, filters: CollectionFilterState) {
  const fq = filterQuery(filters);
  const key = fq ? `${cacheKey}?${fq}` : cacheKey;
  return sort === "featured" ? key : `${key}::${sort}`;
}

/** "/products?collection=x" → "/products/facets?collection=x" */
function facetsPath(basePath: string) {
  return basePath.replace(/^\/products(?=\?|$)/, "/products/facets");
}

type CollectionView = "grid" | "list";
const VIEW_STORAGE_KEY = "aa_collection_view";
const VIEW_EVENT = "aa:collection-view";
const viewStore = {
  subscribe(cb: () => void) {
    window.addEventListener(VIEW_EVENT, cb);
    window.addEventListener("storage", cb);
    return () => {
      window.removeEventListener(VIEW_EVENT, cb);
      window.removeEventListener("storage", cb);
    };
  },
  get(): CollectionView {
    try {
      return localStorage.getItem(VIEW_STORAGE_KEY) === "list" ? "list" : "grid";
    } catch {
      return "grid";
    }
  },
  set(view: CollectionView) {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, view);
    } catch {
      /* private mode */
    }
    window.dispatchEvent(new Event(VIEW_EVENT));
  },
};
const serverView = (): CollectionView => "grid";

type ProductsResponse = {
  data: Product[];
  meta?: { total: number; page: number; limit: number; pages: number };
};

async function fetchPage(
  basePath: string,
  page: number,
  opts?: { bustCache?: boolean },
): Promise<{ list: Product[]; total: number; pages: number }> {
  const sep = basePath.includes("?") ? "&" : "?";
  const bust = opts?.bustCache ? `&_ts=${Date.now()}` : "";
  const path = `${basePath}${sep}limit=${PAGE_SIZE}&page=${page}${bust}`;
  const res = await fetch(`${getApiUrl()}${path}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to load products (${res.status})`);
  const json = (await res.json().catch(() => ({}))) as ProductsResponse;
  const list = json.data || [];
  const total = json.meta?.total ?? list.length;
  const pages = json.meta?.pages ?? Math.max(1, Math.ceil(total / PAGE_SIZE));
  return { list, total: Math.max(total, list.length), pages };
}

function mergeUnique(prev: Product[], next: Product[]) {
  const seen = new Set(prev.map((p) => p.id));
  const appended = next.filter((p) => !seen.has(p.id));
  return appended.length ? [...prev, ...appended] : prev;
}

function readWindowScrollY() {
  if (typeof window === "undefined") return 0;
  return (
    window.scrollY ||
    window.pageYOffset ||
    document.documentElement.scrollTop ||
    0
  );
}

// Restore saved scroll only on Back/Forward — opening a collection fresh
// (menu, link, search) must start at the top.
// Set by Back/Forward, cleared by any link click (menu, breadcrumb, product…),
// so a slow route load after Back still counts as Back.
let pendingHistoryNav = false;
let documentNavChecked = false;
if (typeof window !== "undefined") {
  // Capture phase: the App Router renders cached pages synchronously inside its
  // own (bubble) popstate listener, so a bubble listener here fires too late.
  window.addEventListener(
    "popstate",
    () => {
      pendingHistoryNav = true;
    },
    true,
  );
  document.addEventListener(
    "click",
    (e) => {
      if ((e.target as Element | null)?.closest?.("a[href]")) {
        pendingHistoryNav = false;
      }
    },
    true,
  );
  document.addEventListener(
    "submit",
    () => {
      pendingHistoryNav = false;
    },
    true,
  );
}

function isBackForwardNavigation() {
  const inPopstate =
    typeof window !== "undefined" && window.event?.type === "popstate";
  if (pendingHistoryNav || inPopstate) {
    pendingHistoryNav = false;
    documentNavChecked = true;
    return true;
  }
  // Hard back/forward (bfcache miss) — only valid for the first grid in this document.
  if (documentNavChecked) return false;
  documentNavChecked = true;
  try {
    const nav = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    return nav?.type === "back_forward";
  } catch {
    return false;
  }
}

function cssEscape(value: string) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

export function CollectionProductGrid({
  cacheKey,
  productBasePath,
  initialProducts,
  initialTotal,
  initialPages,
  emptySlot,
  categoryLinks,
  categoryHeading,
}: {
  /** Stable key per collection (e.g. slug) for back-restore cache. */
  cacheKey: string;
  productBasePath: string;
  initialProducts: Product[];
  initialTotal: number;
  initialPages: number;
  emptySlot?: ReactNode;
  categoryLinks?: CategoryFacetLink[];
  categoryHeading?: string;
}) {
  const [filters, setFilters] = useState<CollectionFilterState>(EMPTY_FILTERS);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [products, setProducts] = useState(initialProducts);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(initialTotal);
  const [pages, setPages] = useState(initialPages);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<CollectionSort>("featured");
  const [sorting, setSorting] = useState(false);
  const [failedReload, setFailedReload] = useState(false);
  const [facets, setFacets] = useState<ListingFacets | null>(null);
  const view = useSyncExternalStore(viewStore.subscribe, viewStore.get, serverView);
  const listPath = listingPath(productBasePath, sort, filters);
  // Scroll cache + background refresh use the sorted/filtered list identity (set on restore / reload).
  const listKeyRef = useRef(listingKey(cacheKey, sort, filters));
  const listPathRef = useRef(listPath);
  /** Bumped on every sort / filter change so late responses for an old list are dropped. */
  const sortSeq = useRef(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inFlight = useRef(false);
  const scrollRestoreY = useRef(0);
  const anchorSlugRef = useRef<string | null>(null);
  const restoringRef = useRef(false);
  const didRestoreRef = useRef<string | null>(null);
  // Set after a product click: the route change scrolls/shrinks the page and
  // must not overwrite the saved position before this grid unmounts.
  const leavingRef = useRef(false);
  const productsRef = useRef(products);
  const pageRef = useRef(page);
  const totalRef = useRef(total);
  const pagesRef = useRef(pages);

  productsRef.current = products;
  pageRef.current = page;
  totalRef.current = total;
  pagesRef.current = pages;

  const persistList = useCallback(
    (opts?: { scrollY?: number; anchorSlug?: string | null }) => {
      if (productsRef.current.length === 0) return;
      // While restoring, never overwrite a real scroll target with 0
      // (Next.js often resets window scroll before our restore runs).
      let y =
        typeof opts?.scrollY === "number"
          ? opts.scrollY
          : readWindowScrollY();
      if (restoringRef.current && y <= 0 && scrollRestoreY.current > 0) {
        y = scrollRestoreY.current;
      }
      const anchor =
        opts?.anchorSlug !== undefined
          ? opts.anchorSlug
          : anchorSlugRef.current;
      saveCollectionScrollCache(listKeyRef.current, {
        productBasePath: listPathRef.current,
        products: productsRef.current,
        page: pageRef.current,
        total: totalRef.current,
        pages: pagesRef.current,
        scrollY: y,
        anchorSlug: anchor,
      });
    },
    [],
  );

  // B: restore cached list (no API). A: only meta left → refetch pages in parallel.
  useLayoutEffect(() => {
    const restoreId = `${cacheKey}::${productBasePath}`;
    if (didRestoreRef.current === restoreId) return;
    didRestoreRef.current = restoreId;

    if (typeof window !== "undefined" && "scrollRestoration" in history) {
      try {
        history.scrollRestoration = "manual";
      } catch {
        /* ignore */
      }
    }

    const urlSort = readUrlSort();
    const urlFilters = readUrlFilters();
    const restoreKey = listingKey(cacheKey, urlSort, urlFilters);
    const restorePath = listingPath(productBasePath, urlSort, urlFilters);
    listKeyRef.current = restoreKey;
    listPathRef.current = restorePath;
    sortSeq.current += 1;
    setSort(urlSort);
    setFilters(urlFilters);
    setSorting(false);
    setFailedReload(false);

    if (!isBackForwardNavigation()) {
      setProducts(initialProducts);
      setPage(1);
      setTotal(initialTotal);
      setPages(initialPages);
      scrollRestoreY.current = 0;
      anchorSlugRef.current = null;
      restoringRef.current = false;
      if (urlSort !== "featured" || hasActiveFilters(urlFilters)) {
        // Shared / refreshed link with ?sort or filters — SSR page 1 is unfiltered "featured".
        const seq = sortSeq.current;
        setSorting(true);
        fetchPage(restorePath, 1)
          .then((res) => {
            if (seq !== sortSeq.current) return;
            setProducts(res.list);
            setTotal(res.total);
            setPages(res.pages);
          })
          .catch(() => undefined)
          .finally(() => {
            if (seq === sortSeq.current) setSorting(false);
          });
      }
      return;
    }

    const cached = readCollectionScrollCache(restoreKey, restorePath);
    if (cached) {
      // Scroll restore must not keep stale FREE / Sold Out after Admin edits.
      setProducts(mergeLiveCatalogFields(cached.products, initialProducts));
      setPage(cached.page);
      setTotal(cached.total);
      setPages(cached.pages);
      scrollRestoreY.current = Math.max(0, Number(cached.scrollY) || 0);
      anchorSlugRef.current = cached.anchorSlug || null;
      restoringRef.current =
        scrollRestoreY.current > 0 ||
        Boolean(cached.anchorSlug) ||
        cached.page > 1;
      setError(null);
      return;
    }

    const meta = readCollectionScrollMeta(restoreKey, restorePath);
    if (!meta) {
      setProducts(initialProducts);
      setPage(1);
      setTotal(initialTotal);
      setPages(initialPages);
      scrollRestoreY.current = 0;
      anchorSlugRef.current = null;
      restoringRef.current = false;
      return;
    }

    let cancelled = false;
    restoringRef.current = true;
    scrollRestoreY.current = Math.max(0, Number(meta.scrollY) || 0);
    anchorSlugRef.current = meta.anchorSlug || null;
    setLoading(true);
    (async () => {
      try {
        const maxPage = Math.min(meta.page, meta.pages || meta.page);
        const results = await Promise.all(
          Array.from({ length: maxPage }, (_, i) =>
            fetchPage(restorePath, i + 1),
          ),
        );
        if (cancelled) return;
        let merged: Product[] = [];
        for (const r of results) merged = mergeUnique(merged, r.list);
        const last = results[results.length - 1];
        setProducts(merged);
        setPage(maxPage);
        setTotal(last?.total ?? meta.total);
        setPages(last?.pages ?? meta.pages);
        setError(null);
      } catch {
        if (!cancelled) {
          setProducts(initialProducts);
          setPage(1);
          setTotal(initialTotal);
          setPages(initialPages);
          restoringRef.current = false;
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, productBasePath]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${getApiUrl()}${facetsPath(productBasePath)}`)
      .then((res) => (res.ok ? (res.json() as Promise<ListingFacets>) : null))
      .then((data) => {
        if (!cancelled) setFacets(data && Array.isArray(data.brands) ? data : null);
      })
      .catch(() => {
        if (!cancelled) setFacets(null);
      });
    return () => {
      cancelled = true;
    };
  }, [productBasePath]);

  // Keep FREE badges in sync with Admin (covers restored scroll cache + page 2+).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const freeIds = await fetchFreeProductIdSet();
      if (cancelled || !freeIds) return;
      setProducts((prev) => applyFreeProductIdSet(prev, freeIds));
    })();
    return () => {
      cancelled = true;
    };
  }, [cacheKey, productBasePath]);

  // Soft navigations: SSR page-1 may be fresher than an in-memory list.
  useEffect(() => {
    setProducts((prev) => mergeLiveCatalogFields(prev, initialProducts));
  }, [initialProducts]);

  // After restore / mount: refresh loaded pages so Sold Out ↔ in stock updates ASAP.
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const maxPage = Math.max(1, pageRef.current);
        try {
          const results = await Promise.all(
            Array.from({ length: maxPage }, (_, i) =>
              fetchPage(listPathRef.current, i + 1, { bustCache: true }),
            ),
          );
          if (cancelled) return;
          let merged: Product[] = [];
          for (const r of results) merged = mergeUnique(merged, r.list);
          if (!merged.length) return;
          const last = results[results.length - 1];
          setProducts(merged);
          setTotal(last?.total ?? totalRef.current);
          setPages(last?.pages ?? pagesRef.current);
        } catch {
          /* keep current list */
        }
      })();
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [cacheKey, productBasePath]);

  // Keep applying scroll until layout/images make the page tall enough.
  useLayoutEffect(() => {
    if (!restoringRef.current) return;
    const y = scrollRestoreY.current;
    const slug = anchorSlugRef.current;
    if (y <= 0 && !slug) {
      restoringRef.current = false;
      return;
    }

    let finished = false;
    const startedAt = Date.now();
    const userEvents = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
    const finish = () => {
      if (finished) return;
      finished = true;
      restoringRef.current = false;
      userEvents.forEach((ev) => window.removeEventListener(ev, onUserInput));
    };
    // Never fight the shopper: a real scroll / tap ends the restore. Ignore the
    // first moments (Back key / swipe-back gesture tail) and sideways swipes.
    const onUserInput = (e: Event) => {
      if (Date.now() - startedAt < 400) return;
      if (
        e instanceof WheelEvent &&
        Math.abs(e.deltaX) > Math.abs(e.deltaY)
      ) {
        return;
      }
      finish();
    };
    userEvents.forEach((ev) =>
      window.addEventListener(ev, onUserInput, { passive: true }),
    );

    // "instant": html has scroll-behavior:smooth, which turns each retry into a visible animation.
    const apply = () => {
      if (finished) return true;
      if (slug) {
        const el = rootRef.current?.querySelector(
          `a[href="/products/${cssEscape(slug)}"]`,
        ) as HTMLElement | null;
        if (el) {
          el.scrollIntoView({ block: "center", behavior: "instant" });
          return true;
        }
      }
      if (y > 0) {
        window.scrollTo({ top: y, left: 0, behavior: "instant" });
        return Math.abs(readWindowScrollY() - y) < 80;
      }
      return false;
    };

    apply();

    const delays = [0, 16, 50, 100, 200, 400, 700, 1100, 1800, 2800];
    const timers = delays.map((ms) =>
      window.setTimeout(() => {
        const ok = apply();
        if (ms >= 2800 || (ok && ms >= 400)) finish();
      }, ms),
    );

    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            if (finished) return;
            apply();
          })
        : null;
    if (ro && rootRef.current) ro.observe(rootRef.current);
    if (ro) ro.observe(document.documentElement);

    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      ro?.disconnect();
      userEvents.forEach((ev) => window.removeEventListener(ev, onUserInput));
    };
  }, [cacheKey, products.length, page]);

  useEffect(() => {
    // Persist list; keep target scroll while restoring so we don't write scrollY=0.
    persistList(
      restoringRef.current || leavingRef.current
        ? { scrollY: scrollRestoreY.current, anchorSlug: anchorSlugRef.current }
        : undefined,
    );
  }, [products, page, total, pages, persistList]);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (restoringRef.current || leavingRef.current) return;
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const y = readWindowScrollY();
        if (y > 0) {
          patchCollectionScrollPosition(listKeyRef.current, { scrollY: y });
          scrollRestoreY.current = y;
        }
        ticking = false;
      });
    };
    const onLeave = () => {
      if (leavingRef.current) return;
      const y = readWindowScrollY();
      if (y > 0 || anchorSlugRef.current) {
        persistList({
          scrollY: y > 0 ? y : scrollRestoreY.current,
          anchorSlug: anchorSlugRef.current,
        });
      }
    };
    // Shopper stayed (new-tab click, slow route): track scroll again.
    const onUserInput = () => {
      leavingRef.current = false;
    };
    const userEvents = ["wheel", "touchmove", "keydown"] as const;
    userEvents.forEach((ev) =>
      window.addEventListener(ev, onUserInput, { passive: true }),
    );
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", onLeave);
    const onVis = () => {
      if (document.visibilityState === "hidden") onLeave();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      onLeave();
      userEvents.forEach((ev) => window.removeEventListener(ev, onUserInput));
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", onLeave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [cacheKey, persistList]);

  const hasMore = page < pages;

  const loadMore = useCallback(async () => {
    if (inFlight.current || !hasMore || restoringRef.current || sorting) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    const next = page + 1;
    const seq = sortSeq.current;
    try {
      const res = await fetchPage(listPath, next);
      if (seq !== sortSeq.current) return;
      setProducts((prev) => mergeUnique(prev, res.list));
      setPage(next);
      setTotal(res.total);
      setPages(res.pages);
    } catch {
      if (seq === sortSeq.current) {
        setFailedReload(false);
        setError("Couldn’t load more products. Tap to retry.");
      }
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }, [hasMore, page, listPath, sorting]);

  /** Refetch page 1 for a new sort and/or filter set. */
  const reloadList = useCallback(
    async (nextSort: CollectionSort, nextFilters: CollectionFilterState, force = false) => {
      if (nextSort === sort && nextFilters === filters && !force) return;
      const seq = ++sortSeq.current;
      const path = listingPath(productBasePath, nextSort, nextFilters);
      writeUrlState(nextSort, nextFilters);
      listKeyRef.current = listingKey(cacheKey, nextSort, nextFilters);
      listPathRef.current = path;
      setSort(nextSort);
      setFilters(nextFilters);
      setSorting(true);
      setError(null);
      setFailedReload(false);
      try {
        const res = await fetchPage(path, 1);
        if (seq !== sortSeq.current) return;
        setProducts(res.list);
        setPage(1);
        setTotal(res.total);
        setPages(res.pages);
        anchorSlugRef.current = null;
        scrollRestoreY.current = 0;
        const top = rootRef.current?.getBoundingClientRect().top ?? 0;
        if (top < 0) rootRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
      } catch {
        if (seq === sortSeq.current) {
          setFailedReload(true);
          setError("Couldn’t load products. Tap to retry.");
        }
      } finally {
        if (seq === sortSeq.current) setSorting(false);
      }
    },
    [sort, filters, cacheKey, productBasePath],
  );

  const changeSort = (next: CollectionSort) => void reloadList(next, filters);
  const applyFilters = (next: CollectionFilterState) => void reloadList(sort, next);

  const filtering = hasActiveFilters(filters);

  const [filterKey, setFilterKey] = useState(cacheKey);
  if (filterKey !== cacheKey) {
    setFilterKey(cacheKey);
    setFilterSheetOpen(false);
  }

  useEffect(() => {
    if (!filterSheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [filterSheetOpen]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (restoringRef.current) return;
        if (entries.some((e) => e.isIntersecting)) {
          void loadMore();
        }
      },
      { root: null, rootMargin: "480px 0px", threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loadMore]);

  function onGridClickCapture(e: MouseEvent<HTMLDivElement>) {
    const a = (e.target as HTMLElement).closest(
      'a[href^="/products/"]',
    ) as HTMLAnchorElement | null;
    if (!a) return;
    const href = a.getAttribute("href") || "";
    const slug = href.replace(/^\/products\//, "").split(/[?#]/)[0];
    if (!slug) return;
    anchorSlugRef.current = slug;
    const y = readWindowScrollY();
    scrollRestoreY.current = y;
    persistList({ scrollY: y, anchorSlug: slug });
    leavingRef.current = true;
  }

  if (!products.length && !filtering && !sorting) {
    return (
      emptySlot || (
        <p className="text-sm text-muted py-12 text-center">
          No products in this collection yet.
        </p>
      )
    );
  }

  const filterCount = activeFilterCount(filters);
  const brandName = (slug: string) =>
    facets?.brands.find((b) => b.slug === slug)?.name || slug;
  const panel = (
    <CollectionFilterPanel
      facets={facets}
      filters={filters}
      onChange={applyFilters}
      categoryLinks={categoryLinks}
      categoryHeading={categoryHeading}
    />
  );

  return (
    <div
      ref={rootRef}
      onClickCapture={onGridClickCapture}
      className="scroll-mt-24 lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start lg:gap-6"
    >
      <aside
        aria-label="Filters"
        className="sticky top-[calc(var(--header-h)+12px)] hidden max-h-[calc(100vh-var(--header-h)-24px)] space-y-3 overflow-y-auto pb-2 scrollbar-hide lg:block"
      >
        <label className="relative flex h-[52px] cursor-pointer items-center gap-1 rounded-[var(--radius-sm)] bg-white px-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <span className="min-w-0 truncate text-[15px] font-semibold text-ink">
            Sort By : {COLLECTION_SORTS.find((s) => s.id === sort)?.label}
          </span>
          <ChevronDown size={18} className="ml-auto shrink-0 text-brand" aria-hidden />
          <select
            value={sort}
            onChange={(e) => changeSort(e.target.value as CollectionSort)}
            aria-label="Sort products"
            className="absolute inset-0 cursor-pointer opacity-0"
          >
            {COLLECTION_SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <div className="rounded-[var(--radius-sm)] bg-white px-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <div className="flex items-center justify-between border-b border-line py-3.5">
            <p className="text-[15px] font-semibold text-ink">Filters</p>
            {filtering ? (
              <button
                type="button"
                onClick={() => applyFilters(EMPTY_FILTERS)}
                className="text-[13px] font-semibold text-brand"
              >
                Clear all
              </button>
            ) : null}
          </div>
          <div className="[&>div>div:last-child]:border-b-0">{panel}</div>
        </div>
      </aside>

      <div className="min-w-0">
        <div className="mb-3 flex items-center justify-between gap-3 rounded-[var(--radius-sm)] bg-white px-3 py-2 shadow-[0_1px_3px_rgba(0,0,0,0.06)] sm:mb-4 sm:px-4 lg:bg-transparent lg:px-0 lg:py-0 lg:shadow-none">
          <p className="hidden text-[13px] text-muted sm:block sm:text-sm" aria-live="polite">
            {filtering && facets
              ? `${total} of ${facets.total} product${facets.total === 1 ? "" : "s"}`
              : `${total} product${total === 1 ? "" : "s"}`}
          </p>
          <button
            type="button"
            onClick={() => setFilterSheetOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-sm)] border border-line-strong px-3 text-[13px] font-semibold text-ink lg:hidden"
          >
            <SlidersHorizontal size={16} aria-hidden />
            Filter
            {filterCount ? (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[11px] text-white">
                {filterCount}
              </span>
            ) : null}
          </button>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden items-center gap-0.5 sm:flex" role="group" aria-label="Product view">
              {(
                [
                  { id: "list", label: "List view", Icon: List },
                  { id: "grid", label: "Grid view", Icon: LayoutGrid },
                ] as const
              ).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  aria-label={label}
                  aria-pressed={view === id}
                  title={label}
                  onClick={() => viewStore.set(id)}
                  className={`grid h-9 w-9 place-items-center rounded-md transition-colors ${
                    view === id ? "text-brand" : "text-subtle hover:text-text"
                  }`}
                >
                  <Icon size={19} strokeWidth={view === id ? 2.2 : 1.8} />
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-[13px] text-muted sm:text-sm lg:hidden">
              <span className="hidden sm:inline">Sort by:</span>
              <span className="relative">
                <select
                  value={sort}
                  onChange={(e) => changeSort(e.target.value as CollectionSort)}
                  aria-label="Sort products"
                  className="h-9 max-w-[170px] cursor-pointer appearance-none rounded-[var(--radius-sm)] border border-line-strong bg-white pl-3 pr-8 text-[13px] font-medium text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand sm:max-w-none sm:min-w-[190px] sm:text-sm"
                >
                  {COLLECTION_SORTS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted"
                  aria-hidden
                />
              </span>
            </label>
          </div>
        </div>

        {filtering ? (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {filters.brands.map((b) => (
              <FilterChip
                key={b}
                label={brandName(b)}
                onRemove={() =>
                  applyFilters({ ...filters, brands: filters.brands.filter((x) => x !== b) })
                }
              />
            ))}
            {filters.price ? (
              <FilterChip
                label={priceLabel(filters.price)}
                onRemove={() => applyFilters({ ...filters, price: null })}
              />
            ) : null}
            {filters.discount ? (
              <FilterChip
                label={`${filters.discount}%+ off`}
                onRemove={() => applyFilters({ ...filters, discount: null })}
              />
            ) : null}
            <button
              type="button"
              onClick={() => applyFilters(EMPTY_FILTERS)}
              className="text-[13px] font-semibold text-brand"
            >
              Clear all
            </button>
          </div>
        ) : null}

        {filtering && !products.length && !sorting && !error ? (
          <div className="rounded-[var(--radius-md)] border border-dashed border-line-strong py-14 text-center">
            <p className="text-sm text-muted">No products match these filters.</p>
            <button
              type="button"
              onClick={() => applyFilters(EMPTY_FILTERS)}
              className="mt-3 text-sm font-semibold text-brand"
            >
              Clear filters
            </button>
          </div>
        ) : null}

        <div
          aria-busy={sorting}
          className={`grid transition-opacity ${
            view === "list"
              ? "grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-2"
              : "grid-cols-2 gap-2 sm:gap-4 md:grid-cols-3 lg:gap-5 xl:grid-cols-4"
          } ${sorting ? "pointer-events-none opacity-50" : ""}`}
        >
          {products.map((p, i) => (
            <ProductCard
              key={p.id}
              product={p}
              imagePriority={i < 4}
              layout={view}
              imageSizes={
                view === "list"
                  ? "(max-width:768px) 38vw, 220px"
                  : "(max-width:768px) 50vw, (max-width:1280px) 30vw, 260px"
              }
            />
          ))}
        </div>

        <div ref={sentinelRef} className="h-8 w-full" aria-hidden />

        <div className="mt-2 flex min-h-[2.5rem] flex-col items-center justify-center gap-2">
          {loading ? (
            <div
              className="flex items-center gap-2 text-sm text-muted"
              role="status"
              aria-live="polite"
            >
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-line-strong border-t-brand" />
              Loading more…
            </div>
          ) : null}
          {error ? (
            <button
              type="button"
              onClick={() => void (failedReload ? reloadList(sort, filters, true) : loadMore())}
              className="text-sm font-semibold text-brand underline-offset-2 hover:underline"
            >
              {error}
            </button>
          ) : null}
          {!hasMore && products.length > 0 ? (
            <p className="text-xs text-muted">You’ve seen all {total} products</p>
          ) : null}
        </div>
      </div>

      {filterSheetOpen ? (
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <button
            type="button"
            aria-label="Close filters"
            className="absolute inset-0 bg-black/40"
            onClick={() => setFilterSheetOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-[var(--radius-lg)] bg-white">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="text-[15px] font-semibold text-ink">Filters</p>
              <button
                type="button"
                aria-label="Close filters"
                onClick={() => setFilterSheetOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-surface"
              >
                <X size={18} aria-hidden />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4">{panel}</div>
            <div className="grid grid-cols-2 gap-3 border-t border-line p-3">
              <button
                type="button"
                onClick={() => applyFilters(EMPTY_FILTERS)}
                className="h-11 rounded-[var(--radius-sm)] border border-line-strong text-sm font-semibold text-ink"
              >
                Clear all
              </button>
              <button
                type="button"
                onClick={() => setFilterSheetOpen(false)}
                className="h-11 rounded-[var(--radius-sm)] bg-brand text-sm font-semibold text-white"
              >
                {filtering && !sorting ? `Show ${total} results` : "Apply"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function priceLabel(id: string) {
  return PRICE_BUCKETS.find((b) => b.id === id)?.label || id;
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-brand bg-brand-soft py-1 pl-3 pr-1.5 text-[12px] font-medium text-brand">
      {label}
      <button
        type="button"
        aria-label={`Remove ${label}`}
        onClick={onRemove}
        className="grid h-5 w-5 place-items-center rounded-full hover:bg-white"
      >
        <X size={12} aria-hidden />
      </button>
    </span>
  );
}

export { PAGE_SIZE as COLLECTION_PAGE_SIZE };
