"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Info,
  Percent,
  ShoppingBag,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { useCart, cartLineKey, maxOrderQty } from "@/lib/cart";
import { api, BRAND, formatINR, formatOfferLabel } from "@/lib/api";
import { getCartAddonBreakdown, getAddonUpsellPricing } from "@/lib/product-packs";
import { useCustomerAuth } from "@/lib/customer-auth";
import {
  computeCheckoutTotals,
  DEFAULT_SHIPPING,
  DEFAULT_TAX,
  shippingFromSettings,
  taxFromSettings,
  type ShippingConfig,
  type TaxConfig,
} from "@/lib/checkout-totals";
import { WalletUnlockUpsell } from "@/components/WalletUnlockUpsell";
import { CodUnlockUpsell } from "@/components/CodUnlockUpsell";
import { FreePriceLabel } from "@/components/FreeProductBadge";
import { FreeGiftRows } from "@/components/FreeGiftRows";
import {
  AddedToCartCelebration,
  FreeGiftCelebration,
  useAddedToCartCelebration,
  useFreeGiftCelebration,
} from "@/components/FreeGiftCelebration";
import { useFreeGiftPreview } from "@/lib/free-gifts";

const DEFAULT_CART_PROMO = {
  cartPromoEnabled: true,
  cartPromoText: "",
  cartPromoRight: "",
  /** @deprecated Line items use per-product formatOfferLabel — not this. */
  cartItemBadge: "",
};

type WalletHint = {
  enabled: boolean;
  cashbackEarnEnabled: boolean;
  balance: number;
  redeemPercent: number;
  cashbackPercent: number;
  redeemMinOrderRupees: number;
};

export function CartDrawer() {
  const {
    items,
    isOpen,
    closeCart,
    openCheckout,
    updateQty,
    removeItem,
    setSiddhAddon,
    subtotal,
    compareTotal,
    saved,
    count,
    lastStockMessage,
    clearStockMessage,
    lastAdded,
  } = useCart();
  const { token, openLogin } = useCustomerAuth();
  const freeGifts = useFreeGiftPreview(items, isOpen);
  const giftCelebration = useFreeGiftCelebration(freeGifts.gifts, freeGifts.ready);
  const addedCelebration = useAddedToCartCelebration(
    isOpen ? lastAdded : null,
    !!giftCelebration.burst,
  );
  const total = subtotal();
  const compare = compareTotal();
  const savings = saved();
  const itemCount = count();
  const freeProductsOnly =
    items.length > 0 && items.every((i) => !!i.product.isFreeProduct);
  const [cartPromo, setCartPromo] = useState(DEFAULT_CART_PROMO);
  const [wallet, setWallet] = useState<WalletHint | null>(null);
  const [partialCodMin, setPartialCodMin] = useState(0);
  const [partialCodEnabled, setPartialCodEnabled] = useState(false);
  const [shipping, setShipping] = useState<ShippingConfig>(DEFAULT_SHIPPING);
  const [tax, setTax] = useState<TaxConfig>(DEFAULT_TAX);
  const [couponCount, setCouponCount] = useState(0);
  const [priceOpen, setPriceOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    api<{
      payment?: Partial<typeof DEFAULT_CART_PROMO> & {
        partialCod?: {
          enabled?: boolean;
          percent?: number;
          minAdvanceAmount?: number;
          fixedAmount?: number;
        };
        coupons?: unknown[];
      };
      shipping?: Partial<ShippingConfig>;
      tax?: Partial<TaxConfig>;
    }>("/settings")
      .then((s) => {
        const p = s.payment || {};
        setCartPromo({
          cartPromoEnabled: p.cartPromoEnabled !== false,
          cartPromoText: p.cartPromoText?.trim() || "",
          cartPromoRight: p.cartPromoRight?.trim() || "",
          cartItemBadge: "",
        });
        const pcod = p.partialCod;
        setPartialCodEnabled(pcod?.enabled === true);
        setPartialCodMin(
          Math.max(
            0,
            Math.round(
              Number(pcod?.minAdvanceAmount ?? pcod?.fixedAmount) || 0,
            ),
          ),
        );
        setCouponCount(Array.isArray(p.coupons) ? p.coupons.length : 0);
        setShipping(shippingFromSettings(s.shipping));
        setTax(taxFromSettings(s.tax));
      })
      .catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !token) {
      setWallet(null);
      return;
    }
    api<{
      enabled: boolean;
      cashbackEarnEnabled?: boolean;
      balance: number;
      redeemPercentOfBalance: number;
      cashbackPercent: number;
      redeemMinOrderRupees: number;
    }>("/wallet", { token })
      .then((w) => {
        setWallet({
          enabled: w.enabled === true,
          cashbackEarnEnabled: w.cashbackEarnEnabled === true,
          balance: w.balance || 0,
          redeemPercent: w.redeemPercentOfBalance || 20,
          cashbackPercent: w.cashbackPercent || 0,
          redeemMinOrderRupees: Math.max(
            0,
            Number(w.redeemMinOrderRupees) || 0,
          ),
        });
      })
      .catch(() => setWallet(null));
  }, [isOpen, token]);

  useEffect(() => {
    if (!lastStockMessage) return;
    const t = window.setTimeout(() => clearStockMessage(), 5000);
    return () => window.clearTimeout(t);
  }, [lastStockMessage, clearStockMessage]);

  useEffect(() => {
    if (!isOpen) return;

    const html = document.documentElement;
    const body = document.body;
    const scrollY = window.scrollY;
    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
      bodyPaddingRight: body.style.paddingRight,
    };

    // Hide page scrollbar (often on <html>) and freeze background scroll.
    const scrollbarGap = Math.max(0, window.innerWidth - html.clientWidth);
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    if (scrollbarGap > 0) {
      body.style.paddingRight = `${scrollbarGap}px`;
    }

    return () => {
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      body.style.position = prev.bodyPosition;
      body.style.top = prev.bodyTop;
      body.style.left = prev.bodyLeft;
      body.style.right = prev.bodyRight;
      body.style.width = prev.bodyWidth;
      body.style.paddingRight = prev.bodyPaddingRight;
      // "instant": html has scroll-behavior:smooth, which would animate this jump.
      window.scrollTo({ top: scrollY, left: 0, behavior: "instant" });
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const walletShortfall =
    wallet &&
    wallet.enabled &&
    wallet.balance > 0 &&
    wallet.redeemMinOrderRupees > 0 &&
    total < wallet.redeemMinOrderRupees
      ? Math.ceil(wallet.redeemMinOrderRupees - total)
      : 0;

  const walletReady =
    !!wallet &&
    wallet.enabled &&
    wallet.balance > 0 &&
    (wallet.redeemMinOrderRupees <= 0 || total >= wallet.redeemMinOrderRupees);

  const maxWalletSave = walletReady
    ? Math.min(
        wallet!.balance,
        Math.floor((total * (wallet!.redeemPercent || 20)) / 100),
      )
    : 0;

  const walletUpsellShowing =
    !!wallet &&
    wallet.enabled &&
    wallet.balance > 0 &&
    wallet.redeemMinOrderRupees > 0;
  const codBelowMin =
    partialCodEnabled && partialCodMin > 0 && total <= partialCodMin;
  const showCodUpsell = items.length > 0 && (codBelowMin || !walletUpsellShowing);

  const totals = computeCheckoutTotals(total, 0, shipping, tax, {
    freeProductsOnly,
  });
  const bagMrp = Math.max(compare, total);
  const taxAddedOnTop = tax.enabled && !tax.inclusive && totals.taxTotal > 0;

  function requestLogin() {
    closeCart();
    openLogin();
  }

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden overscroll-none">
      <div className="absolute inset-0 bg-black/45" onClick={closeCart} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Shopping bag"
        className="cart-drawer-panel absolute right-0 top-0 bottom-0 flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden bg-[var(--page-band)] shadow-2xl"
        style={{ maxWidth: 420 }}
      >
        <FreeGiftCelebration
          burst={giftCelebration.burst}
          onDismiss={giftCelebration.dismiss}
        />
        <AddedToCartCelebration
          burst={addedCelebration.burst}
          onDismiss={addedCelebration.dismiss}
        />

        <div className="flex items-center gap-3 border-b border-line bg-white px-4 py-3.5">
          <button
            type="button"
            onClick={closeCart}
            className="-ml-1 grid h-9 w-9 place-items-center rounded-full text-ink hover:bg-surface"
            aria-label="Close cart"
          >
            <ArrowLeft size={22} />
          </button>
          <h2 className="flex min-w-0 items-baseline gap-2">
            <span className="font-heading text-[22px] font-bold leading-none text-ink">
              Bag
            </span>
            <span className="text-[14px] text-muted">
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </span>
          </h2>
          <Link
            href="/wishlist"
            onClick={closeCart}
            className="ml-auto text-[14px] font-semibold text-brand hover:underline"
          >
            View Wishlist
          </Link>
        </div>

        {lastStockMessage && (
          <div className="mx-3 mt-3 flex items-start justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-950 shadow-sm">
            <span className="font-medium leading-snug">{lastStockMessage}</span>
            <button
              type="button"
              className="shrink-0 font-bold text-amber-900"
              onClick={clearStockMessage}
            >
              OK
            </button>
          </div>
        )}

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-3">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-4 pb-10 text-center">
              <span className="grid h-20 w-20 place-items-center rounded-full bg-white text-brand">
                <ShoppingBag size={34} strokeWidth={1.6} />
              </span>
              <p className="text-[17px] font-semibold text-ink">Your bag is empty</p>
              <p className="text-[13px] text-muted">
                Looks like you haven&apos;t added anything yet.
              </p>
              <Link
                href="/collections/all"
                onClick={closeCart}
                className="mt-1 rounded-[var(--radius-sm)] bg-brand px-6 py-3 text-sm font-semibold text-white hover:bg-brand-hover"
              >
                Start shopping
              </Link>
            </div>
          ) : (
            <>
              {!token ? (
                <div className="rounded-lg border border-line bg-white p-3">
                  <p className="text-[14px] text-text">
                    Get started &amp; grab best offers!
                  </p>
                  <button
                    type="button"
                    onClick={requestLogin}
                    className="mt-2 h-9 w-full rounded-[var(--radius-sm)] border border-line-strong text-[14px] font-semibold text-brand hover:border-brand"
                  >
                    Login / Register
                  </button>
                </div>
              ) : null}

              {cartPromo.cartPromoEnabled && cartPromo.cartPromoText ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-brand/20 bg-brand-soft px-3 py-2 text-[11px] font-semibold">
                  <span className="line-clamp-2 text-brand">
                    {cartPromo.cartPromoText}
                  </span>
                  {cartPromo.cartPromoRight ? (
                    <span className="shrink-0 whitespace-nowrap text-muted">
                      {cartPromo.cartPromoRight}
                    </span>
                  ) : null}
                </div>
              ) : null}

              <ul className="space-y-3">
                {items.map(({ product, quantity }) => {
                  const max = maxOrderQty(product);
                  const qtyOptions = Array.from(
                    { length: Math.max(max, quantity, 1) },
                    (_, i) => i + 1,
                  );
                  const offerBadge = product.isFreeProduct
                    ? "100% OFF"
                    : formatOfferLabel(
                        product.price,
                        product.compareAt,
                        product.extraOfferLabel,
                      );
                  const hasLinkedUpsell = items.some(
                    (i) =>
                      i.product.isAddonUpsell &&
                      i.product.addonParentId === product.id,
                  );
                  const showSiddh =
                    !product.isAddonUpsell &&
                    !hasLinkedUpsell &&
                    !!product.siddhAddonEnabled &&
                    typeof product.siddhAddonPrice === "number" &&
                    product.siddhAddonPrice > 0;
                  const addon = getCartAddonBreakdown(product);
                  const upsellPricing = product.isAddonUpsell
                    ? getAddonUpsellPricing(product, quantity)
                    : null;
                  const mainLineTotal = product.isAddonUpsell
                    ? upsellPricing!.lineTotal
                    : addon.selected
                      ? addon.baseUnitPrice * quantity
                      : product.price * quantity;
                  const mainCompare = product.isAddonUpsell
                    ? upsellPricing!.compareTotal
                    : product.compareAt > product.price
                      ? Math.max(
                          0,
                          (product.compareAt -
                            (addon.selected ? addon.perParentQty : 0)) *
                            quantity,
                        )
                      : 0;
                  return (
                    <li key={cartLineKey(product)} className="space-y-2">
                      <div className="rounded-lg border border-line bg-white p-3">
                        <div className="flex gap-3">
                          <Link
                            href={`/products/${product.slug}`}
                            onClick={closeCart}
                            className="relative h-[84px] w-[84px] shrink-0 overflow-hidden rounded-md bg-surface"
                          >
                            {product.image ? (
                              <Image
                                src={product.image}
                                alt={product.title}
                                fill
                                className="object-cover"
                                sizes="84px"
                              />
                            ) : null}
                          </Link>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <Link
                                href={`/products/${product.slug}`}
                                onClick={closeCart}
                                className="line-clamp-2 text-[14px] leading-snug text-ink"
                              >
                                {product.title}
                              </Link>
                              <button
                                type="button"
                                className="shrink-0 p-0.5 text-muted hover:text-danger"
                                onClick={() =>
                                  removeItem(
                                    product.id,
                                    product.variantId,
                                    product.siddhAddonSelected,
                                  )
                                }
                                aria-label={`Remove ${product.title}`}
                              >
                                <Trash2 size={17} strokeWidth={1.75} />
                              </button>
                            </div>
                            {product.isAddonUpsell ? (
                              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#9a3412]">
                                Add-on
                              </p>
                            ) : null}

                            <label className="mt-2 inline-flex items-center gap-1 text-[14px] text-ink">
                              Quantity :
                              <span className="relative inline-flex items-center">
                                <select
                                  value={quantity}
                                  disabled={qtyOptions.length < 2}
                                  onChange={(e) =>
                                    updateQty(
                                      product.id,
                                      Number(e.target.value),
                                      product.variantId,
                                      product.siddhAddonSelected,
                                    )
                                  }
                                  aria-label={`Quantity for ${product.title}`}
                                  className="cursor-pointer appearance-none bg-transparent pl-1 pr-5 font-medium outline-none disabled:cursor-default"
                                >
                                  {qtyOptions.map((n) => (
                                    <option key={n} value={n}>
                                      {n}
                                    </option>
                                  ))}
                                </select>
                                {qtyOptions.length > 1 ? (
                                  <ChevronDown
                                    size={16}
                                    className="pointer-events-none absolute right-0"
                                    aria-hidden
                                  />
                                ) : null}
                              </span>
                            </label>
                            {upsellPricing && upsellPricing.extraQty > 0 ? (
                              <p className="text-[10px] font-medium leading-snug text-muted">
                                {upsellPricing.comboQty}×{" "}
                                {formatINR(upsellPricing.comboPrice)}
                                {" + "}
                                {upsellPricing.extraQty}×{" "}
                                {formatINR(upsellPricing.catalogPrice)}
                              </p>
                            ) : product.isAddonUpsell ? (
                              <p className="text-[10px] font-medium text-muted">
                                Combo {formatINR(upsellPricing?.comboPrice || product.price)}
                                {" · "}extra at{" "}
                                {formatINR(
                                  upsellPricing?.catalogPrice ||
                                    product.compareAt ||
                                    product.price,
                                )}
                              </p>
                            ) : null}

                            {showSiddh && !addon.selected ? (
                              <button
                                type="button"
                                className="mt-2 w-full rounded-md border border-dashed border-line-strong bg-surface-alt px-2.5 py-2 text-left text-[12px] font-bold text-[#9a3412]"
                                onClick={() =>
                                  setSiddhAddon(
                                    product.id,
                                    product.variantId,
                                    true,
                                  )
                                }
                              >
                                + Add {addon.name} · {formatINR(addon.perParentQty)}
                              </button>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-2.5">
                          <span className="inline-flex items-center gap-1 text-[14px] font-semibold text-ink">
                            You Pay
                          </span>
                          <span className="flex items-baseline gap-1.5">
                            {product.isFreeProduct &&
                            addon.baseUnitPrice <= 0 &&
                            !addon.selected ? (
                              <FreePriceLabel size="sm" />
                            ) : (
                              <span className="text-[15px] font-semibold text-ink tabular-nums">
                                {formatINR(mainLineTotal)}
                              </span>
                            )}
                            {mainCompare > mainLineTotal ? (
                              <span className="text-[12px] text-subtle line-through tabular-nums">
                                {formatINR(mainCompare)}
                              </span>
                            ) : null}
                            {offerBadge ? (
                              <span className="text-[13px] font-semibold text-success">
                                {offerBadge}
                              </span>
                            ) : null}
                          </span>
                        </div>
                      </div>

                      {addon.selected ? (
                        <div className="flex gap-3 rounded-lg border border-line bg-white p-3">
                          <div className="relative h-[64px] w-[64px] shrink-0 overflow-hidden rounded-md bg-surface">
                            {(product.siddhAddonProduct?.image ||
                              product.image) ? (
                              <Image
                                src={
                                  product.siddhAddonProduct?.image ||
                                  product.image
                                }
                                alt={addon.name}
                                fill
                                className="object-cover"
                                sizes="64px"
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9a3412]">
                                  Add-on
                                </p>
                                <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-ink">
                                  {addon.name}
                                </p>
                                {addon.units > 1 ? (
                                  <p className="mt-0.5 text-[11px] text-muted">
                                    {formatINR(addon.unit)} × {addon.units}
                                    {quantity > 1
                                      ? ` × ${quantity}`
                                      : ""}
                                  </p>
                                ) : null}
                              </div>
                              <button
                                type="button"
                                className="shrink-0 text-subtle hover:text-black"
                                onClick={() =>
                                  setSiddhAddon(
                                    product.id,
                                    product.variantId,
                                    false,
                                  )
                                }
                                aria-label="Remove add-on"
                              >
                                <X size={14} />
                              </button>
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-2">
                              <span className="text-[12px] font-medium text-text">
                                Qty {quantity * addon.units}
                              </span>
                              <span className="text-sm font-semibold text-ink">
                                {formatINR(addon.perParentQty * quantity)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>

              <FreeGiftRows
                gifts={freeGifts.gifts}
                unavailable={freeGifts.unavailable}
                highlightIds={giftCelebration.highlightIds}
              />

              {showCodUpsell && (
                <CodUnlockUpsell
                  minOrderRupees={partialCodEnabled ? partialCodMin : 0}
                  cartTotal={total}
                  suggestionsOnly={!partialCodEnabled || partialCodMin <= 0}
                />
              )}

              {wallet &&
                wallet.enabled &&
                wallet.balance > 0 &&
                wallet.redeemMinOrderRupees > 0 && (
                <WalletUnlockUpsell
                  balance={wallet.balance}
                  minOrderRupees={wallet.redeemMinOrderRupees}
                  cartTotal={total}
                  redeemPercent={wallet.redeemPercent}
                />
              )}

              {walletReady &&
                maxWalletSave > 0 &&
                (wallet?.redeemMinOrderRupees || 0) <= 0 && (
                <div className="flex items-start gap-2.5 rounded-lg border border-[#A7F3D0] bg-gradient-to-br from-[#ECFDF5] to-white p-3.5">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                    <Wallet size={15} />
                  </span>
                  <div>
                    <p className="text-[13px] font-bold text-success">
                      Wallet ready · save up to {formatINR(maxWalletSave)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-success">
                      Balance {formatINR(wallet!.balance)} · redeem up to{" "}
                      {wallet!.redeemPercent}% of product total at checkout
                    </p>
                  </div>
                </div>
              )}

              {couponCount > 0 && !freeProductsOnly ? (
                <button
                  type="button"
                  onClick={openCheckout}
                  className="flex w-full items-center gap-3 rounded-lg border border-line bg-white p-3.5 text-left hover:border-brand/40"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-brand-soft text-brand">
                    <Percent size={16} strokeWidth={2.25} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-ink">
                      Coupons
                    </span>
                    <span className="block text-[13px] text-brand">
                      Apply at checkout and save extra!
                    </span>
                  </span>
                  <ChevronRight size={20} className="text-brand" aria-hidden />
                </button>
              ) : null}

              <div className="rounded-lg border border-line bg-white">
                <button
                  type="button"
                  onClick={() => setPriceOpen((v) => !v)}
                  aria-expanded={priceOpen}
                  className="flex w-full items-center gap-2 p-3.5 text-left"
                >
                  <span className="flex-1 text-[15px] font-semibold text-ink">
                    Price details
                  </span>
                  <span className="text-[17px] font-bold text-ink tabular-nums">
                    {formatINR(totals.toPay)}
                  </span>
                  <ChevronDown
                    size={18}
                    className={`text-ink transition-transform ${priceOpen ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </button>
                {priceOpen ? (
                  <dl className="space-y-2 border-t border-line px-3.5 py-3 text-[13px]">
                    <div className="flex justify-between">
                      <dt className="text-text">Bag MRP ({itemCount} {itemCount === 1 ? "item" : "items"})</dt>
                      <dd className="tabular-nums text-ink">{formatINR(bagMrp)}</dd>
                    </div>
                    {savings > 0 ? (
                      <div className="flex justify-between">
                        <dt className="text-text">Bag Discount</dt>
                        <dd className="tabular-nums text-success">
                          -{formatINR(savings)}
                        </dd>
                      </div>
                    ) : null}
                    <div className="flex justify-between">
                      <dt className="text-text">Shipping</dt>
                      <dd className="tabular-nums">
                        {totals.shippingTotal > 0 ? (
                          <span className="text-ink">{formatINR(totals.shippingTotal)}</span>
                        ) : (
                          <span className="font-semibold text-success">Free</span>
                        )}
                      </dd>
                    </div>
                    {taxAddedOnTop ? (
                      <div className="flex justify-between">
                        <dt className="text-text">{tax.label || "GST"}</dt>
                        <dd className="tabular-nums text-ink">
                          {formatINR(totals.taxTotal)}
                        </dd>
                      </div>
                    ) : null}
                    <div className="flex justify-between border-t border-dashed border-line pt-2 text-[14px] font-semibold">
                      <dt className="text-ink">You Pay</dt>
                      <dd className="tabular-nums text-ink">{formatINR(totals.toPay)}</dd>
                    </div>
                    <p className="flex items-start gap-1 pt-1 text-[11px] text-muted">
                      <Info size={12} className="mt-0.5 shrink-0" aria-hidden />
                      Coupons and wallet can be applied at checkout.
                    </p>
                  </dl>
                ) : null}
                {!totals.freeShipping && totals.amountToFreeShipping > 0 ? (
                  <p className="border-t border-line px-3.5 py-2.5 text-[12px] text-text">
                    Add{" "}
                    <span className="font-semibold text-ink">
                      {formatINR(totals.amountToFreeShipping)}
                    </span>{" "}
                    more for <span className="font-semibold text-success">FREE shipping</span>
                  </p>
                ) : null}
              </div>
            </>
          )}
        </div>

        {items.length > 0 && (
          <div className="bg-white shadow-[0_-8px_24px_rgba(0,0,0,0.06)]">
            {savings > 0 && (
              <div className="bg-success-soft py-2 text-center text-[14px] text-ink">
                You are saving{" "}
                <span className="font-semibold text-success">{formatINR(savings)}</span>{" "}
                on this order
              </div>
            )}
            {walletShortfall > 0 && (
              <p className="mx-4 mt-2.5 rounded-lg border border-[#FDE68A] bg-brand-soft px-2.5 py-1.5 text-center text-[11px] font-semibold text-[#92400E]">
                Add {formatINR(walletShortfall)} more to use your cashback
                wallet
              </p>
            )}
            <div className="flex items-center gap-4 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[22px] font-bold leading-tight text-ink tabular-nums">
                  {formatINR(totals.toPay)}
                </p>
                <p className="text-[12px] text-muted">Grand Total</p>
              </div>
              <button
                type="button"
                onClick={openCheckout}
                className="flex h-12 flex-1 items-center justify-between gap-2 rounded-[var(--radius-sm)] bg-brand px-4 text-[16px] font-semibold text-white transition-colors hover:bg-brand-hover"
              >
                Proceed
                <ArrowRight size={20} aria-hidden />
              </button>
            </div>
            {wallet?.enabled &&
            wallet.cashbackEarnEnabled &&
            wallet.cashbackPercent > 0 &&
            !freeProductsOnly ? (
              <p className="px-4 pb-3 text-center text-[11px] text-muted">
                {wallet.cashbackPercent}% cashback on prepaid orders · {BRAND}
              </p>
            ) : null}
          </div>
        )}
      </aside>
    </div>
  );
}
