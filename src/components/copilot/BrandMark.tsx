"use client";

import { useState } from "react";
import { useSiteBranding } from "@/lib/site-branding";
import { SiteLogoImage } from "@/components/SiteLogoImage";

/** Store logo from Admin → Settings, or the same "AF" brand mark the header falls back to. */
export function BrandMark({ size, className = "" }: { size: number; className?: string }) {
  const logoUrl = useSiteBranding((s) => s.logoUrl);
  const [failed, setFailed] = useState(false);
  if (logoUrl && !failed) {
    return (
      <span
        className={`inline-flex shrink-0 self-start items-center justify-center overflow-hidden rounded-full bg-white leading-none ${className}`}
        style={{ width: size, height: size, padding: Math.max(1, Math.round(size * 0.06)) }}
      >
        <SiteLogoImage
          src={logoUrl}
          size={size}
          className="h-full w-full object-contain"
          onFailed={() => setFailed(true)}
        />
      </span>
    );
  }
  return (
    <span
      className={`inline-flex shrink-0 self-start items-center justify-center rounded-full bg-brand font-bold text-white ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.36)) }}
      aria-hidden
    >
      AF
    </span>
  );
}
