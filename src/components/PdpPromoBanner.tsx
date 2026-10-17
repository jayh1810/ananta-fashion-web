import Image from "next/image";
import Link from "next/link";
import type { PdpBanner } from "@/lib/api";
import { isUsableImageSrc } from "@/lib/is-usable-image-src";

const FALLBACK_W = 1200;
const FALLBACK_H = 670;

export function PdpPromoBanner({
  banner,
  className = "mt-5",
}: {
  banner: PdpBanner;
  /** Outer spacing — pass "" inside a space-y stack. */
  className?: string;
}) {
  if (!isUsableImageSrc(banner.imageUrl)) return null;
  const width = banner.imageWidth || FALLBACK_W;
  const height = banner.imageHeight || FALLBACK_H;
  const alt = banner.imageAlt?.trim() || "Special offer";

  const image = (
    <Image
      src={banner.imageUrl}
      alt={alt}
      title={banner.imageTitle || undefined}
      width={width}
      height={height}
      sizes="(min-width: 1400px) 620px, (min-width: 1024px) 45vw, 100vw"
      className="block h-auto w-full"
    />
  );

  const link = banner.linkUrl?.trim() || "";
  const external = /^https?:\/\//i.test(link);

  return (
    <figure className={className || undefined}>
      <div className="overflow-hidden rounded-2xl border border-[#F5C518]/40 bg-[#FFF9EF] shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
        {link ? (
          external ? (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="block transition-opacity hover:opacity-95"
            >
              {image}
            </a>
          ) : (
            <Link
              href={link}
              prefetch={false}
              className="block transition-opacity hover:opacity-95"
            >
              {image}
            </Link>
          )
        ) : (
          image
        )}
      </div>
      {banner.imageCaption ? (
        <figcaption className="mt-1.5 px-1 text-[12px] leading-snug text-[#6B7280]">
          {banner.imageCaption}
        </figcaption>
      ) : null}
    </figure>
  );
}
