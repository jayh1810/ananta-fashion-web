"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart, Trash2 } from "lucide-react";
import { mediaUrl } from "@/lib/api";
import { useWishlist } from "@/lib/wishlist";
import { useHydrated } from "@/lib/useHydrated";
import { ButtonLink, Container, PriceTag } from "@/components/ui";

export function WishlistView() {
  const hydrated = useHydrated();
  const items = useWishlist((s) => s.items);
  const remove = useWishlist((s) => s.remove);
  const list = hydrated ? items : [];

  return (
    <Container className="py-6 sm:py-8">
      <h1 className="section-title mb-1">My Wishlist</h1>
      <p className="mb-5 text-sm text-muted">
        {list.length} item{list.length === 1 ? "" : "s"} saved on this device
      </p>

      {hydrated && list.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[var(--radius-lg)] bg-surface-alt px-6 py-16 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-soft text-brand">
            <Heart size={26} aria-hidden />
          </span>
          <p className="font-semibold text-ink">Your wishlist is empty</p>
          <p className="max-w-sm text-sm text-muted">
            Tap the heart on any product to save it here for later.
          </p>
          <ButtonLink href="/collections/all" className="mt-2">
            Start shopping
          </ButtonLink>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {list.map((item) => (
            <li
              key={item.id}
              className="group relative flex flex-col overflow-hidden rounded-[var(--radius-md)] border border-line bg-white"
            >
              <Link href={`/products/${item.slug}`} className="block">
                <span className="relative block aspect-square bg-surface-alt">
                  {item.image ? (
                    <Image
                      src={mediaUrl(item.image)}
                      alt={item.title}
                      fill
                      sizes="(max-width:640px) 50vw, 20vw"
                      className="object-cover"
                    />
                  ) : null}
                </span>
                <span className="block px-3 pt-2.5">
                  {item.brandName ? (
                    <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted">
                      {item.brandName}
                    </span>
                  ) : null}
                  <span className="mt-0.5 line-clamp-2 min-h-[2.5em] text-[13px] leading-snug text-ink">
                    {item.title}
                  </span>
                </span>
              </Link>
              <div className="mt-auto px-3 pb-3 pt-1.5">
                <PriceTag
                  price={item.price}
                  compareAt={item.compareAt}
                  isFreeProduct={item.isFreeProduct}
                  size="sm"
                />
                <ButtonLink
                  href={`/products/${item.slug}`}
                  variant="outline"
                  size="sm"
                  fullWidth
                  className="mt-2.5"
                >
                  {item.soldOut ? "View product" : "Shop now"}
                </ButtonLink>
              </div>
              <button
                type="button"
                aria-label={`Remove ${item.title} from wishlist`}
                onClick={() => remove(item.id)}
                className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-muted shadow-sm hover:text-danger"
              >
                <Trash2 size={15} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
