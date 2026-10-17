"use client";

import clsx from "clsx";
import { Heart } from "lucide-react";
import type { MouseEvent } from "react";
import type { Product } from "@/lib/api";
import { useWishlist } from "@/lib/wishlist";
import { useHydrated } from "@/lib/useHydrated";
import { toast } from "@/components/Toast";

export function WishlistButton({
  product,
  className,
  size = 18,
  variant = "floating",
}: {
  product: Product;
  className?: string;
  size?: number;
  /** floating = round button over an image · inline = bordered square next to CTAs */
  variant?: "floating" | "inline";
}) {
  const hydrated = useHydrated();
  const saved = useWishlist((s) => hydrated && s.items.some((i) => i.id === product.id));
  const toggle = useWishlist((s) => s.toggle);

  function onClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const added = toggle(product);
    toast(added ? "Added to wishlist" : "Removed from wishlist");
  }

  return (
    <button
      type="button"
      aria-label={saved ? "Remove from wishlist" : "Add to wishlist"}
      aria-pressed={saved}
      onClick={onClick}
      className={clsx(
        "grid place-items-center transition-colors",
        variant === "floating"
          ? "h-8 w-8 rounded-full bg-white/90 shadow-sm hover:bg-white"
          : "h-12 w-12 rounded-[var(--radius-md)] border border-line bg-white hover:border-brand",
        className,
      )}
    >
      <Heart
        size={size}
        strokeWidth={1.8}
        className={saved ? "fill-brand text-brand" : "text-ink"}
        aria-hidden
      />
    </button>
  );
}
