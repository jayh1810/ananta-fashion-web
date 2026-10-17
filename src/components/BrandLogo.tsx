"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BRAND } from "@/lib/api";
import { useSiteBranding } from "@/lib/site-branding";
import { SiteLogoImage } from "@/components/SiteLogoImage";

type BrandLogoProps = {
  name?: string;
  tagline?: string;
  href?: string | null;
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  className?: string;
  dark?: boolean;
  /** Override admin logo URL when passed explicitly */
  logoUrl?: string | null;
};

const SIZE = {
  sm: { mark: 36, title: "text-base", gap: "gap-2.5" },
  md: { mark: 44, title: "text-xl", gap: "gap-3" },
  lg: { mark: 56, title: "text-2xl sm:text-[1.75rem]", gap: "gap-3.5" },
} as const;

function AaFallback({ size }: { size: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand font-extrabold text-white"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.32) }}
      aria-hidden
    >
      AF
    </span>
  );
}

export function BrandLogo({
  name,
  tagline,
  href = "/",
  size = "md",
  showWordmark = true,
  className = "",
  dark = false,
  logoUrl: logoUrlProp,
}: BrandLogoProps) {
  const siteName = useSiteBranding((s) => s.siteName);
  const storeLogoUrl = useSiteBranding((s) => s.logoUrl);
  const brandingLoaded = useSiteBranding((s) => s.loaded);
  const ensureLoaded = useSiteBranding((s) => s.ensureLoaded);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void ensureLoaded();
  }, [ensureLoaded]);

  useEffect(() => {
    setFailed(false);
  }, [logoUrlProp, storeLogoUrl]);

  const logoUrl = logoUrlProp ?? storeLogoUrl;
  const brandName = name || siteName || BRAND;
  const s = SIZE[size];
  const titleColor = dark ? "text-white" : "text-[#1C1410]";
  const tagColor = dark ? "text-white/65" : "text-[#8A7355]";
  const showLogo = Boolean(logoUrl) && !failed;
  const showAa = brandingLoaded && (!logoUrl || failed);

  const inner = (
    <span className={`inline-flex items-center ${s.gap} ${className}`}>
      {showLogo && logoUrl ? (
        <SiteLogoImage
          src={logoUrl}
          size={s.mark}
          className="shrink-0 rounded-full object-cover bg-[var(--bhagva)]/30"
          onFailed={() => setFailed(true)}
        />
      ) : showAa ? (
        <AaFallback size={s.mark} />
      ) : (
        <span
          className="inline-flex shrink-0 rounded-full bg-[var(--bhagva)]/40"
          style={{ width: s.mark, height: s.mark }}
          aria-hidden
        />
      )}
      {showWordmark ? (
        <span className="min-w-0 text-left leading-tight">
          <span
            className={`block font-sans font-extrabold tracking-tight ${s.title} ${titleColor}`}
          >
            {brandName}
          </span>
          {tagline ? (
            <span
              className={`mt-0.5 block text-[10px] font-bold uppercase tracking-[0.16em] ${tagColor}`}
            >
              {tagline}
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center no-underline">
        {inner}
      </Link>
    );
  }
  return inner;
}
