export type ShippingConfig = {
  enabled: boolean;
  freeAbovePaise: number;
  flatRatePaise: number;
  freeProductShippingPaise: number;
  label: string;
};

export type TaxConfig = {
  enabled: boolean;
  gstPercent: number;
  inclusive: boolean;
  label: string;
};

/** Mirrors api OrdersService.getShippingTaxSettings / buildLines (paise → ₹). */
export const DEFAULT_SHIPPING: ShippingConfig = {
  enabled: true,
  freeAbovePaise: 99900,
  flatRatePaise: 4900,
  freeProductShippingPaise: 5000,
  label: "Standard shipping",
};

export const DEFAULT_TAX: TaxConfig = {
  enabled: false,
  gstPercent: 0,
  inclusive: true,
  label: "GST",
};

/** `/settings` → shipping block with the same fallbacks checkout uses. */
export function shippingFromSettings(
  s: Partial<ShippingConfig> | null | undefined,
): ShippingConfig {
  if (!s) return DEFAULT_SHIPPING;
  return {
    ...DEFAULT_SHIPPING,
    ...s,
    enabled: s.enabled !== false,
    freeAbovePaise:
      typeof s.freeAbovePaise === "number"
        ? s.freeAbovePaise
        : DEFAULT_SHIPPING.freeAbovePaise,
    flatRatePaise:
      typeof s.flatRatePaise === "number"
        ? s.flatRatePaise
        : DEFAULT_SHIPPING.flatRatePaise,
    freeProductShippingPaise:
      typeof s.freeProductShippingPaise === "number"
        ? s.freeProductShippingPaise
        : DEFAULT_SHIPPING.freeProductShippingPaise,
  };
}

/** `/settings` → tax block with the same fallbacks checkout uses. */
export function taxFromSettings(
  t: Partial<TaxConfig> | null | undefined,
): TaxConfig {
  if (!t) return DEFAULT_TAX;
  return {
    ...DEFAULT_TAX,
    ...t,
    enabled: t.enabled === true,
    gstPercent:
      typeof t.gstPercent === "number" ? t.gstPercent : DEFAULT_TAX.gstPercent,
    inclusive: t.inclusive !== false,
  };
}

export function computeCheckoutTotals(
  subtotalRupees: number,
  couponDiscountRupees: number,
  shipping: ShippingConfig,
  tax: TaxConfig,
  opts?: { freeProductsOnly?: boolean },
) {
  const afterDiscountPaise = Math.round(
    Math.max(0, subtotalRupees - couponDiscountRupees) * 100,
  );
  const shippingTotalPaise = opts?.freeProductsOnly
    ? Math.max(0, shipping.freeProductShippingPaise || 0)
    : !shipping.enabled || afterDiscountPaise >= shipping.freeAbovePaise
      ? 0
      : Math.max(0, shipping.flatRatePaise);

  let taxTotalPaise = 0;
  if (tax.enabled && tax.gstPercent > 0) {
    if (tax.inclusive) {
      taxTotalPaise = Math.round(
        (afterDiscountPaise * tax.gstPercent) / (100 + tax.gstPercent),
      );
    } else {
      taxTotalPaise = Math.round(
        (afterDiscountPaise * tax.gstPercent) / 100,
      );
    }
  }

  const grandTotalPaise =
    afterDiscountPaise +
    shippingTotalPaise +
    (tax.enabled && !tax.inclusive ? taxTotalPaise : 0);

  return {
    merchandise: Math.round(afterDiscountPaise / 100),
    shippingTotal: Math.round(shippingTotalPaise / 100),
    taxTotal: Math.round(taxTotalPaise / 100),
    toPay: Math.round(grandTotalPaise / 100),
    freeShipping: shippingTotalPaise === 0,
    amountToFreeShipping: opts?.freeProductsOnly
      ? 0
      : Math.max(
          0,
          Math.round((shipping.freeAbovePaise - afterDiscountPaise) / 100),
        ),
  };
}
