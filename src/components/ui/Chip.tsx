import clsx from "clsx";
import type { ButtonHTMLAttributes } from "react";

export type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
};

/** Selectable pill for sizes, filters and sort options. */
export function Chip({ selected, className, type = "button", ...rest }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={clsx(
        "inline-flex min-h-8 items-center justify-center gap-1 rounded-full border px-3 text-xs font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:line-through",
        selected
          ? "border-brand bg-brand-soft text-brand"
          : "border-line bg-white text-text hover:border-line-strong",
        className,
      )}
      {...rest}
    />
  );
}
