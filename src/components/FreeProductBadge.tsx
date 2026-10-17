/** Storefront free-product labels — quiet, consistent chips (not loud “promo sticker” style). */

export function FreeCornerBadge({
  className = "",
}: {
  className?: string;
}) {
  return (
    <span
      className={`pointer-events-none absolute top-2 right-2 z-10 rounded bg-[#2F9E5C] px-1.5 py-[3px] text-[10px] font-bold uppercase leading-none tracking-[0.04em] text-white sm:top-2.5 sm:right-2.5 sm:px-2 sm:py-1 sm:text-[11px] ${className}`}
      style={{ boxShadow: "0 0 0 1.5px rgba(255,255,255,0.9)" }}
    >
      Free
    </span>
  );
}

/** Inline price chip next to struck original price */
export function FreePriceLabel({
  size = "md",
}: {
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "lg"
      ? "px-2 py-1 text-[15px] sm:text-[16px]"
      : size === "sm"
        ? "px-1.5 py-0.5 text-[11px]"
        : "px-1.5 py-0.5 text-[12px] sm:text-[13px]";

  return (
    <span
      className={`inline-flex items-center rounded border border-[#A7D9B8] bg-[#EEF8F1] font-bold uppercase tracking-[0.03em] text-[#1F7A45] ${sizeClass}`}
    >
      Free
    </span>
  );
}
