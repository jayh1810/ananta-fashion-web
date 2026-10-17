/** Default saffron accent used when settings omit brandColor. */
export const DEFAULT_BRAND_COLOR = "#E85D04";
const DEFAULT_BRAND_HOVER = "#C14E03";

export function normalizeBrandHex(input?: string | null): string {
  const raw = String(input || "").trim();
  const m = raw.match(/^#?([0-9a-fA-F]{6})$/);
  if (!m) return DEFAULT_BRAND_COLOR;
  return `#${m[1].toUpperCase()}`;
}

function channel(hex: string, shift: number) {
  return (parseInt(hex.slice(1), 16) >> shift) & 255;
}

/** Darker shade for hover / deep accents. */
export function brandDeep(hex: string, amount = 0.18): string {
  const h = normalizeBrandHex(hex);
  if (h === DEFAULT_BRAND_COLOR) return DEFAULT_BRAND_HOVER;
  const r = Math.max(0, Math.round(channel(h, 16) * (1 - amount)));
  const g = Math.max(0, Math.round(channel(h, 8) * (1 - amount)));
  const b = Math.max(0, Math.round(channel(h, 0) * (1 - amount)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0").toUpperCase()}`;
}

/** Soft tint for chips / toast backgrounds (mix with white). */
export function brandSoft(hex: string, whiteMix = 0.88): string {
  const h = normalizeBrandHex(hex);
  const mix = (c: number) =>
    Math.min(255, Math.round(c + (255 - c) * whiteMix));
  const r = mix(channel(h, 16));
  const g = mix(channel(h, 8));
  const b = mix(channel(h, 0));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0").toUpperCase()}`;
}

/** CSS custom properties for a brand color (legacy names alias these in globals.css). */
export function brandCssVars(color?: string | null): Record<string, string> {
  const base = normalizeBrandHex(color);
  return {
    "--brand": base,
    "--brand-hover": brandDeep(base),
    "--brand-soft": brandSoft(base),
  };
}

/** Apply brand color to CSS variables on :root (client). */
export function applyBrandColorToDocument(color?: string | null) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const [key, value] of Object.entries(brandCssVars(color))) {
    root.style.setProperty(key, value);
  }
}
