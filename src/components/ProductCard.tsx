"use client";

import { LocalImage } from "@/components/LocalImage";
import Link from "next/link";
import type { Product } from "@/lib/api";
import { formatINR } from "@/lib/api";
import { useStoreOffer } from "@/components/StoreOfferProvider";
import { useCart } from "@/lib/cart";
import { trackProductClick } from "@/lib/analytics";
import { warmProductHero } from "@/lib/product-hero-image";
import { FreeCornerBadge, FreePriceLabel } from "@/components/FreeProductBadge";
import { isUsableImageSrc } from "@/lib/is-usable-image-src";
import { productImageDetail } from "@/lib/product-image-seo";
import { WishlistButton } from "@/components/WishlistButton";
import { PriceTag, RatingBadge } from "@/components/ui";

function parseCashbackRibbon(raw: string) {
  const text = raw.trim();
  const amountMatch = text.match(/(₹\s?[\d,]+|\d+\s?%?)/);
  const amount = amountMatch?.[1]?.replace(/\s+/g, "") || "₹500";
  const hasCashback = /cashback/i.test(text);
  const after = text
    .replace(amountMatch?.[0] || "", "")
    .replace(/cashback/i, "")
    .replace(/^[\s,:-]+/, "")
    .trim();
  const sub = after
    ? after.toLowerCase().startsWith("on ")
      ? after
      : `on ${after.replace(/^on\s+/i, "")}`
    : "on all prepaid order";
  return {
    amount,
    label: hasCashback ? "CASHBACK" : "OFFER",
    sub,
  };
}

function tagTone(tag: string) {
  const t = tag.toLowerCase();
  if (/best|top|trend|popular/.test(t)) return "text-success";
  if (/new|launch|just in/.test(t)) return "text-[#0f6ad8]";
  return "text-brand";
}

export function ProductCard({
  product,
  imagePriority = false,
  prefetch = true,
  layout = "grid",
}: {
  product: Product;
  /** `list` = image left, details right (collection list view). */
  layout?: "grid" | "list";
  /** Set for above-the-fold cards to improve LCP. */
  imagePriority?: boolean;
  /** Disable on home/collection grids to avoid mass route prefetch. */
  prefetch?: boolean;
  /** Hint for Next/Image — keep card thumbs small. */
  imageSizes?: string;
}) {
  const addItem = useCart((s) => s.addItem);
  const {
    cashbackRibbonEnabled,
    cashbackEarnEnabled,
    defaultCashbackLabel,
    reviewsOnCards,
  } = useStoreOffer();
  const ribbonRaw =
    cashbackEarnEnabled && cashbackRibbonEnabled && product.showCashbackRibbon
      ? (product.cashbackRibbon || defaultCashbackLabel || "").trim()
      : "";
  const ribbon = ribbonRaw ? parseCashbackRibbon(ribbonRaw) : null;
  /** Catalog price stays in `price` when free — show that as the struck “was” amount. */
  const freeWasPrice = product.isFreeProduct
    ? Math.max(product.compareAt || 0, product.price || 0)
    : 0;

  const cardImage = isUsableImageSrc(product.image) ? product.image! : "";
  const cardAlt =
    productImageDetail(product, cardImage).altText ||
    product.seo?.primaryImageAlt?.trim() ||
    product.title;
  const list = layout === "list";
  const tag = product.badge?.trim() || (product.isBestSeller ? "BESTSELLER" : "");
  const brandName = product.brand?.name?.trim();
  const gridTitle =
    brandName && !product.title.toLowerCase().startsWith(brandName.toLowerCase())
      ? `${brandName} ${product.title}`
      : product.title;

  return (
    <article
      className={`group relative flex h-full overflow-hidden bg-white transition-shadow ${
        list
          ? "flex-row rounded-[var(--radius-md)] border border-line hover:shadow-[var(--shadow-pop)]"
          : "flex-col rounded-[var(--radius-sm)] hover:shadow-[0_2px_14px_rgba(0,0,0,0.12)]"
      }`}
    >
      {!list ? (
        <div className="flex h-7 items-center gap-2.5 px-2.5 pr-10 text-[10px] font-semibold uppercase tracking-wide sm:h-8 sm:px-3 sm:text-[11px]">
          {tag && !product.isFreeProduct ? (
            <span className={`truncate ${tagTone(tag)}`}>{tag}</span>
          ) : null}
        </div>
      ) : null}
      <Link
        href={`/products/${product.slug}`}
        prefetch={prefetch}
        onPointerEnter={() => {
          if (cardImage) warmProductHero(cardImage);
        }}
        onClick={() => {
          if (cardImage) warmProductHero(cardImage);
          trackProductClick({ id: product.id, slug: product.slug });
        }}
        className={`relative block aspect-square overflow-hidden ${
          list
            ? "m-2 w-[38%] max-w-[220px] shrink-0 self-start rounded-[var(--radius-sm)] bg-surface-alt sm:m-3"
            : "mx-2.5 bg-white sm:mx-3"
        }`}
      >
        {cardImage ? (
          <LocalImage
            src={cardImage}
            alt={cardAlt}
            priority={imagePriority}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="h-full w-full bg-surface" />
        )}

        {product.isFreeProduct ? <FreeCornerBadge /> : null}

        {ribbon ? (
          <span className="clip-cashback-ribbon absolute left-1.5 top-0 z-10 flex w-[46px] flex-col items-center bg-brand pb-2.5 pt-1 text-center leading-[1.05] text-white shadow-sm sm:left-3 sm:w-[68px] sm:pb-3.5 sm:pt-1.5">
            <span className="px-0.5 text-[9px] font-extrabold tracking-tight sm:text-[12px]">
              {ribbon.amount}
            </span>
            <span className="px-0.5 text-[7px] font-extrabold uppercase tracking-wide sm:text-[9px]">
              {ribbon.label}
            </span>
            <span className="mt-px px-0.5 text-[5.5px] font-semibold leading-tight opacity-90 sm:text-[7.5px]">
              {ribbon.sub}
            </span>
          </span>
        ) : list && tag && !product.isFreeProduct ? (
          <span className="absolute left-0 top-2 z-10 rounded-r-[var(--radius-sm)] bg-ink px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            {tag}
          </span>
        ) : null}

        {product.soldOut && (
          <span className="absolute inset-x-0 bottom-0 bg-white/90 py-1.5 text-center text-xs font-semibold uppercase tracking-wide text-muted">
            Out of stock
          </span>
        )}
      </Link>

      {!list ? (
        <WishlistButton product={product} className="absolute right-2 top-2 z-10" size={16} />
      ) : null}

      <div
        className={`flex min-w-0 flex-1 flex-col gap-1 ${
          list
            ? "py-3 pr-3 sm:py-4 sm:pr-4"
            : "items-center px-2.5 pb-3 pt-3 text-center sm:px-4"
        }`}
      >
        {list && brandName ? (
          <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted">
            {brandName}
          </span>
        ) : null}
        <Link
          href={`/products/${product.slug}`}
          prefetch={prefetch}
          onClick={() =>
            trackProductClick({ id: product.id, slug: product.slug })
          }
          className={`line-clamp-2 min-h-[2.6em] leading-[1.3] text-ink hover:text-brand ${
            list ? "text-[13px] sm:text-[14px]" : "text-[13px] font-medium sm:text-[14px]"
          }`}
        >
          {list ? product.title : gridTitle}
        </Link>

        {product.isFreeProduct ? (
          <div
            className={`mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 ${
              list ? "" : "justify-center"
            }`}
          >
            <FreePriceLabel />
            {freeWasPrice > 0 && (
              <span className="text-[12px] text-muted line-through tabular-nums sm:text-[13px]">
                {formatINR(freeWasPrice)}
              </span>
            )}
            {freeWasPrice > 0 && (
              <span className="text-[12px] font-semibold text-success">100% Off</span>
            )}
          </div>
        ) : (
          <PriceTag
            price={product.price}
            compareAt={product.compareAt}
            size="sm"
            className={list ? "mt-0.5" : "mt-0.5 justify-center"}
          />
        )}

        {reviewsOnCards ? (
          <RatingBadge
            rating={product.rating}
            count={product.reviews}
            variant={list ? "pill" : "stars"}
            className="mt-0.5"
          />
        ) : null}
        <span className="min-h-1.5 flex-1" aria-hidden />

        <button
          type="button"
          disabled={product.soldOut}
          onClick={() => {
            addItem(
              product.isFreeProduct
                ? { ...product, price: 0 }
                : product,
            );
          }}
          className={`mt-auto inline-flex h-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-brand px-3 text-[13px] font-semibold text-white transition-[background-color,opacity] hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-surface disabled:text-subtle ${
            list
              ? "w-full sm:w-auto sm:self-start sm:px-8"
              : "w-full lg:pointer-fine:opacity-0 lg:pointer-fine:focus-visible:opacity-100 lg:pointer-fine:group-hover:opacity-100 lg:pointer-fine:group-focus-within:opacity-100"
          }`}
        >
          {product.soldOut ? "Out of stock" : "Add to Bag"}
        </button>
        {list ? (
          <WishlistButton product={product} variant="inline" className="mt-2 self-start" size={16} />
        ) : null}
      </div>
    </article>
  );
}
