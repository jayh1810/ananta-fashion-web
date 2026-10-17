/**
 * True when `src` is safe for next/image (absolute http(s) or root-relative).
 * Rejects alt/description text accidentally stored as media URLs.
 */
export function isUsableImageSrc(src?: string | null): boolean {
  const u = String(src || "").trim();
  if (!u || u.length > 2048) return false;
  if (/^https?:\/\//i.test(u)) return true;
  if (u.startsWith("//")) return true;
  if (u.startsWith("/")) return true;
  return false;
}
