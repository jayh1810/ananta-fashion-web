"use client";

import { useEffect, useState } from "react";
import { useSiteBranding } from "@/lib/site-branding";
import { SiteLogoImage } from "@/components/SiteLogoImage";

/** Small circular avatar for byline rows — shows the real store logo when
 * available, falling back to the author's initials only if no logo is set. */
export function AuthorAvatar({
  name,
  size = 24,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const logoUrl = useSiteBranding((s) => s.logoUrl);
  const ensureLoaded = useSiteBranding((s) => s.ensureLoaded);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void ensureLoaded();
  }, [ensureLoaded]);

  const initials = name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (logoUrl && !failed) {
    return (
      <SiteLogoImage
        src={logoUrl}
        size={size}
        className={`shrink-0 rounded-full object-cover bg-bhagva/10 ${className}`}
        onFailed={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full bg-bhagva font-bold text-white ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      aria-hidden
    >
      {initials}
    </span>
  );
}
