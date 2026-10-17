import { cache } from "react";
import { BRAND } from "@/lib/api";
import { DEFAULT_BRAND_COLOR, normalizeBrandHex } from "@/lib/brand-color";
import type { AnnouncementBarInitial } from "@/components/AnnouncementBar";
import { DEFAULT_THEME, normalizeTheme, type StoreTheme } from "@/lib/theme";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3003/api/v1"
).replace(/\/$/, "");

/** Storefront offer / PDP copy toggles shared by layout and product UI. */
export type StoreOfferConfig = {
  siteName: string;
  cashbackRibbonEnabled: boolean;
  defaultCashbackLabel: string;
  packagingEnabled: boolean;
  packagingText: string;
  returnsEnabled: boolean;
  returnsText: string;
  cashbackTermsEnabled: boolean;
  cashbackTerms: string;
  /** Admin → Settings → Offers → Cashback. Off hides wallet and cashback everywhere. */
  walletEnabled: boolean;
  /** Credit cashback on prepaid orders. Requires walletEnabled. */
  cashbackEarnEnabled: boolean;
  cashbackPercent: number;
  whyBrandEnabled: boolean;
  whyBrandHappyCustomersEnabled: boolean;
  whyBrandCertifiedEnabled: boolean;
  whyBrandReturnsEnabled: boolean;
  whyBrandShippingEnabled: boolean;
  whyBrandHappyCustomers: string;
  whyBrandCertified: string;
  whyBrandReturns: string;
  whyBrandShipping: string;
  /** Admin → Product Reviews → Settings */
  reviewsOnProductPage: boolean;
  /** Review slider near the PDP offer banner — independent of the reviews section. */
  reviewsSlider: boolean;
  reviewsOnCards: boolean;
  reviewSubmissions: boolean;
  reviewPhotos: boolean;
  /** Admin → Settings → Shipping; 0 means every order ships free. */
  freeShippingAbovePaise: number;
  shippingFlatPaise: number;
  /** False only when GST is added on top of listed prices at checkout. */
  pricesIncludeTax: boolean;
};

export type AppSettings = {
  siteName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  brandColor: string;
  announcements: AnnouncementBarInitial;
  theme: StoreTheme;
  store: StoreOfferConfig & {
    phoneHref?: string;
    email?: string;
    phone?: string;
    supportHours?: string;
    footerTagline?: string;
    footerAbout?: string[];
    socialInstagram?: string;
    socialFacebook?: string;
    /** Extra official profile URLs (YouTube, Google Business, marketplaces) → Organization.sameAs */
    brandProfiles?: string[];
    whatsapp?: string;
    pages?: {
      slug: string;
      title: string;
      published?: boolean;
      showInFooter?: boolean;
    }[];
  };
};

const DEFAULT_OFFER: StoreOfferConfig = {
  siteName: BRAND,
  cashbackRibbonEnabled: false,
  defaultCashbackLabel: "",
  packagingEnabled: true,
  packagingText: "",
  returnsEnabled: true,
  returnsText: "",
  cashbackTermsEnabled: false,
  cashbackTerms: "",
  walletEnabled: false,
  cashbackEarnEnabled: false,
  cashbackPercent: 0,
  whyBrandEnabled: true,
  whyBrandHappyCustomersEnabled: true,
  whyBrandCertifiedEnabled: true,
  whyBrandReturnsEnabled: true,
  whyBrandShippingEnabled: true,
  whyBrandHappyCustomers: "",
  whyBrandCertified: "",
  whyBrandReturns: "",
  whyBrandShipping: "",
  reviewsOnProductPage: true,
  reviewsSlider: true,
  reviewsOnCards: true,
  reviewSubmissions: true,
  reviewPhotos: true,
  freeShippingAbovePaise: 99900,
  shippingFlatPaise: 4900,
  pricesIncludeTax: true,
};

function mapSettings(raw: Record<string, unknown>): AppSettings {
  const store = (raw.store || {}) as Record<string, unknown>;
  const reviews = (raw.reviews || {}) as Record<string, unknown>;
  const shipping = (raw.shipping || {}) as Record<string, unknown>;
  const tax = (raw.tax || {}) as Record<string, unknown>;
  const shippingCharged = shipping.enabled !== false;
  const flatPaise =
    typeof shipping.flatRatePaise === "number"
      ? shipping.flatRatePaise
      : DEFAULT_OFFER.shippingFlatPaise;
  const wallet = (raw.wallet || {}) as Record<string, unknown>;
  const walletEnabled = wallet.enabled === true;
  const announcements = (raw.announcements || {}) as Record<string, unknown>;
  const messages = Array.isArray(announcements.messages)
    ? announcements.messages.filter(
        (m): m is string => typeof m === "string" && !!m.trim(),
      )
    : [];

  const offer: StoreOfferConfig = {
    siteName: (raw.siteName as string) || BRAND,
    cashbackRibbonEnabled: !!store.cashbackRibbonEnabled,
    defaultCashbackLabel:
      (store.defaultCashbackLabel as string)?.trim() || "",
    packagingEnabled: store.packagingEnabled !== false,
    packagingText: (store.packagingText as string)?.trim() || "",
    returnsEnabled: store.returnsEnabled !== false,
    returnsText: (store.returnsText as string)?.trim() || "",
    cashbackTermsEnabled: store.cashbackTermsEnabled === true,
    cashbackTerms: (store.cashbackTerms as string)?.trim() || "",
    walletEnabled,
    cashbackEarnEnabled:
      walletEnabled && wallet.cashbackEarnEnabled === true,
    cashbackPercent: walletEnabled
      ? Math.min(100, Math.max(0, Number(wallet.cashbackPercent) || 0))
      : 0,
    whyBrandEnabled: store.whyBrandEnabled !== false,
    whyBrandHappyCustomersEnabled: store.whyBrandHappyCustomersEnabled !== false,
    whyBrandCertifiedEnabled: store.whyBrandCertifiedEnabled !== false,
    whyBrandReturnsEnabled: store.whyBrandReturnsEnabled !== false,
    whyBrandShippingEnabled: store.whyBrandShippingEnabled !== false,
    whyBrandHappyCustomers:
      (store.whyBrandHappyCustomers as string)?.trim() || "",
    whyBrandCertified: (store.whyBrandCertified as string)?.trim() || "",
    whyBrandReturns: (store.whyBrandReturns as string)?.trim() || "",
    whyBrandShipping: (store.whyBrandShipping as string)?.trim() || "",
    reviewsOnProductPage: reviews.showOnProductPage !== false,
    reviewsSlider: reviews.showReviewSlider !== false,
    reviewsOnCards: reviews.showOnProductCards !== false,
    reviewSubmissions: reviews.allowSubmissions !== false,
    reviewPhotos: reviews.allowPhotos !== false,
    freeShippingAbovePaise:
      !shippingCharged || flatPaise <= 0
        ? 0
        : typeof shipping.freeAbovePaise === "number"
          ? Math.max(0, shipping.freeAbovePaise)
          : DEFAULT_OFFER.freeShippingAbovePaise,
    shippingFlatPaise: shippingCharged ? Math.max(0, flatPaise) : 0,
    pricesIncludeTax: tax.enabled !== true || tax.inclusive !== false,
  };

  return {
    siteName: offer.siteName,
    logoUrl: (raw.logoUrl as string | null) || null,
    faviconUrl: (raw.faviconUrl as string | null) || null,
    brandColor: normalizeBrandHex(store.brandColor as string | undefined),
    announcements: {
      enabled: announcements.enabled !== false,
      messages,
      intervalMs:
        typeof announcements.intervalMs === "number" &&
        announcements.intervalMs >= 1000
          ? announcements.intervalMs
          : 4500,
      phoneHref: (store.phoneHref as string) || undefined,
      email: (store.email as string) || undefined,
    },
    theme: normalizeTheme(raw.theme),
    store: {
      ...offer,
      phoneHref: (store.phoneHref as string) || undefined,
      email: (store.email as string) || undefined,
      phone: (store.phone as string) || undefined,
      supportHours: (store.supportHours as string) || undefined,
      footerTagline: (store.footerTagline as string) || undefined,
      footerAbout: Array.isArray(store.footerAbout)
        ? (store.footerAbout as string[])
        : undefined,
      socialInstagram: (store.socialInstagram as string) || undefined,
      socialFacebook: (store.socialFacebook as string) || undefined,
      brandProfiles: Array.isArray(store.brandProfiles)
        ? (store.brandProfiles as unknown[]).filter(
            (u): u is string => typeof u === "string",
          )
        : undefined,
      whatsapp: (store.whatsapp as string) || undefined,
      pages: Array.isArray(store.pages)
        ? (store.pages as AppSettings["store"]["pages"])
        : undefined,
    },
  };
}

const FALLBACK: AppSettings = {
  siteName: BRAND,
  logoUrl: null,
  faviconUrl: null,
  brandColor: DEFAULT_BRAND_COLOR,
  announcements: { enabled: true, messages: [], intervalMs: 4500 },
  theme: DEFAULT_THEME,
  store: { ...DEFAULT_OFFER },
};

/** Prefer IPv4 loopback — Node `localhost` can hang on ::1 when API is IPv4-only. */
function ssrApiUrl() {
  return API_URL.replace("://localhost:", "://127.0.0.1:");
}

/** Deduped server fetch — one /settings round-trip per render pass. */
export const getCachedSettings = cache(async (): Promise<AppSettings> => {
  try {
    const res = await fetch(`${ssrApiUrl()}/settings`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return FALLBACK;
    const raw = (await res.json()) as Record<string, unknown>;
    return mapSettings(raw);
  } catch {
    return FALLBACK;
  }
});

export function toStoreOfferConfig(settings: AppSettings): StoreOfferConfig {
  const { store } = settings;
  return {
    siteName: store.siteName,
    cashbackRibbonEnabled: store.cashbackRibbonEnabled,
    defaultCashbackLabel: store.defaultCashbackLabel,
    packagingEnabled: store.packagingEnabled,
    packagingText: store.packagingText,
    returnsEnabled: store.returnsEnabled,
    returnsText: store.returnsText,
    cashbackTermsEnabled: store.cashbackTermsEnabled,
    cashbackTerms: store.cashbackTerms,
    walletEnabled: store.walletEnabled,
    cashbackEarnEnabled: store.cashbackEarnEnabled,
    cashbackPercent: store.cashbackPercent,
    whyBrandEnabled: store.whyBrandEnabled,
    whyBrandHappyCustomersEnabled: store.whyBrandHappyCustomersEnabled,
    whyBrandCertifiedEnabled: store.whyBrandCertifiedEnabled,
    whyBrandReturnsEnabled: store.whyBrandReturnsEnabled,
    whyBrandShippingEnabled: store.whyBrandShippingEnabled,
    whyBrandHappyCustomers: store.whyBrandHappyCustomers,
    whyBrandCertified: store.whyBrandCertified,
    whyBrandReturns: store.whyBrandReturns,
    whyBrandShipping: store.whyBrandShipping,
    reviewsOnProductPage: store.reviewsOnProductPage,
    reviewsSlider: store.reviewsSlider,
    reviewsOnCards: store.reviewsOnCards,
    reviewSubmissions: store.reviewSubmissions,
    reviewPhotos: store.reviewPhotos,
    freeShippingAbovePaise: store.freeShippingAbovePaise,
    shippingFlatPaise: store.shippingFlatPaise,
    pricesIncludeTax: store.pricesIncludeTax,
  };
}
