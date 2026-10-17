import { getApiUrl } from "@/lib/api";
import { isLikelySearchCrawler } from "@/lib/is-search-crawler";

const SESSION_KEY = "aa_analytics_sid";
const VISIT_KEY = "aa_store_visit_day";
const USER_KEY = "aa_analytics_uid";

export type AnalyticsEventType =
  | "STORE_VISIT"
  | "PRODUCT_VIEW"
  | "PRODUCT_CLICK"
  | "PRODUCT_SEARCH"
  | "ADD_TO_CART"
  | "BUY_NOW"
  | "CHECKOUT_STARTED"
  | "PAYMENT_INITIATED"
  | "PURCHASE"
  | "PAGE_VIEW"
  | "PAGE_DWELL"
  | "LOGIN_OTP_SENT"
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "COUPON_APPLIED"
  | "COUPON_REMOVED"
  | "WALLET_TOGGLED"
  | "ADDRESS_SELECTED"
  | "CHECKOUT_STEP"
  | "PAYMENT_METHOD_SELECTED";

export type TrackPayload = {
  type: AnalyticsEventType;
  productId?: string;
  slug?: string;
  query?: string;
  path?: string;
  userId?: string;
  meta?: Record<string, unknown>;
};

function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getAnalyticsSessionId() {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = uuid();
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return uuid();
  }
}

/** Remember logged-in customer id for journey attribution. */
export function setAnalyticsUserId(userId?: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (userId) localStorage.setItem(USER_KEY, userId);
    else localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
}

export function getAnalyticsUserId() {
  if (typeof window === "undefined") return undefined;
  try {
    return localStorage.getItem(USER_KEY) || undefined;
  } catch {
    return undefined;
  }
}

/** Fire-and-forget event tracking (never throws to UI). */
export function track(events: TrackPayload | TrackPayload[]) {
  if (typeof window === "undefined") return;
  if (isLikelySearchCrawler()) return;
  const list = (Array.isArray(events) ? events : [events]).filter(Boolean);
  if (!list.length) return;

  const sessionId = getAnalyticsSessionId();
  const userId = getAnalyticsUserId();
  const body = {
    events: list.map((e) => ({
      type: e.type,
      productId: e.productId,
      slug: e.slug,
      query: e.query,
      path: e.path || window.location.pathname,
      sessionId,
      userId: e.userId || userId,
      referrer: document.referrer || undefined,
      userAgent: navigator.userAgent,
      meta: e.meta,
    })),
  };

  const url = `${getApiUrl()}/analytics/track`;
  const json = JSON.stringify(body);

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([json], { type: "application/json" });
      if (navigator.sendBeacon(url, blob)) return;
    }
  } catch {
    /* fall through */
  }

  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: json,
    keepalive: true,
  }).catch(() => {});
}

/** Once per calendar day per browser. */
export function trackStoreVisitOnce() {
  if (typeof window === "undefined") return;
  const day = new Date().toISOString().slice(0, 10);
  try {
    if (sessionStorage.getItem(VISIT_KEY) === day) return;
    sessionStorage.setItem(VISIT_KEY, day);
  } catch {
    /* still track */
  }
  track({ type: "STORE_VISIT", path: window.location.pathname });
}

export function trackProductView(product: { id: string; slug: string }) {
  track({
    type: "PRODUCT_VIEW",
    productId: product.id,
    slug: product.slug,
  });
}

export function trackProductClick(product: { id: string; slug: string }) {
  track({
    type: "PRODUCT_CLICK",
    productId: product.id,
    slug: product.slug,
  });
}

export function trackSearch(query: string) {
  const q = query.trim();
  if (!q) return;
  track({ type: "PRODUCT_SEARCH", query: q });
}

export function trackAddToCartEvent(opts: {
  productId: string;
  slug?: string;
  title?: string;
  quantity?: number;
  value?: number;
  source?: string;
}) {
  track({
    type: "ADD_TO_CART",
    productId: opts.productId,
    slug: opts.slug,
    meta: {
      title: opts.title,
      quantity: opts.quantity ?? 1,
      value: opts.value,
      source: opts.source || "cart",
    },
  });
}

export function trackBuyNowEvent(opts: {
  productId: string;
  slug?: string;
  title?: string;
  quantity?: number;
  value?: number;
}) {
  track({
    type: "BUY_NOW",
    productId: opts.productId,
    slug: opts.slug,
    meta: {
      title: opts.title,
      quantity: opts.quantity ?? 1,
      value: opts.value,
    },
  });
}

export function trackCheckoutStarted(opts?: {
  itemCount?: number;
  value?: number;
  freeShipping?: boolean;
  shippingTotal?: number;
  phone?: string;
  email?: string;
}) {
  track({
    type: "CHECKOUT_STARTED",
    meta: {
      itemCount: opts?.itemCount,
      value: opts?.value,
      freeShipping: opts?.freeShipping,
      shippingTotal: opts?.shippingTotal,
      phone: opts?.phone,
      email: opts?.email,
    },
  });
}

export function trackPaymentInitiated(opts?: {
  orderId?: string;
  orderNumber?: string;
  value?: number;
  paymentMode?: string;
  paymentMethod?: string;
  phone?: string;
  email?: string;
  couponCode?: string;
  couponDiscount?: number;
  walletRedeem?: number;
  freeShipping?: boolean;
  shippingTotal?: number;
  itemCount?: number;
  toPay?: number;
}) {
  track({
    type: "PAYMENT_INITIATED",
    meta: {
      orderId: opts?.orderId,
      orderNumber: opts?.orderNumber,
      value: opts?.value,
      paymentMode: opts?.paymentMode,
      paymentMethod: opts?.paymentMethod,
      phone: opts?.phone,
      email: opts?.email,
      couponCode: opts?.couponCode,
      couponDiscount: opts?.couponDiscount,
      walletRedeem: opts?.walletRedeem,
      freeShipping: opts?.freeShipping,
      shippingTotal: opts?.shippingTotal,
      itemCount: opts?.itemCount,
      toPay: opts?.toPay,
    },
  });
}

export function trackPurchaseEvent(opts?: {
  orderId?: string;
  orderNumber?: string;
  value?: number;
  paymentMode?: string;
  phone?: string;
  email?: string;
  couponCode?: string;
  couponDiscount?: number;
  walletRedeem?: number;
  freeShipping?: boolean;
  itemCount?: number;
}) {
  track({
    type: "PURCHASE",
    meta: {
      orderId: opts?.orderId,
      orderNumber: opts?.orderNumber,
      value: opts?.value,
      paymentMode: opts?.paymentMode,
      phone: opts?.phone,
      email: opts?.email,
      couponCode: opts?.couponCode,
      couponDiscount: opts?.couponDiscount,
      walletRedeem: opts?.walletRedeem,
      freeShipping: opts?.freeShipping,
      itemCount: opts?.itemCount,
    },
  });
}

export function trackLoginOtpSent(opts: {
  phone: string;
  source?: string;
}) {
  track({
    type: "LOGIN_OTP_SENT",
    meta: {
      phone: opts.phone,
      source: opts.source || "login",
    },
  });
}

export function trackLoginSuccess(opts: {
  phone: string;
  userId?: string;
  source?: string;
}) {
  track({
    type: "LOGIN_SUCCESS",
    userId: opts.userId,
    meta: {
      phone: opts.phone,
      source: opts.source || "login",
    },
  });
}

export function trackLoginFailed(opts: {
  phone: string;
  reason?: string;
  source?: string;
}) {
  track({
    type: "LOGIN_FAILED",
    meta: {
      phone: opts.phone,
      reason: opts.reason,
      source: opts.source || "login",
      // Never store OTP codes
    },
  });
}

export function trackCouponApplied(opts: {
  code: string;
  label?: string;
  amount?: number;
  subtotal?: number;
}) {
  track({
    type: "COUPON_APPLIED",
    meta: {
      couponCode: opts.code,
      label: opts.label,
      couponDiscount: opts.amount,
      value: opts.subtotal,
    },
  });
}

export function trackCouponRemoved(opts?: { code?: string }) {
  track({
    type: "COUPON_REMOVED",
    meta: { couponCode: opts?.code },
  });
}

export function trackWalletToggled(opts: {
  enabled: boolean;
  balance?: number;
  redeem?: number;
  saveAmount?: number;
  toPay?: number;
}) {
  track({
    type: "WALLET_TOGGLED",
    meta: {
      enabled: opts.enabled,
      walletBalance: opts.balance,
      walletRedeem: opts.redeem,
      saveAmount: opts.saveAmount,
      toPay: opts.toPay,
    },
  });
}

export function trackAddressSelected(opts: {
  city?: string;
  state?: string;
  pincode?: string;
  label?: string;
  name?: string;
  phone?: string;
  email?: string;
  isNew?: boolean;
}) {
  track({
    type: "ADDRESS_SELECTED",
    meta: {
      city: opts.city,
      state: opts.state,
      pincode: opts.pincode,
      label: opts.label,
      name: opts.name,
      phone: opts.phone,
      email: opts.email,
      isNew: opts.isNew,
    },
  });
}

export function trackCheckoutStep(opts: {
  step: string;
  from?: string;
}) {
  track({
    type: "CHECKOUT_STEP",
    meta: {
      step: opts.step,
      from: opts.from,
    },
  });
}

export function trackPaymentMethodSelected(opts: {
  method: string;
  paymentMode?: string;
}) {
  track({
    type: "PAYMENT_METHOD_SELECTED",
    meta: {
      paymentMethod: opts.method,
      paymentMode: opts.paymentMode,
    },
  });
}

export function trackPageView(path?: string) {
  track({ type: "PAGE_VIEW", path: path || window.location.pathname });
}

export function trackPageDwell(opts: {
  path: string;
  durationMs: number;
}) {
  const sec = Math.round(opts.durationMs / 1000);
  if (sec < 1) return;
  track({
    type: "PAGE_DWELL",
    path: opts.path,
    meta: { durationMs: opts.durationMs, durationSec: sec },
  });
}
