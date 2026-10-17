import clsx from "clsx";
import type { HTMLAttributes } from "react";

export function Skeleton({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={clsx("animate-pulse rounded-[var(--radius-sm)] bg-surface", className)}
      {...rest}
    />
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 bg-white p-2">
      <Skeleton className="aspect-square w-full" />
      <Skeleton className="h-3.5 w-11/12" />
      <Skeleton className="h-3.5 w-2/3" />
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="mt-1 h-9 w-full" />
    </div>
  );
}
