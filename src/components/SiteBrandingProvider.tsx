"use client";

import { useEffect, useRef } from "react";
import {
  hydrateSiteBranding,
  useSiteBranding,
  type CacheShape,
} from "@/lib/site-branding";
import { applyBrandColorToDocument } from "@/lib/brand-color";

/** Seeds branding from the server so header/footer never flash "AF". */
export function SiteBrandingProvider({
  initial,
  children,
}: {
  initial: CacheShape;
  children: React.ReactNode;
}) {
  const seeded = useRef(false);
  if (!seeded.current) {
    hydrateSiteBranding(initial);
    seeded.current = true;
  }

  const ensureLoaded = useSiteBranding((s) => s.ensureLoaded);
  const brandColor = useSiteBranding((s) => s.brandColor);

  useEffect(() => {
    void ensureLoaded();
  }, [ensureLoaded]);

  useEffect(() => {
    applyBrandColorToDocument(brandColor);
  }, [brandColor]);

  return <>{children}</>;
}
