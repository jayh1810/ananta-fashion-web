"use client";

import { useEffect, useRef } from "react";
import { useSiteBranding } from "@/lib/site-branding";

const OWNED_ICON = "site-brand-favicon";
const OWNED_APPLE = "site-brand-apple-icon";

/** Only touch links we own — never remove Next/React head icons. */
function applyFavicon(url: string) {
  if (!url || typeof document === "undefined") return;

  let icon = document.getElementById(OWNED_ICON) as HTMLLinkElement | null;
  if (!icon) {
    icon = document.createElement("link");
    icon.id = OWNED_ICON;
    icon.rel = "icon";
    icon.type = "image/png";
    document.head.appendChild(icon);
  }
  if (icon.getAttribute("href") !== url) icon.href = url;

  let apple = document.getElementById(OWNED_APPLE) as HTMLLinkElement | null;
  if (!apple) {
    apple = document.createElement("link");
    apple.id = OWNED_APPLE;
    apple.rel = "apple-touch-icon";
    document.head.appendChild(apple);
  }
  if (apple.getAttribute("href") !== url) apple.href = url;
}

export function DynamicFavicon() {
  const faviconUrl = useSiteBranding((s) => s.faviconUrl);
  const ensureLoaded = useSiteBranding((s) => s.ensureLoaded);
  const appliedRef = useRef("");

  useEffect(() => {
    void ensureLoaded();
  }, [ensureLoaded]);

  useEffect(() => {
    if (!faviconUrl || faviconUrl === appliedRef.current) return;
    appliedRef.current = faviconUrl;
    applyFavicon(faviconUrl);
  }, [faviconUrl]);

  return null;
}
