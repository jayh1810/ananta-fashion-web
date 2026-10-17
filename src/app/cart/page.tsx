"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Minus, Plus, ShoppingBag, Tag, X } from "lucide-react";
import { useCart, cartLineKey, maxOrderQty, CART_MAX_QTY_PER_PRODUCT } from "@/lib/cart";
import { api, formatINR, formatOfferLabel } from "@/lib/api";
import { getCartAddonBreakdown, getAddonUpsellPricing } from "@/lib/product-packs";
import { AccountShell } from "@/components/AccountShell";
import { useHydrated } from "@/lib/useHydrated";
import { CodUnlockUpsell } from "@/components/CodUnlockUpsell";
import { FreePriceLabel } from "@/components/FreeProductBadge";
import { FreeGiftRows } from "@/components/FreeGiftRows";
import { useFreeGiftPreview } from "@/lib/free-gifts";
import { useStoreOffer } from "@/components/StoreOfferProvider";

function CartContent() {
  const hydrated = useHydrated();
  const offer = useStoreOffer();
  const {
    items,
    updateQty,
    removeItem,
    setSiddhAddon,
    subtotal,
    compareTotal,
    saved,
    openCheckout,
    lastStockMessage,
    clearStockMessage,
  } = useCart();
  const freeGifts = useFreeGiftPreview(items);
  const [partialCodMin, setPartialCodMin] = useState(0);
  const [partialCodEnabled, setPartialCodEnabled] = useState(false);

  useEffect(() => {
    api<{
      payment?: {
        partialCod?: {
          enabled?: boolean;
          minAdvanceAmount?: number;
          fixedAmount?: number;
        };
      };
    }>("/settings")
      .then((s) => {
        const pcod = s.payment?.partialCod;
        setPartialCodEnabled(pcod?.enabled === true);
        setPartialCodMin(
          Math.max(
            0,
            Math.round(
              Number(pcod?.minAdvanceAmount ?? pcod?.fixedAmount) || 0,
            ),
          ),
        );
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!lastStockMessage) return;
    const t = window.setTimeout(() => clearStockMessage(), 5000);
    return () => window.clearTimeout(t);
  }, [lastStockMessage, clearStockMessage]);

  if (!hydrated) {
    return (
      <div>
        <div className="flex items-start gap-3 mb-6">
          <span className="mt-0.5 h-10 w-10 rounded-xl bg-surface text-text grid place-items-center shrink-0">
            <ShoppingBag size={18} strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="text-xl font-bold text-ink">My Cart</h2>
            <p className="text-sm text-muted mt-0.5">Loading cart…</p>
          </div>
        </div>
      </div>
    );
  }

  const total = subtotal();
  const compare = compareTotal();
  const savings = saved();

  return (
    <div>
      <div className="flex items-start gap-3 mb-5 sm:mb-6">
        <span className="mt-0.5 h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-surface text-text grid place-items-center shrink-0">
          <ShoppingBag size={18} strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-bold text-ink">
            My Cart ({items.length})
          </h2>
          <p className="text-xs sm:text-sm text-muted mt-0.5">
            Review items before checkout
          </p>
        </div>
      </div>

      {lastStockMessage && (
        <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-sm text-amber-950 flex items-start justify-between gap-2 shadow-sm">
          <span className="leading-snug font-medium">{lastStockMessage}</span>
          <button
            type="button"
            className="shrink-0 font-bold text-amber-900"
            onClick={clearStockMessage}
          >
            OK
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-center py-14 border border-dashed border-line-strong rounded-xl bg-surface-alt">
          <p className="text-muted mb-4">Your cart is currently empty</p>
          <Link
            href="/collections/all"
            className="inline-block bg-brand text-white px-6 py-3 rounded-[var(--radius-sm)] text-sm font-bold hover:bg-brand-hover"
          >
            Continue shopping
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] lg:grid-cols-[1fr_280px] gap-4 sm:gap-5">
          <div className="space-y-4 min-w-0">
          <ul className="bg-surface-alt rounded-xl border border-line divide-y divide-[#EDE8DF]">
            {items.map(({ product, quantity }) => {
              const max = maxOrderQty(product);
              const atMax = quantity >= max;
              const addon = getCartAddonBreakdown(product);
              const hasLinkedUpsell = items.some(
                (i) =>
                  i.product.isAddonUpsell &&
                  i.product.addonParentId === product.id,
              );
              const upsellPricing = product.isAddonUpsell
                ? getAddonUpsellPricing(product, quantity)
                : null;
              const offerBadge = product.isFreeProduct
                ? "100% OFF"
                : formatOfferLabel(
                    product.isAddonUpsell
                      ? upsellPricing!.comboPrice
                      : addon.selected
                        ? addon.baseUnitPrice
                        : product.price,
                    product.compareAt,
                    product.extraOfferLabel,
                  );
              const mainLineTotal = product.isAddonUpsell
                ? upsellPricing!.lineTotal
                : addon.selected
                  ? addon.baseUnitPrice * quantity
                  : product.price * quantity;
              return (
                <li key={cartLineKey(product)} className="p-3 sm:p-4 space-y-3">
                  <div className="flex gap-3 sm:gap-4">
                  <Link
                    href={`/products/${product.slug}`}
                    className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-surface flex-shrink-0"
                  >
                    <Image
                      src={product.image}
                      alt={product.title}
                      fill
                      className="object-cover"
                      sizes="96px"
                    />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between gap-2">
                      <Link
                        href={`/products/${product.slug}`}
                        className="font-bold text-sm hover:opacity-80 line-clamp-2 min-w-0"
                      >
                        {product.title}
                      </Link>
                      <button
                        type="button"
                        onClick={() =>
                          removeItem(
                            product.id,
                            product.variantId,
                            product.siddhAddonSelected,
                          )
                        }
                        className="text-subtle hover:text-black shrink-0"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <p className="text-[12px] text-text mt-1 font-medium">
                      {max > 0
                        ? product.stock != null &&
                          product.stock < CART_MAX_QTY_PER_PRODUCT
                          ? `${max} in stock`
                          : `Max ${CART_MAX_QTY_PER_PRODUCT} per product`
                        : "Out of stock"}
                    </p>
                    {addon.available &&
                    !addon.selected &&
                    !product.isAddonUpsell &&
                    !hasLinkedUpsell ? (
                      <button
                        type="button"
                        className="mt-1.5 w-full rounded-lg border border-dashed border-line-strong bg-surface-alt px-2.5 py-2 text-left text-[12px] font-bold text-[#9a3412]"
                        onClick={() =>
                          setSiddhAddon(product.id, product.variantId, true)
                        }
                      >
                        + Add {addon.name} · {formatINR(addon.perParentQty)}
                      </button>
                    ) : null}
                    {offerBadge ? (
                      <span className="mt-1.5 inline-flex items-center gap-1 rounded bg-success text-white text-[10px] font-bold px-1.5 py-0.5">
                        <Tag size={10} /> {offerBadge}
                      </span>
                    ) : null}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="inline-flex flex-col gap-1">
                        <div className="inline-flex items-center border border-line-strong rounded-md bg-white">
                          <button
                            type="button"
                            className="px-2.5 py-1.5"
                            onClick={() =>
                              updateQty(
                                product.id,
                                quantity - 1,
                                product.variantId,
                                product.siddhAddonSelected,
                              )
                            }
                          >
                            <Minus size={14} />
                          </button>
                          <span className="px-3 text-sm font-semibold">
                            {quantity}
                          </span>
                          <button
                            type="button"
                            disabled={atMax}
                            className={`px-2.5 py-1.5 ${
                              atMax ? "opacity-30 cursor-not-allowed" : ""
                            }`}
                            aria-label={
                              product.isFreeProduct
                                ? "Free products are limited to quantity 1"
                                : atMax
                                  ? `Maximum ${CART_MAX_QTY_PER_PRODUCT} per product`
                                  : "Increase quantity"
                            }
                            onClick={() => {
                              if (atMax) {
                                useCart.setState({
                                  lastStockMessage: product.isFreeProduct
                                    ? "Free products are limited to 1 per order."
                                    : product.stock != null &&
                                        product.stock < CART_MAX_QTY_PER_PRODUCT
                                      ? `Only ${max} left in stock for this product.`
                                      : `You can add up to ${CART_MAX_QTY_PER_PRODUCT} units of this product. Limit reached.`,
                                });
                                return;
                              }
                              updateQty(
                                product.id,
                                quantity + 1,
                                product.variantId,
                                product.siddhAddonSelected,
                              );
                            }}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        {upsellPricing && upsellPricing.extraQty > 0 ? (
                          <p className="text-[11px] font-medium text-muted">
                            {upsellPricing.comboQty}×{" "}
                            {formatINR(upsellPricing.comboPrice)} +{" "}
                            {upsellPricing.extraQty}×{" "}
                            {formatINR(upsellPricing.catalogPrice)}
                          </p>
                        ) : product.isAddonUpsell ? (
                          <p className="text-[11px] font-medium text-muted">
                            Combo {formatINR(upsellPricing!.comboPrice)} · extra
                            at {formatINR(upsellPricing!.catalogPrice)}
                          </p>
                        ) : null}
                        {atMax && !product.isFreeProduct ? (
                          <p className="text-[11px] font-semibold text-amber-800">
                            Max {CART_MAX_QTY_PER_PRODUCT} per product reached
                          </p>
                        ) : null}
                      </div>
                      <div className="text-right">
                        <span className="font-bold">
                          {product.isFreeProduct &&
                          addon.baseUnitPrice <= 0 &&
                          !addon.selected ? (
                            <FreePriceLabel size="sm" />
                          ) : (
                            formatINR(mainLineTotal)
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                  </div>

                  {addon.selected ? (
                    <div className="flex gap-3 sm:gap-4 rounded-xl border border-line bg-surface-alt p-3">
                      <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-surface flex-shrink-0">
                        {product.image ? (
                          <Image
                            src={product.image}
                            alt={addon.name}
                            fill
                            className="object-cover"
                            sizes="96px"
                          />
                        ) : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between gap-2">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9a3412]">
                              Add-on
                            </p>
                            <p className="font-bold text-sm line-clamp-2">
                              {addon.name}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setSiddhAddon(
                                product.id,
                                product.variantId,
                                false,
                              )
                            }
                            className="text-subtle hover:text-black shrink-0"
                            aria-label="Remove add-on"
                          >
                            <X size={16} />
                          </button>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-[12px] text-text">
                            Qty {quantity * addon.units}
                          </span>
                          <span className="font-bold">
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
            className="mt-3"
          />
          {items.length > 0 && (
              <CodUnlockUpsell
                minOrderRupees={partialCodEnabled ? partialCodMin : 0}
                cartTotal={total}
                suggestionsOnly={!partialCodEnabled || partialCodMin <= 0}
              />
            )}
          </div>

          <aside className="rounded-xl border border-line overflow-hidden h-fit bg-white">
            {savings > 0 && (
              <div className="bg-success text-white text-center text-sm font-semibold py-2.5">
                {formatINR(savings)} Saved so far!
              </div>
            )}
            <div className="p-5 space-y-4">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <div className="flex items-baseline gap-2">
                  {compare > total && (
                    <span className="text-subtle line-through text-xs">
                      {formatINR(compare)}
                    </span>
                  )}
                  <span className="font-bold text-base">
                    {formatINR(total)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={openCheckout}
                className="w-full text-center bg-brand text-white rounded-[var(--radius-sm)] py-3.5 text-sm font-bold uppercase tracking-wide hover:bg-brand-hover"
              >
                Select Address
              </button>
              {offer.cashbackEarnEnabled && offer.cashbackPercent > 0 ? (
                <p className="text-center text-[11px] text-muted">
                  {offer.cashbackPercent}% cashback on prepaid orders
                </p>
              ) : null}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

export default function CartPage() {
  return (
    <AccountShell requireAuth={false}>
      <CartContent />
    </AccountShell>
  );
}
