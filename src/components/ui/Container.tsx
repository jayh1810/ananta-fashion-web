import clsx from "clsx";
import type { ElementType, HTMLAttributes } from "react";

export type ContainerProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  size?: "md" | "lg" | "full";
};

const SIZES = {
  md: "max-w-6xl",
  lg: "max-w-[1440px]",
  full: "max-w-none",
} as const;

export function Container({ as: Tag = "div", size = "lg", className, ...rest }: ContainerProps) {
  return (
    <Tag className={clsx("mx-auto w-full px-3 sm:px-4 lg:px-6", SIZES[size], className)} {...rest} />
  );
}
