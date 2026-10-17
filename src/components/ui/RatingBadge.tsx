import clsx from "clsx";
import { Star } from "lucide-react";

export type RatingBadgeProps = {
  rating?: number | null;
  count?: number | null;
  className?: string;
  /** `stars` = five outline/filled stars + count (listing cards). */
  variant?: "pill" | "stars";
};

/** Renders nothing unless there is a real average rating from at least one review. */
export function RatingBadge({ rating, count, className, variant = "pill" }: RatingBadgeProps) {
  if (!rating || rating <= 0 || !count || count <= 0) return null;
  const label = (
    <span className="sr-only">
      Rated {rating.toFixed(1)} out of 5 from {count} reviews
    </span>
  );
  if (variant === "stars") {
    const filled = Math.round(Math.min(5, rating));
    return (
      <span className={clsx("inline-flex items-center gap-1 text-xs", className)}>
        <span className="inline-flex items-center gap-px text-ink" aria-hidden>
          {Array.from({ length: 5 }, (_, i) => (
            <Star
              key={i}
              size={13}
              strokeWidth={1.75}
              className={i < filled ? "fill-current" : ""}
            />
          ))}
        </span>
        <span className="text-muted" aria-hidden>
          ({count.toLocaleString("en-IN")})
        </span>
        {label}
      </span>
    );
  }
  return (
    <span className={clsx("inline-flex items-center gap-1.5 text-xs", className)}>
      <span className="inline-flex items-center gap-0.5 rounded-[var(--radius-sm)] bg-rating px-1.5 py-0.5 font-semibold text-white">
        {rating.toFixed(1)}
        <Star size={10} className="fill-current" aria-hidden />
      </span>
      <span className="text-muted">({count.toLocaleString("en-IN")})</span>
      {label}
    </span>
  );
}
