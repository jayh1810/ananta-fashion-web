import { SITE_URL } from "./constants";

/** Decode path token from /og/<base64url>.jpg — returns null if invalid. */
export function decodeOgSourceToken(
  token: string | string[] | null | undefined,
): string | null {
  try {
    const raw = Array.isArray(token) ? token.join("/") : String(token || "");
    const cleaned = raw.replace(/\.jpe?g$/i, "").trim();
    if (!cleaned) return null;
    const b64 = cleaned.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const decoded = Buffer.from(b64 + pad, "base64").toString("utf8").trim();
    if (!/^https?:\/\//i.test(decoded)) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function encodeOgSourceToken(absoluteUrl: string): string {
  return Buffer.from(absoluteUrl, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Same-domain OG URL path that WhatsApp / Google Chat can fetch reliably. */
export function buildShareOgPath(absoluteImageUrl: string): string {
  return `/og/${encodeOgSourceToken(absoluteImageUrl)}.jpg`;
}

export function buildShareOgAbsoluteUrl(absoluteImageUrl: string): string {
  return `${SITE_URL}${buildShareOgPath(absoluteImageUrl)}`;
}
