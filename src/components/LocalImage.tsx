import { directMediaSrc } from "@/lib/api";

/** Plain image tag. Local uploads load from `/uploads/...` on this site. */
export function LocalImage({
  src,
  alt,
  className = "absolute inset-0 h-full w-full object-cover",
  priority = false,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  const href = directMediaSrc(src);
  if (!href) return null;
  return (
    <img
      src={href}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={className}
    />
  );
}
