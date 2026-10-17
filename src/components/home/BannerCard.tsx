import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LocalImage } from "@/components/LocalImage";
import { directMediaSrc } from "@/lib/api";

export type BannerCardProps = {
  href: string;
  imageUrl?: string | null;
  imageAlt?: string | null;
  title?: string | null;
  subtitle?: string | null;
  className?: string;
  sizes?: string;
  priority?: boolean;
};

/** Rounded promotional tile: photo, bold caption, white Shop pill. */
export function BannerCard({
  href,
  imageUrl,
  imageAlt,
  title,
  subtitle,
  className = "",
  priority,
}: BannerCardProps) {
  const src = directMediaSrc(imageUrl);
  return (
    <Link
      href={href}
      className={`group relative block overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-card)] ${className}`}
    >
      {src ? (
        <LocalImage
          src={src}
          alt={imageAlt || title || "Offer"}
          priority={priority}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      ) : (
        <span className="absolute inset-0 bg-gradient-to-br from-brand-soft to-white" aria-hidden />
      )}
      {title || subtitle ? (
        <span className="absolute inset-x-0 bottom-0 block bg-gradient-to-t from-black/75 via-black/30 to-transparent px-3.5 pb-3.5 pt-16 text-white">
          {title ? (
            <span className="line-clamp-2 font-heading text-lg font-bold leading-tight">{title}</span>
          ) : null}
          <span className="mt-1 flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-[13px] opacity-90">{subtitle}</span>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-3 py-1 text-[12px] font-semibold text-brand">
              Shop <ArrowRight size={12} aria-hidden />
            </span>
          </span>
        </span>
      ) : null}
    </Link>
  );
}
