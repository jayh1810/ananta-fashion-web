const KEY = "aa:recently-viewed";
const MAX = 12;

export function readRecentlyViewed(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((s): s is string => typeof s === "string" && !!s).slice(0, MAX)
      : [];
  } catch {
    return [];
  }
}

function write(slugs: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(slugs.slice(0, MAX)));
  } catch {
    /* storage unavailable */
  }
}

/** Moves `slug` to the front (most recent first). */
export function rememberViewed(slug: string) {
  if (!slug) return;
  write([slug, ...readRecentlyViewed().filter((s) => s !== slug)]);
}

/** Drops slugs the catalog no longer returns (deleted / unpublished). */
export function forgetViewed(slugs: string[]) {
  if (!slugs.length) return;
  const drop = new Set(slugs);
  write(readRecentlyViewed().filter((s) => !drop.has(s)));
}
