import Link from "next/link";
import clsx from "clsx";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";

export type ButtonVariant = "primary" | "outline" | "dark" | "ghost" | "link";
export type ButtonSize = "sm" | "md" | "lg";

type StyleProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-white hover:bg-brand-hover active:bg-brand-hover shadow-sm",
  outline:
    "border border-brand text-brand bg-white hover:bg-brand-soft",
  dark: "bg-ink text-white hover:bg-black",
  ghost: "text-ink hover:bg-surface",
  link: "text-brand hover:underline underline-offset-2 px-0 h-auto",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-[15px] gap-2",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth,
  className,
}: Pick<StyleProps, "variant" | "size" | "fullWidth"> & { className?: string }) {
  return clsx(
    "inline-flex items-center justify-center rounded-[var(--radius-md)] font-semibold leading-none whitespace-nowrap transition-colors select-none",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-1",
    "disabled:opacity-50 disabled:pointer-events-none",
    VARIANTS[variant],
    variant !== "link" && SIZES[size],
    fullWidth && "w-full",
    className,
  );
}

export type ButtonProps = StyleProps & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  variant,
  size,
  fullWidth,
  leftIcon,
  rightIcon,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, fullWidth, className })}
      {...rest}
    >
      {leftIcon}
      {children}
      {rightIcon}
    </button>
  );
}

export type ButtonLinkProps = StyleProps & ComponentProps<typeof Link>;

export function ButtonLink({
  variant,
  size,
  fullWidth,
  leftIcon,
  rightIcon,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link
      className={buttonClasses({ variant, size, fullWidth, className })}
      {...rest}
    >
      {leftIcon}
      {children}
      {rightIcon}
    </Link>
  );
}
