import clsx from "clsx";
import { discountPercent, formatProductPrice, formatINR } from "@/lib/api";

export type PriceTagProps = {
  price: number;
  compareAt?: number | null;
  isFreeProduct?: boolean;
  size?: "sm" | "md" | "lg";
  /** Show "MRP:" label before the struck-through price (PDP style). */
  mrpLabel?: boolean;
  className?: string;
};

const SIZES = {
  sm: { price: "text-sm", mrp: "text-xs", off: "text-xs" },
  md: { price: "text-base", mrp: "text-sm", off: "text-sm" },
  lg: { price: "text-2xl", mrp: "text-base", off: "text-base" },
} as const;

/** Selling price · struck MRP · green "% Off" — only shows a discount when compareAt is real. */
export function PriceTag({
  price,
  compareAt,
  isFreeProduct,
  size = "md",
  mrpLabel,
  className,
}: PriceTagProps) {
  const s = SIZES[size];
  const mrp = compareAt && compareAt > price ? compareAt : 0;
  const off = mrp ? discountPercent(price, mrp) : 0;

  return (
    <div className={clsx("flex flex-wrap items-baseline gap-x-2 gap-y-0.5", className)}>
      {mrp > 0 && mrpLabel && <span className={clsx(s.mrp, "text-muted")}>MRP:</span>}
      {mrp > 0 && (
        <span className={clsx(s.mrp, "text-muted line-through")}>{formatINR(mrp)}</span>
      )}
      <span className={clsx(s.price, "font-semibold text-ink tabular-nums")}>
        {formatProductPrice(price, isFreeProduct)}
      </span>
      {off > 0 && (
        <span className={clsx(s.off, "font-semibold text-success")}>{off}% Off</span>
      )}
    </div>
  );
}
