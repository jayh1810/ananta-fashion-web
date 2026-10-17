import clsx from "clsx";
import type { HTMLAttributes } from "react";

export type BadgeTone = "brand" | "success" | "offer" | "neutral" | "dark" | "outline";

const TONES: Record<BadgeTone, string> = {
  brand: "bg-brand text-white",
  success: "bg-success-soft text-success",
  offer: "bg-offer/10 text-offer",
  neutral: "bg-surface text-text",
  dark: "bg-ink text-white",
  outline: "border border-line text-text bg-white",
};

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  size?: "xs" | "sm";
};

export function Badge({ tone = "neutral", size = "xs", className, ...rest }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-[var(--radius-sm)] font-semibold leading-none whitespace-nowrap",
        size === "xs" ? "px-1.5 py-1 text-[10px]" : "px-2 py-1.5 text-xs",
        TONES[tone],
        className,
      )}
      {...rest}
    />
  );
}
