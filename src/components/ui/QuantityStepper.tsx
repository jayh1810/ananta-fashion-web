"use client";

import clsx from "clsx";
import { Minus, Plus } from "lucide-react";

export type QuantityStepperProps = {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
};

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  size = "md",
  disabled,
  className,
}: QuantityStepperProps) {
  const h = size === "sm" ? "h-7" : "h-9";
  const w = size === "sm" ? "w-7" : "w-9";
  return (
    <div
      className={clsx(
        "inline-flex items-center rounded-[var(--radius-sm)] border border-line bg-white",
        h,
        className,
      )}
    >
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={disabled || value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className={clsx("grid h-full place-items-center text-ink disabled:text-subtle", w)}
      >
        <Minus size={14} aria-hidden />
      </button>
      <span className="min-w-7 text-center text-sm font-semibold tabular-nums text-ink" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={disabled || value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className={clsx("grid h-full place-items-center text-ink disabled:text-subtle", w)}
      >
        <Plus size={14} aria-hidden />
      </button>
    </div>
  );
}
