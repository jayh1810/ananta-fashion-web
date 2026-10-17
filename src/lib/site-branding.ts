"use client";

import { create } from "zustand";
import { api, BRAND, mediaUrl } from "@/lib/api";
import {
  applyBrandColorToDocument,
  DEFAULT_BRAND_COLOR,
  normalizeBrandHex,
} from "@/lib/brand-color";

const CACHE_KEY = "ananta-fashion-branding";

export type SiteBranding = {
  siteName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  brandColor: string;
  loaded: boolean;
  ensureLoaded: () => Promise<void>;
};

export type CacheShape = {
  siteName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  brandColor?: string;
};

function readCache(): CacheShape | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CacheShape;
  } catch {
    return null;
  }
}

function writeCache(data: CacheShape) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota */
  }
}

/** Call from SSR/provider before first paint so logo is present immediately.
 * Does not touch document styles during render (that causes html hydration mismatches).
 */
export function hydrateSiteBranding(initial: CacheShape) {
  const next: CacheShape = {
    siteName: initial.siteName || BRAND,
    logoUrl: mediaUrl(initial.logoUrl) || null,
    faviconUrl: mediaUrl(initial.faviconUrl) || null,
    brandColor: normalizeBrandHex(initial.brandColor),
  };
  useSiteBranding.setState({
    siteName: next.siteName,
    logoUrl: next.logoUrl,
    faviconUrl: next.faviconUrl,
    brandColor: next.brandColor || DEFAULT_BRAND_COLOR,
    loaded: Boolean(next.logoUrl || next.faviconUrl || next.brandColor),
  });
  writeCache(next);
}

let inflight: Promise<void> | null = null;

export const useSiteBranding = create<SiteBranding>((set, get) => ({
  siteName: BRAND,
  logoUrl: null,
  faviconUrl: null,
  brandColor: DEFAULT_BRAND_COLOR,
  loaded: false,
  ensureLoaded: async () => {
    // Sync local cache first (survives refresh; avoids AA flash on client nav)
    const cached = readCache();
    if (cached) {
      const brandColor = normalizeBrandHex(cached.brandColor);
      if (
        !get().logoUrl ||
        !get().faviconUrl ||
        get().brandColor === DEFAULT_BRAND_COLOR
      ) {
        set({
          siteName: cached.siteName || BRAND,
          logoUrl: get().logoUrl || cached.logoUrl,
          faviconUrl: get().faviconUrl || cached.faviconUrl,
          brandColor,
          loaded: true,
        });
        applyBrandColorToDocument(brandColor);
      }
    }

    if (get().loaded && get().logoUrl && get().faviconUrl && get().brandColor) {
      applyBrandColorToDocument(get().brandColor);
      // still refresh from API below when possible
    }
    if (inflight) return inflight;

    inflight = (async () => {
      try {
        const s = await api<{
          siteName?: string;
          logoUrl?: string | null;
          faviconUrl?: string | null;
          store?: { brandColor?: string };
        }>("/settings");
        const brandColor = normalizeBrandHex(s.store?.brandColor);
        const next: CacheShape = {
          siteName: s.siteName || BRAND,
          logoUrl: mediaUrl(s.logoUrl) || null,
          faviconUrl: mediaUrl(s.faviconUrl) || null,
          brandColor,
        };
        set({
          siteName: next.siteName,
          logoUrl: next.logoUrl,
          faviconUrl: next.faviconUrl,
          brandColor,
          loaded: true,
        });
        writeCache(next);
        applyBrandColorToDocument(brandColor);
      } catch {
        applyBrandColorToDocument(get().brandColor);
        if (get().logoUrl || get().faviconUrl) {
          set({ loaded: true });
        }
      } finally {
        inflight = null;
      }
    })();

    return inflight;
  },
}));
