import type { CSSProperties } from "react";

/** Storefront chrome colours + lists managed in Admin → Storefront → Theme. */
export type ThemeColors = {
  topStripFrom: string;
  topStripTo: string;
  topStripText: string;
  tickerBg: string;
  tickerText: string;
  tickerAccent: string;
  heroBand: string;
  headingAccent: string;
  headingOrnament: string;
  offerBorder: string;
  pageBand: string;
  footerContactBg: string;
  footerLinksBg: string;
  footerTrustBg: string;
  footerBottomBg: string;
};

export type ThemeIcon =
  | "package"
  | "help"
  | "phone"
  | "mail"
  | "store"
  | "gift"
  | "map"
  | "badge"
  | "returns"
  | "shield"
  | "truck"
  | "star"
  | "heart";

export type ThemeLink = { label: string; href: string; icon: ThemeIcon };
export type ThemeTrustItem = { title: string; body: string; icon: ThemeIcon };

export type StoreTheme = {
  colors: ThemeColors;
  topLinks: ThemeLink[];
  footerTrust: ThemeTrustItem[];
  footerContactBand: boolean;
};

export const DEFAULT_THEME: StoreTheme = {
  colors: {
    topStripFrom: "#DFD08F",
    topStripTo: "#EBDC9B",
    topStripText: "#001325",
    tickerBg: "#C6A555",
    tickerText: "#FFFFFF",
    tickerAccent: "#FFFFFF",
    heroBand: "#F3E3BF",
    headingAccent: "#AA071C",
    headingOrnament: "#E2B47A",
    offerBorder: "#E8B86D",
    pageBand: "#F3F3F3",
    footerContactBg: "#3A4047",
    footerLinksBg: "#595E63",
    footerTrustBg: "#F3F4F5",
    footerBottomBg: "#E85D04",
  },
  topLinks: [
    { label: "Track Order", href: "/pages/track-order", icon: "package" },
    { label: "Help", href: "/pages/contact", icon: "help" },
  ],
  footerTrust: [
    {
      title: "100% Genuine",
      body: "Sourced from brands & authorised sellers",
      icon: "badge",
    },
    {
      title: "Easy Returns",
      body: "Hassle-free returns on eligible items",
      icon: "returns",
    },
    {
      title: "Secure Payments",
      body: "UPI, cards, net banking & COD",
      icon: "shield",
    },
    { title: "Fast Delivery", body: "Shipped across India", icon: "truck" },
  ],
  footerContactBand: true,
};

const ICONS: readonly ThemeIcon[] = [
  "package",
  "help",
  "phone",
  "mail",
  "store",
  "gift",
  "map",
  "badge",
  "returns",
  "shield",
  "truck",
  "star",
  "heart",
];

const HEX = /^#[0-9a-f]{6}$/i;

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function icon(v: unknown, fallback: ThemeIcon): ThemeIcon {
  return ICONS.includes(v as ThemeIcon) ? (v as ThemeIcon) : fallback;
}

export function normalizeTheme(raw: unknown): StoreTheme {
  if (!raw || typeof raw !== "object") return DEFAULT_THEME;
  const r = raw as Record<string, unknown>;
  const rawColors = (r.colors && typeof r.colors === "object"
    ? r.colors
    : {}) as Record<string, unknown>;
  const colors = { ...DEFAULT_THEME.colors };
  for (const key of Object.keys(colors) as (keyof ThemeColors)[]) {
    const v = str(rawColors[key]);
    if (HEX.test(v)) colors[key] = v;
  }
  const topLinks = Array.isArray(r.topLinks)
    ? (r.topLinks as Record<string, unknown>[])
        .map((l) => ({
          label: str(l?.label),
          href: str(l?.href),
          icon: icon(l?.icon, "help"),
        }))
        .filter(
          (l) => l.label && (l.href.startsWith("/") || /^https?:\/\//i.test(l.href)),
        )
        .slice(0, 4)
    : DEFAULT_THEME.topLinks;
  const footerTrust = Array.isArray(r.footerTrust)
    ? (r.footerTrust as Record<string, unknown>[])
        .map((t) => ({
          title: str(t?.title),
          body: str(t?.body),
          icon: icon(t?.icon, "badge"),
        }))
        .filter((t) => t.title)
        .slice(0, 6)
    : DEFAULT_THEME.footerTrust;
  return {
    colors,
    topLinks,
    footerTrust,
    footerContactBand: r.footerContactBand !== false,
  };
}

/** CSS custom properties consumed by the storefront chrome (see globals.css). */
export function themeCssVars(theme: StoreTheme): CSSProperties {
  const c = theme.colors;
  return {
    "--strip-from": c.topStripFrom,
    "--strip-to": c.topStripTo,
    "--strip-text": c.topStripText,
    "--ticker-bg": c.tickerBg,
    "--ticker-text": c.tickerText,
    "--ticker-accent": c.tickerAccent,
    "--hero-band": c.heroBand,
    "--heading-accent": c.headingAccent,
    "--heading-ornament": c.headingOrnament,
    "--offer-border": c.offerBorder,
    "--page-band": c.pageBand,
    "--footer-contact-bg": c.footerContactBg,
    "--footer-links-bg": c.footerLinksBg,
    "--footer-trust-bg": c.footerTrustBg,
    "--footer-bottom-bg": c.footerBottomBg,
  } as CSSProperties;
}
