"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type SiteLogoImageProps = {
  src: string;
  alt?: string;
  /** Display size in CSS pixels (square). */
  size: number;
  className?: string;
  /** Above-the-fold logos (header) should use priority. */
  priority?: boolean;
  onFailed?: () => void;
};

/**
 * Brand / site logo via `/_next/image` so Contabo 512² PNGs are resized to
 * display size (WebP/AVIF) and cached — fixes PSI “improve image delivery”.
 */
export function SiteLogoImage({
  src,
  alt = "",
  size,
  className = "",
  priority = false,
  onFailed,
}: SiteLogoImageProps) {
  const [retry, setRetry] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setRetry(0);
    setFailed(false);
  }, [src]);

  if (failed || !src) return null;

  const resolved =
    retry > 0
      ? `${src}${src.includes("?") ? "&" : "?"}r=${retry}`
      : src;

  return (
    <Image
      key={`${resolved}-${retry}`}
      src={resolved}
      alt={alt}
      width={size}
      height={size}
      sizes={`${size}px`}
      quality={75}
      priority={priority}
      className={className}
      onError={() => {
        if (retry < 3) {
          window.setTimeout(
            () => setRetry((n) => n + 1),
            400 * (retry + 1),
          );
          return;
        }
        setFailed(true);
        onFailed?.();
      }}
    />
  );
}
