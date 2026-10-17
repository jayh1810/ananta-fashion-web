import { getApiUrl } from "@/lib/api";

export type TrendingSearch = { label: string; query: string; emoji: string | null };

const RECENT_KEY = "aa.search.recent";
const SESSION_KEY = "aa.search.session";
const RECENT_MAX = 10;
const TRENDING_TTL_MS = 60_000;

/** Admin-managed trending searches replace this when available. */
export const DEFAULT_TRENDING: TrendingSearch[] = [];

const norm = (q: string) => q.trim().toLowerCase().replace(/\s+/g, " ");

function clean(q: string) {
  return q.trim().replace(/\s+/g, " ").slice(0, 100);
}

export function readRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(raw)
      ? raw.filter((s): s is string => typeof s === "string").slice(0, RECENT_MAX)
      : [];
  } catch {
    return [];
  }
}

function writeRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX)));
  } catch {
    /* storage unavailable */
  }
}

/** Newest first, case-insensitive unique. */
export function mergeRecent(...lists: string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const q of list) {
      const c = clean(q);
      const k = norm(c);
      if (c.length < 2 || seen.has(k)) continue;
      seen.add(k);
      out.push(c);
      if (out.length >= RECENT_MAX) return out;
    }
  }
  return out;
}

export function addRecentSearch(q: string) {
  const c = clean(q);
  if (c.length < 2) return readRecentSearches();
  const next = mergeRecent([c], readRecentSearches());
  writeRecent(next);
  return next;
}

export function removeRecentSearch(q: string, token?: string | null) {
  const next = readRecentSearches().filter((s) => norm(s) !== norm(q));
  writeRecent(next);
  if (token) void deleteServerHistory(token, q);
  return next;
}

export function clearRecentSearches(token?: string | null) {
  writeRecent([]);
  if (token) void deleteServerHistory(token);
}

let trendingCache: { at: number; items: TrendingSearch[] } | null = null;

export async function fetchTrendingSearches(): Promise<TrendingSearch[]> {
  if (trendingCache && Date.now() - trendingCache.at < TRENDING_TTL_MS) {
    return trendingCache.items;
  }
  try {
    const res = await fetch(`${getApiUrl()}/search/trending`);
    if (!res.ok) throw new Error(String(res.status));
    const json = (await res.json()) as { items?: TrendingSearch[] };
    const items = Array.isArray(json.items) ? json.items.filter((i) => i?.label) : [];
    trendingCache = { at: Date.now(), items };
    return items;
  } catch {
    return [];
  }
}

export async function fetchServerHistory(token: string): Promise<string[]> {
  try {
    const res = await fetch(`${getApiUrl()}/search/history`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { items?: { query: string }[] };
    return Array.isArray(json.items) ? json.items.map((i) => i.query) : [];
  } catch {
    return [];
  }
}

async function deleteServerHistory(token: string, q?: string) {
  try {
    const qs = q ? `?q=${encodeURIComponent(q)}` : "";
    await fetch(`${getApiUrl()}/search/history${qs}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    /* best effort */
  }
}

function sessionId() {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return undefined;
  }
}

/** Fire-and-forget; never blocks or breaks the page. */
export function logSearch(
  q: string,
  opts: { resultCount?: number; source?: "search" | "header"; token?: string | null } = {},
) {
  const c = clean(q);
  if (c.length < 2 || typeof window === "undefined") return;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  void fetch(`${getApiUrl()}/search/log`, {
    method: "POST",
    headers,
    keepalive: true,
    body: JSON.stringify({
      q: c,
      resultCount: opts.resultCount,
      source: opts.source || "search",
      sessionId: sessionId(),
    }),
  }).catch(() => {});
}
