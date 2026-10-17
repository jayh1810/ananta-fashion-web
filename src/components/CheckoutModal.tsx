"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Gift,
  Info,
  Lock,
  MapPin,
  Percent,
  Quote,
  ShieldCheck,
  ShoppingCart,
  Split,
  User,
  Wallet,
  X,
} from "lucide-react";
import { useCart, cartLineKey } from "@/lib/cart";
import { api, BRAND, formatINR } from "@/lib/api";
import { isLikelySearchCrawler } from "@/lib/is-search-crawler";
import { FreePriceLabel } from "@/components/FreeProductBadge";
import { packQuantityFromLabel, getCartAddonBreakdown, getAddonUpsellPricing } from "@/lib/product-packs";
import { useCustomerAuth, type CustomerAddress } from "@/lib/customer-auth";
import { lookupPincode, toTitleCase } from "@/lib/pincode";
import { loadRazorpay, openRazorpayCheckout } from "@/lib/razorpay";
import { WalletUnlockUpsell } from "@/components/WalletUnlockUpsell";
import {
  OrderSuccessPanel,
  type OrderSuccessDetails,
} from "@/components/OrderSuccessPanel";
import { CheckoutOrderSummaryCard } from "@/components/checkout/CheckoutOrderSummaryCard";
import { FreeGiftRows } from "@/components/FreeGiftRows";
import { useFreeGiftPreview } from "@/lib/free-gifts";
import { SiteLogoImage } from "@/components/SiteLogoImage";
import { trackInitiateCheckout, trackPurchase } from "@/lib/meta-pixel";
import {
  trackAddressSelected,
  trackCheckoutStarted,
  trackCheckoutStep,
  trackCouponApplied,
  trackCouponRemoved,
  trackPaymentInitiated,
  trackPaymentMethodSelected,
  trackPurchaseEvent,
  trackWalletToggled,
} from "@/lib/analytics";
import {
  DEFAULT_PARTIAL_COD,
  normalizePartialCodConfig,
  resolvePartialCodAdvanceRupees,
  type PartialCodConfig,
} from "@/lib/partial-cod";
import {
  computeCheckoutTotals,
  DEFAULT_SHIPPING,
  DEFAULT_TAX,
  type ShippingConfig,
  type TaxConfig,
} from "@/lib/checkout-totals";

type Step = "login" | "otp" | "address" | "delivery" | "payment" | "done";
type PayMethod = "RAZORPAY";
type AddressLabel = "Home" | "Work";
type AddressSheetMode = "list" | "form";

type Address = {
  id?: string;
  pincode: string;
  city: string;
  state: string;
  line1: string;
  line2: string;
  name: string;
  email: string;
  label: AddressLabel;
};

type PaymentConfig = {
  methods: Record<string, { enabled: boolean; label: string }>;
  upiVpa: string;
  upiQrUrl: string;
  upiInstructions: string;
  partialCod?: PartialCodConfig;
  prepaidGiftEnabled: boolean;
  prepaidGiftLabel: string;
  prepaidGiftWorth: number;
  prepaidGiftTitle: string;
  promoBanner: string;
  loginPromoBanner: string;
  specialOfferEnabled: boolean;
  specialOfferCode: string;
  specialOfferAmount: number;
  specialOfferTitle: string;
  coupons: { code: string; label: string; amount: number }[];
};

const DEFAULT_PAYMENT: PaymentConfig = {
  methods: {
    RAZORPAY: { enabled: true, label: "Pay Online (Razorpay)" },
  },
  upiVpa: "",
  upiQrUrl: "",
  upiInstructions: "Scan the QR using any UPI App",
  partialCod: { ...DEFAULT_PARTIAL_COD },
  prepaidGiftEnabled: false,
  prepaidGiftLabel: "FREE GIFT",
  prepaidGiftWorth: 0,
  prepaidGiftTitle: "Free gift",
  promoBanner: "",
  loginPromoBanner: "",
  specialOfferEnabled: true,
  specialOfferCode: "GET20",
  specialOfferAmount: 20,
  specialOfferTitle: "Wait! We have a special offer just for you 🥳",
  coupons: [],
};

function FloatingInput({
  label,
  required,
  className = "",
  readOnly,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  required?: boolean;
}) {
  return (
    <label className={`relative block ${className}`}>
      <span className="absolute -top-2 left-3 bg-white px-1 text-[11px] font-medium text-text">
        {label}
        {required ? " *" : ""}
      </span>
      <input
        {...props}
        readOnly={readOnly}
        className={`w-full border border-line-strong rounded-xl px-3.5 py-3 text-sm outline-none bg-white disabled:bg-surface-alt ${
          readOnly
            ? "bg-surface text-text cursor-default focus:border-line-strong"
            : "focus:border-black"
        }`}
      />
    </label>
  );
}

export function CheckoutModal() {
  const {
    items,
    checkoutOpen,
    closeCheckout,
    openCart,
    subtotal,
    compareTotal,
    saved,
    clear,
    count,
  } = useCart();
  const {
    token,
    user,
    openLogin,
    logout: logoutCustomer,
    refreshMe,
  } = useCustomerAuth();

  const [step, setStep] = useState<Step>("login");
  const closingRef = useRef(false);
  const initiateCheckoutTrackedRef = useRef(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    label: string;
    amount: number;
  } | null>(null);
  const [walletInfo, setWalletInfo] = useState<{
    enabled: boolean;
    cashbackEarnEnabled: boolean;
    balance: number;
    redeemPercent: number;
    cashbackPercent: number;
    redeemMinOrderRupees: number;
    creditTiming: "instant" | "on_delivery";
  } | null>(null);
  const [useWallet, setUseWallet] = useState(false);
  const [availableCoupons, setAvailableCoupons] = useState<
    {
      code: string;
      label: string;
      discountType: "PERCENT" | "FIXED";
      value: number;
      minOrderAmount: number | null;
      maxDiscount: number | null;
    }[]
  >([]);
  const [showCoupons, setShowCoupons] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const freeGifts = useFreeGiftPreview(items, checkoutOpen);
  const [updatesOptIn, setUpdatesOptIn] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [orderSuccess, setOrderSuccess] = useState<OrderSuccessDetails | null>(
    null,
  );
  const [brandName, setBrandName] = useState(BRAND);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [payConfig, setPayConfig] = useState<PaymentConfig>(DEFAULT_PAYMENT);
  const [shippingConfig, setShippingConfig] =
    useState<ShippingConfig>(DEFAULT_SHIPPING);
  const [taxConfig, setTaxConfig] = useState<TaxConfig>(DEFAULT_TAX);

  const [offerOpen, setOfferOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [paymentMethodModalOpen, setPaymentMethodModalOpen] = useState(false);
  /** Shown when customer picks Partial COD — wallet/cashback not available. */
  const [partialCodWarningOpen, setPartialCodWarningOpen] = useState(false);
  /** User confirmed FULL vs PARTIAL_COD in the payment picker (not just the default). */
  const [paymentMethodChosen, setPaymentMethodChosen] = useState(false);
  const [addressSheet, setAddressSheet] = useState(false);
  /** true = opened via "Change" on delivery; false = first entry into checkout */
  const [addressSheetFromChange, setAddressSheetFromChange] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState("");
  const [pinLookupFor, setPinLookupFor] = useState("");
  const [payMethod, setPayMethod] = useState<PayMethod>("RAZORPAY");
  const [savedAddresses, setSavedAddresses] = useState<CustomerAddress[]>([]);
  const [addressMode, setAddressMode] = useState<AddressSheetMode>("form");
  const [address, setAddress] = useState<Address>({
    pincode: "",
    city: "",
    state: "",
    line1: "",
    line2: "",
    name: "",
    email: "",
    label: "Home",
  });

  function applySavedAddress(
    saved: CustomerAddress,
    emailFallback?: string | null,
  ) {
    setAddress({
      id: saved.id,
      pincode: saved.pincode || "",
      city: toTitleCase(saved.city || ""),
      state: toTitleCase(saved.state || ""),
      line1: saved.line1 || "",
      line2: saved.line2 || "",
      name: toTitleCase(saved.name || ""),
      email: saved.email || emailFallback || "",
      label:
        saved.label === "Work" || saved.label === "Home"
          ? saved.label
          : "Home",
    });
    setPinError("");
    setPinLookupFor(
      /^\d{6}$/.test(saved.pincode || "") && saved.city && saved.state
        ? saved.pincode
        : "",
    );
  }

  function blankAddress(name = "", email = "", phoneName = "") {
    setAddress({
      id: undefined,
      pincode: "",
      city: "",
      state: "",
      line1: "",
      line2: "",
      name: name || phoneName || "",
      email: email || "",
      label: "Home",
    });
    setPinError("");
    setPinLookupFor("");
  }

  const total = subtotal();
  const compare = compareTotal();
  const savings = saved();
  const itemCount = count();
  const siddhUnits = items.reduce((sum, { product, quantity }) => {
    if (!product.siddhAddonSelected) return sum;
    const units =
      typeof product.siddhAddonUnits === "number" && product.siddhAddonUnits > 0
        ? product.siddhAddonUnits
        : packQuantityFromLabel(product.title);
    return sum + units * quantity;
  }, 0);
  const siddhTotal = items.reduce((sum, { product, quantity }) => {
    if (!product.siddhAddonSelected) return sum;
    const unit =
      typeof product.siddhAddonPrice === "number" && product.siddhAddonPrice > 0
        ? product.siddhAddonPrice
        : 0;
    const units =
      typeof product.siddhAddonUnits === "number" && product.siddhAddonUnits > 0
        ? product.siddhAddonUnits
        : packQuantityFromLabel(product.title);
    return sum + unit * units * quantity;
  }, 0);
  const siddhLabel =
    items.find((i) => i.product.siddhAddonSelected)?.product.siddhAddonName ||
    "Siddh / Charged plat";
  /** Coupons require cart subtotal (before coupon) of at least ₹100 */
  const COUPON_MIN_TOTAL = 100;
  const couponAllowed = total >= COUPON_MIN_TOTAL;
  const couponDiscount = appliedCoupon?.amount || 0;
  const freeProductsOnly =
    items.length > 0 && items.every((i) => !!i.product.isFreeProduct);
  const totals = computeCheckoutTotals(
    total,
    couponDiscount,
    shippingConfig,
    taxConfig,
    { freeProductsOnly },
  );
  const {
    merchandise,
    shippingTotal,
    taxTotal,
    toPay: toPayBeforeWallet,
    freeShipping,
    amountToFreeShipping,
  } = totals;
  // Wallet redeem = min(balance, X% of product total, amount due)
  // Requires product total ≥ redeemMinOrderRupees (when set)
  const walletEligible =
    !!walletInfo?.enabled &&
    (walletInfo.balance || 0) > 0 &&
    total >= (walletInfo.redeemMinOrderRupees || 0);
  const walletMaxForOrder = walletEligible
    ? Math.min(
        walletInfo!.balance,
        Math.floor(
          (Math.max(0, total) * (walletInfo!.redeemPercent || 20)) / 100,
        ),
        toPayBeforeWallet,
      )
    : 0;

  // Partial COD is based on the amount before wallet, because wallet redeem
  // Partial COD: tiered % by order total, then MAX(percent, minAdvance).
  // Wallet redeem and cashback are prepaid-only and cannot be mixed with Partial COD.
  const partialCodCfg = useMemo(
    () =>
      normalizePartialCodConfig(
        payConfig.partialCod as Record<string, unknown> | undefined,
      ),
    [payConfig.partialCod],
  );
  const partialCodPlan = useMemo(() => {
    if (!partialCodCfg.enabled || toPayBeforeWallet <= 0) {
      return { advance: 0, percent: partialCodCfg.percent, usedMinFloor: false };
    }
    return resolvePartialCodAdvanceRupees(toPayBeforeWallet, partialCodCfg);
  }, [partialCodCfg, toPayBeforeWallet]);
  const partialCodMinAdvance = partialCodCfg.minAdvanceAmount;
  const partialCodPercent = partialCodPlan.percent;
  const partialCodAdvance =
    partialCodPlan.advance >= 1 &&
    partialCodPlan.advance < toPayBeforeWallet
      ? partialCodPlan.advance
      : 0;
  const partialCodUsesMinFloor =
    partialCodAdvance > 0 && partialCodPlan.usedMinFloor;
  const partialCodRuleLabel = partialCodUsesMinFloor
    ? `Min. advance ${formatINR(partialCodMinAdvance)}`
    : `${partialCodPercent}% advance`;
  const partialCodEligible = partialCodAdvance > 0;
  // Order too small for the configured floor advance (MAX would equal/exceed total).
  const partialCodLockedByMin =
    !!partialCodCfg.enabled &&
    toPayBeforeWallet > 0 &&
    partialCodMinAdvance > 0 &&
    !partialCodEligible &&
    partialCodMinAdvance >= toPayBeforeWallet;
  const showPartialCodOption =
    !!partialCodCfg.enabled &&
    toPayBeforeWallet > 0 &&
    (partialCodEligible || partialCodLockedByMin);
  const partialCodShortfall = Math.max(
    0,
    partialCodMinAdvance + 1 - toPayBeforeWallet,
  );
  const [paymentMode, setPaymentMode] = useState<"FULL" | "PARTIAL_COD">(
    "FULL",
  );
  const effectivePaymentMode: "FULL" | "PARTIAL_COD" = partialCodEligible
    ? paymentMode
    : "FULL";
  const walletRedeem =
    effectivePaymentMode !== "PARTIAL_COD" &&
    useWallet &&
    walletMaxForOrder > 0
      ? walletMaxForOrder
      : 0;
  const toPay = Math.max(0, toPayBeforeWallet - walletRedeem);
  const partialCodDue = Math.max(0, toPay - partialCodAdvance);
  const payNowAmount =
    effectivePaymentMode === "PARTIAL_COD" ? partialCodAdvance : toPay;

  const walletProgramOn = walletInfo?.enabled === true;
  const cashbackEarnEnabled =
    walletProgramOn && walletInfo?.cashbackEarnEnabled === true;
  const cashbackPercent = cashbackEarnEnabled
    ? walletInfo?.cashbackPercent || 0
    : 0;
  /** Free-product-only carts never earn cashback. Partial COD also never earns. */
  const cashbackEarn =
    effectivePaymentMode !== "PARTIAL_COD" &&
    !freeProductsOnly &&
    cashbackEarnEnabled &&
    cashbackPercent > 0
      ? Math.floor((Math.max(0, toPay) * cashbackPercent) / 100)
      : 0;
  const giftWorth = payConfig.prepaidGiftWorth || 499;
  const prepaid = true;
  const giftEnabled = payConfig.prepaidGiftEnabled && prepaid;
  const coupons = availableCoupons;

  useEffect(() => {
    if (!partialCodEligible && paymentMode === "PARTIAL_COD") {
      setPaymentMode("FULL");
    }
  }, [partialCodEligible, paymentMode]);

  // Drop / refresh coupon when cart total changes
  useEffect(() => {
    if (!appliedCoupon) return;
    if (total < COUPON_MIN_TOTAL) {
      setAppliedCoupon(null);
      setCoupon("");
      setError(
        `Coupons require a minimum order of ${formatINR(COUPON_MIN_TOTAL)}`,
      );
      return;
    }
    let cancelled = false;
    api<{
      valid: boolean;
      amount: number;
      code?: string;
      label?: string;
      message?: string | null;
    }>("/coupons/preview", {
      method: "POST",
      body: {
        code: appliedCoupon.code,
        subtotal: total,
        customerId: user?.id,
      },
    })
      .then((res) => {
        if (cancelled) return;
        if (!res.valid) {
          setAppliedCoupon(null);
          setCoupon("");
          setError(res.message || "Coupon no longer applies");
          return;
        }
        setAppliedCoupon({
          code: res.code || appliedCoupon.code,
          label: res.label || appliedCoupon.label,
          amount: res.amount,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, appliedCoupon?.code, user?.id]);

  const enabledMethods = useMemo(() => {
    return [
      {
        id: "RAZORPAY" as const,
        label:
          payConfig.methods?.RAZORPAY?.label || "Pay Online (Razorpay)",
        icon: <CreditCard size={18} />,
        gift: payConfig.prepaidGiftEnabled,
      },
    ];
  }, [payConfig]);

  useEffect(() => {
    api<{
      siteName?: string;
      logoUrl?: string | null;
      payment?: PaymentConfig;
      shipping?: Partial<ShippingConfig>;
      tax?: Partial<TaxConfig>;
    }>("/settings")
      .then((s) => {
        setBrandName(s.siteName || BRAND);
        setLogoUrl(s.logoUrl || null);
        if (s.payment) {
          const partialCod = normalizePartialCodConfig(
            s.payment.partialCod as Record<string, unknown> | undefined,
          );
          setPayConfig({
            ...DEFAULT_PAYMENT,
            ...s.payment,
            partialCod,
            methods: {
              ...DEFAULT_PAYMENT.methods,
              ...(s.payment.methods || {}),
            },
            coupons: s.payment.coupons?.length
              ? s.payment.coupons
              : DEFAULT_PAYMENT.coupons,
          });
        }
        if (s.shipping) {
          setShippingConfig({
            ...DEFAULT_SHIPPING,
            ...s.shipping,
            enabled: s.shipping.enabled !== false,
            freeAbovePaise:
              typeof s.shipping.freeAbovePaise === "number"
                ? s.shipping.freeAbovePaise
                : DEFAULT_SHIPPING.freeAbovePaise,
            flatRatePaise:
              typeof s.shipping.flatRatePaise === "number"
                ? s.shipping.flatRatePaise
                : DEFAULT_SHIPPING.flatRatePaise,
            freeProductShippingPaise:
              typeof s.shipping.freeProductShippingPaise === "number"
                ? s.shipping.freeProductShippingPaise
                : DEFAULT_SHIPPING.freeProductShippingPaise,
          });
        }
        if (s.tax) {
          setTaxConfig({
            ...DEFAULT_TAX,
            ...s.tax,
            enabled: s.tax.enabled === true,
            gstPercent:
              typeof s.tax.gstPercent === "number"
                ? s.tax.gstPercent
                : DEFAULT_TAX.gstPercent,
            inclusive: s.tax.inclusive !== false,
          });
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch whenever the logged-in customer changes so customer-specific
  // coupons appear/disappear as soon as the user logs in during checkout.
  useEffect(() => {
    if (typeof window !== "undefined" && isLikelySearchCrawler()) return;
    const params = new URLSearchParams();
    if (user?.id) params.set("customerId", user.id);
    const qs = params.toString();
    api<
      {
        code: string;
        label: string;
        discountType: "PERCENT" | "FIXED";
        value: number;
        minOrderAmount: number | null;
        maxDiscount: number | null;
      }[]
    >(`/coupons${qs ? `?${qs}` : ""}`)
      .then((list) => {
        if (Array.isArray(list)) setAvailableCoupons(list);
      })
      .catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    if (!checkoutOpen || !token) {
      setWalletInfo(null);
      setUseWallet(false);
      return;
    }
    api<{
      enabled: boolean;
      cashbackEarnEnabled?: boolean;
      balance: number;
      redeemPercentOfBalance: number;
      cashbackPercent: number;
      redeemMinOrderRupees: number;
      creditTiming?: "instant" | "on_delivery";
    }>("/wallet", { token })
      .then((w) => {
        setWalletInfo({
          enabled: w.enabled === true,
          cashbackEarnEnabled: w.cashbackEarnEnabled === true,
          balance: w.balance || 0,
          redeemPercent: w.redeemPercentOfBalance || 20,
          cashbackPercent: w.cashbackPercent || 0,
          redeemMinOrderRupees: Math.max(0, Number(w.redeemMinOrderRupees) || 0),
          creditTiming:
            w.creditTiming === "instant" ? "instant" : "on_delivery",
        });
        // Default on when customer has a usable balance
        if (w.enabled === true && (w.balance || 0) > 0) {
          setUseWallet(true);
        }
      })
      .catch(() => setWalletInfo(null));
  }, [checkoutOpen, token]);

  // Keep toggle off if order can't use wallet (e.g. empty cart)
  useEffect(() => {
    if (walletMaxForOrder <= 0 && useWallet) setUseWallet(false);
  }, [walletMaxForOrder, useWallet]);

  useEffect(() => {
    if (effectivePaymentMode === "PARTIAL_COD" && useWallet) {
      setUseWallet(false);
    }
  }, [effectivePaymentMode, useWallet]);

  useEffect(() => {
    if (checkoutOpen) {
      setError("");
      setOrderNumber("");
      setOtp("");
      setSummaryOpen(false);
      setOfferOpen(false);
      setCancelOpen(false);
      setAddressSheet(false);
      setAddressSheetFromChange(false);
      setPayMethod("RAZORPAY");
      setPaymentMethodChosen(false);
      setPaymentMethodModalOpen(false);
      setPartialCodWarningOpen(false);
      setPaymentMode("FULL");
      closingRef.current = false;
      document.body.style.overflow = "hidden";

      if (!token) {
        closeCheckout();
        openLogin("checkout");
        return;
      }

      setPhone(user?.phone || "");
      void refreshMe().then((freshUser) => {
        const customer = freshUser || user;
        if (!customer) return;
        setPhone(customer.phone || "");
        const list = customer.addresses || [];
        setSavedAddresses(list);
        const preferred =
          list.find((a) => a.isDefault) || list[0] || null;
        if (preferred) {
          applySavedAddress(preferred, customer.email);
          setAddressMode("list");
        } else {
          blankAddress(customer.name || "", customer.email || "");
          setAddressMode("form");
        }
      });
      setStep("address");
      setAddressSheetFromChange(false);
      setAddressSheet(true);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutOpen]);

  // Meta InitiateCheckout: once per modal open when cart has items
  useEffect(() => {
    if (!checkoutOpen) {
      initiateCheckoutTrackedRef.current = false;
      return;
    }
    if (initiateCheckoutTrackedRef.current) return;
    if (!items.length) return;
    initiateCheckoutTrackedRef.current = true;
    try {
      const contents = items.map(({ product, quantity }) => ({
        id: product.id,
        quantity,
      }));
      trackInitiateCheckout({
        value: subtotal(),
        currency: "INR",
        num_items: count(),
        content_ids: contents.map((c) => c.id),
        contents,
      });
      trackCheckoutStarted({
        itemCount: count(),
        value: subtotal(),
        freeShipping,
        shippingTotal,
        phone: user?.phone || phone || undefined,
        email: user?.email || address.email || undefined,
      });
    } catch {
      /* Meta tracking must never break checkout */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutOpen]);

  // Mobile browser / gesture back should exit checkout and stay on product page
  useEffect(() => {
    if (!checkoutOpen) return;
    window.history.pushState({ aaCheckout: true }, "");
    const onPopState = () => {
      closingRef.current = true;
      setCancelOpen(false);
      setAddressSheet(false);
      setOfferOpen(false);
      setShowCoupons(false);
      setSummaryOpen(false);
      closeCheckout();
      closingRef.current = false;
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [checkoutOpen, closeCheckout]);

  /** Fully leave checkout — stay on current page (e.g. product), do not force cart open. */
  function exitCheckout() {
    setCancelOpen(false);
    setAddressSheet(false);
    setAddressSheetFromChange(false);
    setOfferOpen(false);
    setShowCoupons(false);
    setSummaryOpen(false);
    closeCheckout();
    if (!closingRef.current && window.history.state?.aaCheckout) {
      closingRef.current = true;
      window.history.back();
    }
  }

  /** Cancel payment confirmed → close checkout and open cart. */
  function exitCheckoutToCart() {
    setCancelOpen(false);
    setAddressSheet(false);
    setAddressSheetFromChange(false);
    setOfferOpen(false);
    setShowCoupons(false);
    setSummaryOpen(false);
    openCart();
    if (!closingRef.current && window.history.state?.aaCheckout) {
      closingRef.current = true;
      window.history.back();
    }
  }

  /** GoKwik-style: confirm before leaving checkout. */
  function requestExitCheckout() {
    setCancelOpen(true);
  }

  function closeAddressSheetToDelivery() {
    setAddressSheet(false);
    setAddressSheetFromChange(false);
    setStep("delivery");
  }

  /** X / dismiss on address sheet */
  function handleAddressSheetClose() {
    if (addressSheetFromChange && addressValid) {
      closeAddressSheetToDelivery();
      return;
    }
    // First-time address screen or incomplete address → confirm leave → product page
    requestExitCheckout();
  }

  const phoneValid = useMemo(
    () => /^[6-9]\d{9}$/.test(phone.replace(/\D/g, "")),
    [phone],
  );

  const addressValid =
    /^\d{6}$/.test(address.pincode) &&
    pinLookupFor === address.pincode &&
    !pinError &&
    !pinLoading &&
    address.city.trim() &&
    address.state.trim() &&
    address.line1.trim() &&
    address.name.trim() &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.email.trim());

  async function lookupAddressPincode(pin: string) {
    if (!/^\d{6}$/.test(pin)) return;
    setPinLoading(true);
    setPinLookupFor("");
    setPinError("");
    setError("");
    try {
      const loc = await lookupPincode(pin);
      setAddress((a) =>
        a.pincode === pin ? { ...a, city: loc.city, state: loc.state } : a,
      );
      setPinLookupFor(pin);
      setPinError("");
    } catch (e: unknown) {
      setAddress((a) =>
        a.pincode === pin ? { ...a, city: "", state: "" } : a,
      );
      setPinLookupFor("");
      setPinError(
        e instanceof Error
          ? e.message
          : "Invalid or unsupported pincode. Please check and try again.",
      );
    } finally {
      setPinLoading(false);
    }
  }

  async function applyCoupon(code: string) {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setShowCoupons(false);
      setOfferOpen(false);
      setError("Enter a coupon code");
      return;
    }
    if (total < COUPON_MIN_TOTAL) {
      setShowCoupons(false);
      setOfferOpen(false);
      setError(
        `Coupons require a minimum order of ${formatINR(COUPON_MIN_TOTAL)}`,
      );
      return;
    }
    try {
      const res = await api<{
        valid: boolean;
        amount: number;
        code?: string;
        label?: string;
        message?: string | null;
      }>("/coupons/preview", {
        method: "POST",
        body: { code: trimmed, subtotal: total, customerId: user?.id },
      });
      if (!res.valid) {
        setShowCoupons(false);
        setOfferOpen(false);
        setError(res.message || "Invalid coupon code");
        return;
      }
      setError("");
      setAppliedCoupon({
        code: res.code || trimmed,
        label: res.label || trimmed,
        amount: res.amount,
      });
      setCoupon(res.code || trimmed);
      setShowCoupons(false);
      setOfferOpen(false);
      try {
        trackCouponApplied({
          code: res.code || trimmed,
          label: res.label || trimmed,
          amount: res.amount,
          subtotal: total,
        });
      } catch {
        /* ignore */
      }
    } catch (e: unknown) {
      setShowCoupons(false);
      setOfferOpen(false);
      setError(e instanceof Error ? e.message : "Could not apply coupon");
    }
  }

  const couponFieldError =
    Boolean(error) &&
    /coupon|minimum order of/i.test(error.toLowerCase());

  function removeCoupon() {
    const code = appliedCoupon?.code;
    setAppliedCoupon(null);
    setCoupon("");
    setError("");
    try {
      trackCouponRemoved({ code });
    } catch {
      /* ignore */
    }
  }

  function onWalletToggle(enabled: boolean) {
    setUseWallet(enabled);
    try {
      const redeem = enabled
        ? Math.min(walletMaxForOrder || 0, walletInfo?.balance || 0)
        : 0;
      trackWalletToggled({
        enabled,
        balance: walletInfo?.balance,
        redeem: enabled ? redeem : 0,
        saveAmount: enabled ? redeem : 0,
        toPay: Math.max(0, (toPayBeforeWallet || 0) - (enabled ? redeem : 0)),
      });
    } catch {
      /* ignore */
    }
  }

  function goToPaymentStep(from?: string) {
    try {
      trackCheckoutStep({ step: "payment", from: from || step });
      trackPaymentMethodSelected({
        method: payMethod,
        paymentMode: effectivePaymentMode,
      });
    } catch {
      /* ignore */
    }
    setStep("payment");
  }

  function handleBack() {
    // Address sheet open: Change → back to delivery; otherwise confirm exit
    if (addressSheet || step === "address") {
      handleAddressSheetClose();
      return;
    }
    if (step === "payment" || step === "delivery") {
      requestExitCheckout();
      return;
    }
    if (step === "done") {
      exitCheckout();
      return;
    }
    requestExitCheckout();
  }

  function afterOffer() {
    setOfferOpen(false);
    setAddressSheetFromChange(false);
    setStep("address");
    setAddressSheet(true);
  }

  function saveAddress(e?: FormEvent) {
    e?.preventDefault();
    void persistAddressAndContinue();
  }

  async function persistAddressAndContinue() {
    if (!addressValid) {
      setError("Please fill all required address fields");
      return;
    }
    if (!token) {
      setError("Please login with OTP first");
      closeCheckout();
      openLogin("checkout");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const body = {
        name: address.name.trim(),
        email: address.email.trim().toLowerCase(),
        phone: (phone.replace(/\D/g, "") || user?.phone || "").slice(-10),
        line1: address.line1.trim(),
        line2: address.line2.trim() || undefined,
        city: toTitleCase(address.city),
        state: toTitleCase(address.state),
        pincode: address.pincode.trim(),
        label: address.label,
        isDefault: true,
      };
      const saved = address.id
        ? await api<CustomerAddress>(`/addresses/${address.id}`, {
            method: "PATCH",
            token,
            body,
          })
        : await api<CustomerAddress>("/addresses", {
            method: "POST",
            token,
            body,
          });
      applySavedAddress(saved, saved.email || address.email);
      const fresh = await refreshMe();
      if (fresh?.addresses) setSavedAddresses(fresh.addresses);
      setAddressSheetFromChange(false);
      setAddressSheet(false);
      try {
        trackAddressSelected({
          city: saved.city || address.city,
          state: saved.state || address.state,
          pincode: saved.pincode || address.pincode,
          label: saved.label || address.label,
          name: saved.name || address.name,
          phone: saved.phone || phone,
          email: saved.email || address.email,
          isNew: !address.id,
        });
        trackCheckoutStep({ step: "delivery", from: "address" });
      } catch {
        /* ignore */
      }
      setStep("delivery");
    } catch (err: any) {
      setError(err.message || "Could not save address");
    } finally {
      setLoading(false);
    }
  }

  function selectSavedAddress(saved: CustomerAddress) {
    applySavedAddress(saved, address.email || user?.email);
    setError("");
    setAddressSheetFromChange(false);
    setAddressSheet(false);
    try {
      trackAddressSelected({
        city: saved.city,
        state: saved.state,
        pincode: saved.pincode,
        label: saved.label || undefined,
        name: saved.name,
        phone: saved.phone,
        email: saved.email || address.email || user?.email || undefined,
        isNew: false,
      });
      trackCheckoutStep({ step: "delivery", from: "address_list" });
    } catch {
      /* ignore */
    }
    setStep("delivery");
  }

  async function placeOrder() {
    if (!token) {
      setError("Please login to pay");
      closeCheckout();
      openLogin("checkout");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const missingVariant = items.find((i) => !i.product.variantId);
      if (missingVariant) {
        throw new Error("Please re-add items to cart (outdated cart data)");
      }

      const ready = await loadRazorpay();
      if (!ready) throw new Error("Could not load Razorpay. Check your network.");

      const created = await api<{
        orderId: string;
        orderNumber: string;
        razorpayOrderId: string;
        amount: number;
        keyId: string;
        paymentMode?: "FULL" | "PARTIAL_COD";
        codDue?: number;
        customer: { name?: string; email?: string; contact?: string };
      }>("/checkout/razorpay/create-order", {
        method: "POST",
        token,
        body: {
          name: address.name,
          phone: phone.replace(/\D/g, "") || user?.phone,
          email: address.email.trim(),
          line1: address.line1,
          line2: address.line2 || undefined,
          city: toTitleCase(address.city),
          state: toTitleCase(address.state),
          pincode: address.pincode,
          addressId: address.id,
          label: address.label,
          saveAddress: true,
          setDefault: true,
          couponCode: appliedCoupon?.code,
          walletRedeem: walletRedeem > 0 ? walletRedeem : undefined,
          paymentMode:
            effectivePaymentMode === "PARTIAL_COD" ? "PARTIAL_COD" : undefined,
          notes: `Address type: ${address.label}; Pay via: Razorpay${
            effectivePaymentMode === "PARTIAL_COD" ? " (Partial COD)" : ""
          }`,
          items: items.map((i) => ({
            variantId: i.product.variantId,
            quantity: i.quantity,
            siddhAddon: !!(
              i.product.siddhAddonSelected && !i.product.isAddonUpsell
            ),
            ...(i.product.isAddonUpsell && i.product.addonParentId
              ? { addonParentProductId: i.product.addonParentId }
              : {}),
          })),
        },
      });

      try {
        trackPaymentInitiated({
          orderId: created.orderId,
          orderNumber: created.orderNumber,
          value: Math.round((created.amount || 0) / 100) || toPay,
          paymentMode: created.paymentMode || effectivePaymentMode,
          paymentMethod: payMethod,
          phone: phone.replace(/\D/g, "") || user?.phone || undefined,
          email: address.email.trim() || user?.email || undefined,
          couponCode: appliedCoupon?.code,
          couponDiscount: appliedCoupon?.amount,
          walletRedeem: walletRedeem > 0 ? walletRedeem : undefined,
          freeShipping,
          shippingTotal,
          itemCount: count(),
          toPay,
        });
      } catch {
        /* analytics must never break checkout */
      }

      // The API saves this checkout identity and default address to the account.
      const fresh = await refreshMe();
      if (fresh?.addresses) setSavedAddresses(fresh.addresses);
      setLoading(false);

      openRazorpayCheckout({
        keyId: created.keyId,
        amount: created.amount,
        orderId: created.razorpayOrderId,
        name: brandName,
        description: `Order ${created.orderNumber}`,
        prefill: {
          name: address.name,
          email: address.email.trim(),
          contact: created.customer.contact,
        },
        onSuccess: async (res) => {
          setLoading(true);
          try {
            const order = await api<{ orderNumber: string }>(
              "/checkout/razorpay/verify",
              {
                method: "POST",
                token,
                body: {
                  orderId: created.orderId,
                  razorpayOrderId: res.razorpay_order_id,
                  razorpayPaymentId: res.razorpay_payment_id,
                  razorpaySignature: res.razorpay_signature,
                },
              },
            );
            const purchaseContents = items.map(({ product, quantity }) => ({
              id: product.id,
              quantity,
            }));
            const paidRupees =
              Math.round((created.amount || 0) / 100) || toPay;
            try {
              trackPurchase({
                orderId: created.orderId,
                value: paidRupees,
                currency: "INR",
                content_ids: purchaseContents.map((c) => c.id),
                contents: purchaseContents,
                num_items: purchaseContents.reduce(
                  (sum, c) => sum + c.quantity,
                  0,
                ),
                eventID: created.orderId,
              });
              trackPurchaseEvent({
                orderId: created.orderId,
                orderNumber: created.orderNumber,
                value: paidRupees,
                paymentMode: created.paymentMode || effectivePaymentMode,
                phone: phone.replace(/\D/g, "") || user?.phone || undefined,
                email: address.email.trim() || user?.email || undefined,
                couponCode: appliedCoupon?.code,
                couponDiscount: appliedCoupon?.amount,
                walletRedeem: walletRedeem > 0 ? walletRedeem : undefined,
                freeShipping,
                itemCount: count(),
              });
            } catch {
              /* Meta tracking must never break checkout */
            }
            clear();
            const number = order.orderNumber || created.orderNumber;
            setOrderNumber(number);
            setOrderSuccess({
              orderNumber: number,
              paid: paidRupees,
              cashbackEarn,
              walletRedeemed: walletRedeem,
              creditTiming:
                walletInfo?.creditTiming === "instant"
                  ? "instant"
                  : "on_delivery",
              brandName,
              codDue: created.codDue || 0,
            });
            setStep("done");
          } catch (err: any) {
            setError(err.message || "Payment verification failed");
          } finally {
            setLoading(false);
          }
        },
        onDismiss: () => {
          setError("Payment cancelled. You can try again.");
        },
      });
    } catch (err: any) {
      setError(err.message || "Checkout failed");
      setLoading(false);
    }
  }

  if (!checkoutOpen) return null;

  const promoBanner = (
    step === "payment" || step === "delivery"
      ? payConfig.promoBanner
      : payConfig.loginPromoBanner
  )?.trim() || "";

  const shippingStatusMessage = (() => {
    if (freeProductsOnly) {
      if (shippingTotal > 0) {
        return {
          text: `Free product shipping ${formatINR(shippingTotal)}`,
          tone: "neutral" as const,
        };
      }
      return {
        text: "Yay! Free shipping applied 🥳",
        tone: "success" as const,
      };
    }
    if (freeShipping) {
      return {
        text: "Yay! Free shipping applied 🥳",
        tone: "success" as const,
      };
    }
    if (amountToFreeShipping > 0) {
      return {
        text: `${shippingConfig.label || "Shipping"} ${formatINR(shippingTotal)} · Add ${formatINR(amountToFreeShipping)} more for free shipping`,
        tone: "neutral" as const,
      };
    }
    return {
      text: `${shippingConfig.label || "Shipping"} ${formatINR(shippingTotal)}`,
      tone: "neutral" as const,
    };
  })();

  const showWalletToggle =
    effectivePaymentMode !== "PARTIAL_COD" &&
    !!walletInfo?.enabled &&
    (walletInfo.balance || 0) > 0 &&
    walletMaxForOrder > 0;

  const partialCodWalletNotice = walletProgramOn ? (
    <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-3.5">
      <Info
        size={16}
        className="mt-0.5 shrink-0 text-amber-700"
        aria-hidden
      />
      <p className="text-[12px] leading-snug text-amber-900">
        <span className="font-bold">
          Wallet &amp; cashback apply only on full prepaid orders.
        </span>{" "}
        Partial COD cannot use wallet balance, and cashback is not added to
        your wallet. Choose &ldquo;Pay full amount online&rdquo; to use wallet
        and earn cashback.
      </p>
    </div>
  ) : null;

  const errorOverlay =
    error && typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 z-[80] flex items-stretch sm:items-center justify-center sm:p-4">
            <div className="relative z-10 w-full sm:max-w-[440px] h-[100dvh] sm:h-[min(860px,92vh)]">
              <CheckoutErrorSheet
                message={error}
                onClose={() => setError("")}
              />
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {errorOverlay}
    <div className="fixed inset-0 z-[70] flex items-stretch sm:items-center justify-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={() => {
          if (step === "done") exitCheckout();
          else requestExitCheckout();
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Checkout"
        className="relative z-10 w-full sm:max-w-[440px] h-[100dvh] sm:h-[min(860px,92vh)] bg-surface sm:rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.25)] overflow-hidden flex flex-col animate-checkout-in"
      >
        {step === "done" ? (
          <OrderSuccessPanel
            details={
              orderSuccess || {
                orderNumber: orderNumber || "—",
                paid: 0,
                cashbackEarn: 0,
                walletRedeemed: 0,
                brandName,
              }
            }
            onContinue={exitCheckout}
          />
        ) : items.length === 0 ? (
          <div className="p-8 text-center bg-white flex-1">
            <p className="text-muted mb-4">Your cart is empty</p>
            <button
              type="button"
              onClick={exitCheckout}
              className="bg-black text-white px-6 py-3 rounded-xl text-sm font-bold"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between gap-2 px-3 py-3 bg-white flex-shrink-0">
              <div className="flex min-w-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={handleBack}
                  className="shrink-0 rounded-full p-1.5 hover:bg-surface"
                  aria-label="Back"
                >
                  <ArrowLeft size={20} />
                </button>
                <div className="flex min-w-0 items-center gap-2">
                  {logoUrl ? (
                    <SiteLogoImage
                      src={logoUrl}
                      size={28}
                      className="h-7 w-7 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-white text-xs font-bold">
                      AF
                    </span>
                  )}
                  <span className="truncate font-bold text-[15px]">
                    {brandName}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1 text-[10px] sm:text-[11px] text-muted font-medium">
                <Lock size={12} />
                100% Secured Payment
              </div>
            </div>

            {promoBanner ? (
              <div className="bg-black text-white text-center text-[12px] sm:text-[13px] py-2.5 px-3 font-medium flex-shrink-0">
                {promoBanner}
              </div>
            ) : null}

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-2.5 sm:px-3.5 sm:py-3 space-y-2">
              {(step === "delivery" || step === "payment") && (
                <p className="text-[10px] font-semibold tracking-[0.1em] text-subtle uppercase px-0.5">
                  {step === "payment" ? "Payment Options" : "Delivery Details"}
                </p>
              )}

              {/* Order Summary card */}
              <CheckoutOrderSummaryCard
                itemCount={itemCount}
                giftEnabled={giftEnabled}
                autoGiftUnits={freeGifts.giftUnits}
                savings={savings}
                compareTotal={compare}
                toPay={toPay}
                walletRedeem={walletRedeem}
                cashbackEarn={cashbackEarn}
                cashbackPercent={cashbackPercent}
                formatINR={formatINR}
                onOpen={() => setSummaryOpen(true)}
              />

              {/* Address card (delivery / payment) */}
              {(step === "delivery" || step === "payment") && addressValid && (
                <div className="rounded-xl bg-white px-3 pt-2.5 pb-2">
                  <div className="flex gap-2.5">
                    <MapPin
                      size={16}
                      className="text-text mt-0.5 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[13px] leading-snug">
                        Deliver To {address.name}
                        {address.label ? (
                          <span className="ml-1.5 text-[10px] font-semibold text-muted">
                            ({address.label})
                          </span>
                        ) : null}
                      </p>
                      <p className="text-[11px] text-text mt-0.5 leading-relaxed">
                        {address.line1}
                        {address.line2 ? `, ${address.line2}` : ""},{" "}
                        {toTitleCase(address.city)}{" "}
                        {toTitleCase(address.state)}, {address.pincode}
                      </p>
                      <p className="text-[11px] text-text mt-0.5">
                        +91 {phone}{" "}
                        {address.email ? `| ${address.email}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAddressMode(
                          savedAddresses.length > 0 ? "list" : "form",
                        );
                        setAddressSheetFromChange(true);
                        setAddressSheet(true);
                        setStep("address");
                      }}
                      className="self-start text-xs font-semibold border border-black rounded-lg px-3 py-1.5 hover:bg-surface-alt"
                    >
                      Change
                    </button>
                  </div>
                  <p
                    className={`mt-2 border-t border-line pt-2 text-center text-[12px] leading-snug ${
                      shippingStatusMessage.tone === "success"
                        ? "font-medium text-muted"
                        : "font-normal text-muted"
                    }`}
                  >
                    {shippingStatusMessage.text}
                  </p>
                </div>
              )}

              {/* Coupons */}
              {(step === "login" || step === "delivery") && (
                <>
                  {step === "delivery" && (
                    <p className="text-[10px] font-semibold tracking-[0.1em] text-subtle uppercase px-0.5 pt-0.5">
                      Offers & Rewards
                    </p>
                  )}
                  <div className="rounded-xl bg-white px-3 py-2.5 space-y-2.5">
                    <div className="flex gap-2">
                      <input
                        value={coupon}
                        onChange={(e) => {
                          setCoupon(e.target.value.toUpperCase());
                          if (error) setError("");
                        }}
                        placeholder="Enter coupon code"
                        disabled={Boolean(appliedCoupon)}
                        className={`flex-1 border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-black disabled:bg-surface-alt disabled:text-muted ${
                          couponFieldError
                            ? "border-red-400 bg-red-50/40"
                            : "border-line-strong"
                        }`}
                      />
                      {appliedCoupon ? (
                        <button
                          type="button"
                          onClick={removeCoupon}
                          className="px-4 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50"
                        >
                          Remove
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void applyCoupon(coupon)}
                          disabled={!couponAllowed}
                          className="px-4 rounded-xl border border-line-strong text-sm font-semibold hover:bg-surface-alt disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Apply
                        </button>
                      )}
                    </div>
                    {!couponAllowed && !appliedCoupon && (
                      <p className="text-[12px] text-muted">
                        Add items worth {formatINR(COUPON_MIN_TOTAL)} or more to
                        use a coupon (current: {formatINR(total)})
                      </p>
                    )}
                    {appliedCoupon ? (
                      <p className="text-[12px] text-success font-semibold flex items-center gap-1.5">
                        <CheckCircle2 size={14} />
                        &quot;{appliedCoupon.code}&quot; applied — save{" "}
                        {formatINR(appliedCoupon.amount)}
                      </p>
                    ) : (
                      <div className="flex items-center justify-between text-[13px]">
                        <p className="flex items-center gap-1.5 text-text">
                          <Percent size={14} className="text-success" />
                          {coupons.length} coupons available
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowCoupons(true)}
                          disabled={!couponAllowed}
                          className="font-bold text-sm disabled:opacity-50"
                        >
                          View All
                        </button>
                      </div>
                    )}
                  </div>

                  {effectivePaymentMode === "PARTIAL_COD" ? (
                    <div className="mt-4">{partialCodWalletNotice}</div>
                  ) : (
                    <>
                      {walletInfo &&
                        walletInfo.enabled &&
                        walletInfo.balance > 0 &&
                        walletMaxForOrder > 0 && (
                          <div className="mt-4 rounded-2xl border border-[#D1FAE5] bg-gradient-to-br from-[#ECFDF5] to-white p-4 space-y-2">
                            <label className="flex items-start gap-3 cursor-pointer">
                              <input
                                type="checkbox"
                                className="mt-1 accent-[var(--brand)]"
                                checked={useWallet}
                                onChange={(e) => onWalletToggle(e.target.checked)}
                              />
                              <span className="min-w-0">
                                <span className="flex items-center gap-1.5 text-sm font-bold text-success">
                                  <Wallet size={15} /> Use wallet · save{" "}
                                  {formatINR(walletMaxForOrder)}
                                </span>
                                <span className="block text-[12px] text-success mt-0.5">
                                  Balance {formatINR(walletInfo.balance)} · up to{" "}
                                  {walletInfo.redeemPercent}% of product total (
                                  {formatINR(total)}) on this order
                                </span>
                              </span>
                            </label>
                            {useWallet && walletRedeem > 0 && (
                              <p className="text-[12px] font-semibold text-success pl-7">
                                {formatINR(walletRedeem)} will be deducted · you
                                pay {formatINR(toPay)}
                              </p>
                            )}
                          </div>
                        )}
                      {walletInfo &&
                        walletInfo.enabled &&
                        walletInfo.balance > 0 &&
                        (walletInfo.redeemMinOrderRupees || 0) > 0 && (
                          <div className="mt-4">
                            <WalletUnlockUpsell
                              balance={walletInfo.balance}
                              minOrderRupees={walletInfo.redeemMinOrderRupees}
                              cartTotal={total}
                              redeemPercent={walletInfo.redeemPercent}
                              compact
                            />
                          </div>
                        )}
                    </>
                  )}
                </>
              )}

              {step === "payment" &&
                (effectivePaymentMode === "PARTIAL_COD" ? (
                  partialCodWalletNotice
                ) : (
                  walletInfo &&
                  walletInfo.enabled &&
                  walletInfo.balance > 0 &&
                  walletMaxForOrder > 0 && (
                    <div className="rounded-xl border border-[#D1FAE5] bg-success-soft p-3.5">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          className="mt-1 accent-[var(--brand)]"
                          checked={useWallet}
                          onChange={(e) => onWalletToggle(e.target.checked)}
                        />
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 text-sm font-bold text-success">
                            <Wallet size={15} /> Wallet
                            {useWallet && walletRedeem > 0
                              ? ` · −${formatINR(walletRedeem)}`
                              : ` · save ${formatINR(walletMaxForOrder)}`}
                          </span>
                          <span className="block text-[12px] text-success mt-0.5">
                            Balance {formatINR(walletInfo.balance)} ·{" "}
                            {walletInfo.redeemPercent}% of products
                            {useWallet && walletRedeem > 0
                              ? ` · pay ${formatINR(toPay)}`
                              : ""}
                          </span>
                        </span>
                      </label>
                    </div>
                  )
                ))}

              {/* Selected payment method recap — only after user picks in the modal */}
              {showPartialCodOption &&
                (step === "payment" ||
                  (step === "delivery" && paymentMethodChosen)) && (
                  <button
                    type="button"
                    onClick={() => setPaymentMethodModalOpen(true)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-line bg-white p-3.5 text-left shadow-sm"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface text-muted">
                      {effectivePaymentMode === "PARTIAL_COD" ? (
                        <Split size={16} />
                      ) : (
                        <CreditCard size={16} />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-ink">
                        {effectivePaymentMode === "PARTIAL_COD"
                          ? "Partial COD"
                          : "Pay full amount online"}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-muted">
                        {effectivePaymentMode === "PARTIAL_COD"
                          ? `${formatINR(partialCodAdvance)} now · ${formatINR(partialCodDue)} on delivery${walletProgramOn ? " · no wallet / cashback" : ""}`
                          : "UPI, Cards, Netbanking & Wallets"}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] font-bold text-muted underline underline-offset-2">
                      Change
                    </span>
                  </button>
                )}

              {/* PAYMENT STEP */}
              {step === "payment" && (
                <>
                  <div className="rounded-xl border border-line bg-white shadow-sm p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="h-10 w-10 rounded-lg bg-surface grid place-items-center">
                        <CreditCard size={20} />
                      </span>
                      <div className="flex-1">
                        <p className="font-bold text-sm">Pay with Razorpay</p>
                        <p className="text-[12px] text-muted">
                          UPI, Cards, Netbanking &amp; Wallets
                        </p>
                      </div>
                      <span className="font-bold">
                        {formatINR(payNowAmount)}
                      </span>
                    </div>
                    <p className="text-[12px] text-text">
                      Tap <span className="font-semibold">Pay securely</span>{" "}
                      below to open Razorpay&apos;s checkout for{" "}
                      {formatINR(payNowAmount)}
                      {effectivePaymentMode === "PARTIAL_COD"
                        ? ` · ${formatINR(partialCodDue)} due as COD at delivery.`
                        : "."}
                    </p>
                  </div>

                  <div className="rounded-xl border border-line bg-white p-3.5 flex items-center gap-2 shadow-sm">
                    <User size={16} className="text-text" />
                    <div className="text-[12px] flex-1 min-w-0">
                      <p className="font-semibold">
                        {user?.name || address.name}
                      </p>
                      <p className="text-muted truncate">
                        +91 {user?.phone || phone}
                        {(user?.email || address.email) &&
                          ` · ${user?.email || address.email}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        logoutCustomer();
                        closeCheckout();
                        openLogin("checkout");
                      }}
                      className="text-xs font-bold"
                    >
                      Logout
                    </button>
                  </div>

                  <div className="text-center space-y-2 pt-1 pb-2">
                    <p className="text-[11px] text-subtle">
                      Powered By{" "}
                      <span className="font-bold text-text">Razorpay</span>
                    </p>
                    <div className="flex flex-wrap justify-center gap-3 text-[10px] text-muted">
                      <span className="inline-flex items-center gap-1">
                        <ShieldCheck size={12} /> PCI DSS Certified
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Lock size={12} /> 100% Secured Payments
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle2 size={12} /> Verified Merchant
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Sticky footer — delivery: choose method / continue (never opens Razorpay here) */}
            {step === "delivery" && (
              <div className="flex-shrink-0 border-t border-line bg-white safe-pb shadow-[0_-10px_28px_rgba(0,0,0,0.07)]">
                {payConfig.promoBanner?.trim() ? (
                  <div className="bg-[#FFF7ED] text-[12px] font-medium px-3 py-2 text-center text-[#9A3412] border-b border-[#FFEDD5]">
                    {payConfig.promoBanner.trim()}
                  </div>
                ) : null}
                <div className="p-3 sm:p-4 pt-3 space-y-2">
                  {(() => {
                    const needsMethodPick =
                      showPartialCodOption && !paymentMethodChosen;
                    const isPartial =
                      showPartialCodOption &&
                      paymentMethodChosen &&
                      effectivePaymentMode === "PARTIAL_COD";
                    const title = needsMethodPick
                      ? "Choose Payment Method"
                      : isPartial
                        ? "Continue with Partial COD"
                        : "Continue to Payment";
                    const subtitle = needsMethodPick
                      ? "UPI, cards, or Partial COD"
                      : isPartial
                        ? `${formatINR(partialCodAdvance)} now · ${formatINR(partialCodDue)} on delivery`
                        : "Review & pay securely next";
                    return (
                      <button
                        type="button"
                        disabled={!items.length}
                        onClick={() =>
                          needsMethodPick
                            ? setPaymentMethodModalOpen(true)
                            : goToPaymentStep("delivery")
                        }
                        className={`group relative w-full overflow-hidden rounded-2xl p-3.5 text-left text-white shadow-[0_8px_22px_rgba(0,0,0,0.14)] transition-all duration-200 active:scale-[0.985] disabled:opacity-50 ${
                          isPartial
                            ? "bg-gradient-to-r from-bhagva to-bhagva-deep hover:brightness-105"
                            : "bg-brand hover:bg-brand-hover"
                        }`}
                      >
                        {payConfig.prepaidGiftEnabled && (
                          <span className="absolute -top-2.5 left-4 z-10 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#16A34A] text-white shadow-sm">
                            🎁{" "}
                            {payConfig.prepaidGiftLabel ||
                              `${formatINR(giftWorth)} FREE GIFT`}
                          </span>
                        )}
                        <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_45%)]" />
                        <span className="relative flex items-center gap-3">
                          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/18 ring-1 ring-white/25 backdrop-blur-[2px]">
                            {needsMethodPick ? (
                              <Wallet size={20} strokeWidth={2.25} />
                            ) : isPartial ? (
                              <Split size={20} strokeWidth={2.25} />
                            ) : (
                              <CreditCard size={20} strokeWidth={2.25} />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[15px] font-extrabold leading-tight tracking-tight">
                              {title}
                            </span>
                            <span className="mt-0.5 block text-[11px] font-medium text-white/85">
                              {subtitle}
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            <span className="rounded-full bg-white/20 px-2.5 py-1 text-sm font-extrabold tabular-nums ring-1 ring-white/25">
                              {formatINR(payNowAmount)}
                            </span>
                            <span className="grid h-8 w-8 place-items-center rounded-full bg-white/15 ring-1 ring-white/20 transition-transform group-hover:translate-x-0.5">
                              <ChevronRight size={18} strokeWidth={2.5} />
                            </span>
                          </span>
                        </span>
                      </button>
                    );
                  })()}
                  <p className="flex items-center justify-center gap-1.5 text-[10px] font-medium text-muted">
                    <Lock size={11} className="text-success" />
                    100% secured · Razorpay opens only after you confirm
                  </p>
                </div>
              </div>
            )}

            {/* Sticky footer — payment step is the only place that opens Razorpay */}
            {step === "payment" && (
              <div className="flex-shrink-0 bg-white border-t border-line p-3 sm:p-4 safe-pb shadow-[0_-10px_28px_rgba(0,0,0,0.07)] space-y-2">
                <button
                  type="button"
                  disabled={loading || !items.length}
                  onClick={() => void placeOrder()}
                  className={`group relative w-full overflow-hidden rounded-2xl p-3.5 text-left text-white shadow-[0_8px_22px_rgba(0,0,0,0.16)] transition-all duration-200 active:scale-[0.985] disabled:opacity-60 ${
                    loading || !items.length
                      ? "bg-[#bdbdbd]"
                      : effectivePaymentMode === "PARTIAL_COD"
                        ? "bg-gradient-to-r from-bhagva to-bhagva-deep hover:brightness-105"
                        : "bg-brand hover:bg-brand-hover"
                  }`}
                >
                  <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_45%)]" />
                  <span className="relative flex items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/18 ring-1 ring-white/25">
                      {loading ? (
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                      ) : (
                        <Lock size={20} strokeWidth={2.25} />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-extrabold leading-tight tracking-tight">
                        {loading
                          ? "Opening secure checkout…"
                          : `Pay ${formatINR(payNowAmount)} securely`}
                      </span>
                      <span className="mt-0.5 block text-[11px] font-medium text-white/85">
                        {loading
                          ? "Razorpay checkout will open shortly"
                          : "UPI · Cards · Netbanking · Wallets"}
                      </span>
                    </span>
                    {!loading && (
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-white/15 ring-1 ring-white/20 transition-transform group-hover:translate-x-0.5">
                        <ChevronRight size={18} strokeWidth={2.5} />
                      </span>
                    )}
                  </span>
                </button>
                <p className="flex items-center justify-center gap-1.5 text-[10px] font-medium text-muted">
                  <ShieldCheck size={11} className="text-success" />
                  PCI DSS · Encrypted payment via Razorpay
                </p>
              </div>
            )}
          </>
        )}

        {/* Special offer bottom sheet */}
        {offerOpen && (
          <div className="absolute inset-0 z-40 flex flex-col justify-end bg-black/45">
            <button
              type="button"
              className="flex-1 w-full cursor-default"
              aria-label="Close offer"
              onClick={() => afterOffer()}
            />
            <div className="relative w-full max-h-[min(85dvh,560px)] bg-white rounded-t-2xl flex flex-col shadow-2xl">
              <button
                type="button"
                onClick={() => afterOffer()}
                className="absolute -top-10 left-1/2 -translate-x-1/2 h-9 w-9 rounded-full bg-white border border-line-strong grid place-items-center shadow z-10"
              >
                <X size={16} />
              </button>

              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pt-5 pb-2">
                <h3 className="text-lg font-bold text-center leading-snug">
                  {payConfig.specialOfferTitle ||
                    "Wait! We have a special offer just for you 🥳"}
                </h3>
                <div className="mt-4 rounded-xl border border-[#86EFAC] bg-[#F0FDF4] p-3.5 flex gap-3">
                  <div className="flex-1">
                    <span className="inline-block text-[11px] font-bold bg-success-soft text-success px-2 py-0.5 rounded">
                      Flat {formatINR(payConfig.specialOfferAmount || 20)} off
                    </span>
                    <p className="mt-2 text-sm font-semibold">
                      Save {formatINR(payConfig.specialOfferAmount || 20)} with{" "}
                      <span className="inline-block border border-dashed border-[#16A34A] px-1.5 rounded text-success">
                        {payConfig.specialOfferCode || "GET20"}
                      </span>
                    </p>
                    <p className="text-[11px] text-muted mt-1">
                      Discount will be auto-applied at checkout.
                    </p>
                  </div>
                  <Percent size={36} className="text-success opacity-80" />
                </div>
              </div>

              <div className="flex-shrink-0 px-5 pt-2 pb-4 space-y-2 border-t border-line bg-white safe-pb">
                <button
                  type="button"
                  onClick={() => {
                    void applyCoupon(
                      payConfig.specialOfferCode || "GET20",
                    ).finally(() => {
                      if (total >= COUPON_MIN_TOTAL) afterOffer();
                    });
                  }}
                  disabled={total < COUPON_MIN_TOTAL}
                  className="w-full bg-brand text-white rounded-[var(--radius-sm)] py-3.5 text-sm font-bold hover:bg-brand-hover disabled:opacity-50"
                >
                  {total < COUPON_MIN_TOTAL
                    ? `Min ${formatINR(COUPON_MIN_TOTAL)} to claim offer`
                    : `Claim extra ${formatINR(payConfig.specialOfferAmount || 20)} off`}
                </button>
                <button
                  type="button"
                  onClick={() => afterOffer()}
                  className="w-full border border-black rounded-xl py-3 text-sm font-bold"
                >
                  Skip offer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cancel / leave checkout — bottom sheet (same pattern as address) */}
        {cancelOpen && (
          <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/45">
            <button
              type="button"
              className="flex-1 w-full cursor-default"
              aria-label="Close"
              onClick={() => setCancelOpen(false)}
            />
            <div className="relative w-full bg-white rounded-t-2xl px-5 pt-6 pb-5 shadow-2xl safe-pb">
              <button
                type="button"
                onClick={() => setCancelOpen(false)}
                className="absolute -top-10 left-1/2 -translate-x-1/2 h-9 w-9 rounded-full bg-white border border-line-strong grid place-items-center shadow z-10"
              >
                <X size={16} />
              </button>
              <h3 className="text-lg font-bold text-center leading-snug">
                Products in huge demand might run{" "}
                <span className="text-danger">Out of Stock</span>
              </h3>
              <p className="mt-2 text-center text-sm text-text">
                Are you sure you want to cancel payment?
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => exitCheckoutToCart()}
                  className="bg-ink text-white rounded-[var(--radius-sm)] py-3.5 text-sm font-bold"
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setCancelOpen(false)}
                  className="border border-black rounded-xl py-3.5 text-sm font-bold"
                >
                  No
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Coupons drawer */}
        {showCoupons && (
          <div className="animate-sheet-backdrop absolute inset-0 z-40 flex flex-col justify-end bg-black/50">
            <button
              type="button"
              className="flex-1 w-full cursor-default"
              aria-label="Close"
              onClick={() => setShowCoupons(false)}
            />
            <div className="animate-sheet-in relative flex h-[min(82dvh,680px)] w-full flex-col rounded-t-[28px] bg-white shadow-2xl safe-pb">
              <div className="flex flex-shrink-0 justify-center pb-1 pt-2.5">
                <span className="h-1.5 w-10 rounded-full bg-[#e5e5e5]" />
              </div>
              <div className="flex flex-shrink-0 items-start justify-between gap-3 px-5 pb-4 pt-1.5">
                <div>
                  <h3 className="text-lg font-extrabold text-ink">
                    Available Coupons
                  </h3>
                  <p className="mt-0.5 text-[12px] text-muted">
                    Apply a coupon to save more on this order
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCoupons(false)}
                  className="h-9 w-9 rounded-full border border-line grid place-items-center hover:bg-surface-alt flex-shrink-0"
                  aria-label="Close coupons"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pb-4 space-y-3">
                {coupons.length === 0 ? (
                  <p className="text-sm text-muted py-8 text-center">
                    No coupons available right now.
                  </p>
                ) : (
                  coupons.map((c) => (
                    <div
                      key={c.code}
                      className="flex items-center gap-3 rounded-2xl border-2 border-line bg-white p-3.5 transition-colors hover:border-bhagva/50"
                    >
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-bhagva to-bhagva-deep text-white">
                        <Percent size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-sm text-ink tracking-wide">
                          {c.code}
                        </p>
                        <p className="text-[12px] text-muted">{c.label}</p>
                        {c.minOrderAmount != null && c.minOrderAmount > 0 && (
                          <p className="text-[11px] text-subtle mt-0.5">
                            Min order {formatINR(c.minOrderAmount)}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => void applyCoupon(c.code)}
                        className="shrink-0 rounded-full bg-gradient-to-r from-bhagva to-bhagva-deep px-4 py-2 text-xs font-bold text-white shadow-sm transition-all duration-200 active:scale-95 hover:brightness-105"
                      >
                        Apply
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Choose payment method — bigger centered sheet, separated cards, colorful + animated */}
        {paymentMethodModalOpen && (
          <div className="animate-sheet-backdrop absolute inset-0 z-40 flex flex-col justify-end bg-black/50">
            <button
              type="button"
              className="flex-1 w-full cursor-default"
              aria-label="Close"
              onClick={() => setPaymentMethodModalOpen(false)}
            />
            <div className="animate-sheet-in relative flex max-h-[86dvh] w-full flex-col rounded-t-[28px] bg-white shadow-2xl safe-pb">
              <div className="flex flex-shrink-0 justify-center pb-1 pt-2.5">
                <span className="h-1.5 w-10 rounded-full bg-[#e5e5e5]" />
              </div>
              <div className="flex flex-shrink-0 items-start justify-between gap-3 px-5 pb-4 pt-1.5">
                <div>
                  <h3 className="text-lg font-extrabold text-ink">
                    Choose Payment Method
                  </h3>
                  <p className="mt-0.5 text-[12px] text-muted">
                    Pick how you&apos;d like to pay for this order
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPaymentMethodModalOpen(false)}
                  className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full border border-line hover:bg-surface-alt"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 pb-4">
                {/* Full payment card */}
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMode("FULL");
                    setPartialCodWarningOpen(false);
                    try {
                      trackPaymentMethodSelected({
                        method: "RAZORPAY",
                        paymentMode: "FULL",
                      });
                    } catch {
                      /* ignore */
                    }
                  }}
                  className={`w-full rounded-2xl border-2 p-4 text-left transition-all duration-200 ${
                    paymentMode === "FULL"
                      ? "border-brand bg-brand-soft shadow-sm"
                      : "border-line bg-white hover:border-line-strong"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors ${
                        paymentMode === "FULL"
                          ? "bg-brand text-white"
                          : "bg-surface text-muted"
                      }`}
                    >
                      <CreditCard size={19} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-ink">
                        Pay full amount online
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted">
                        {walletProgramOn
                          ? "UPI, Cards · Wallet & cashback apply"
                          : "UPI, Cards, Netbanking"}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-extrabold text-ink">
                      {formatINR(toPay)}
                    </span>
                    <span
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-colors ${
                        paymentMode === "FULL"
                          ? "border-brand bg-brand"
                          : "border-line-strong bg-white"
                      }`}
                    >
                      {paymentMode === "FULL" && (
                        <Check
                          size={11}
                          strokeWidth={3}
                          className="text-white"
                        />
                      )}
                    </span>
                  </div>
                </button>

                {/* Partial COD card */}
                <button
                  type="button"
                  disabled={partialCodLockedByMin || !partialCodEligible}
                  aria-disabled={partialCodLockedByMin || !partialCodEligible}
                  onClick={() => {
                    if (partialCodLockedByMin || !partialCodEligible) return;
                    setPaymentMode("PARTIAL_COD");
                    setUseWallet(false);
                    if (
                      walletProgramOn &&
                      ((walletInfo?.balance || 0) > 0 || cashbackEarnEnabled)
                    ) {
                      setPartialCodWarningOpen(true);
                    }
                    try {
                      trackPaymentMethodSelected({
                        method: "RAZORPAY",
                        paymentMode: "PARTIAL_COD",
                      });
                    } catch {
                      /* ignore */
                    }
                  }}
                  className={`w-full rounded-2xl border-2 p-4 text-left transition-all duration-200 ${
                    partialCodLockedByMin || !partialCodEligible
                      ? "cursor-not-allowed border-line bg-surface-alt opacity-[0.72]"
                      : paymentMode === "PARTIAL_COD"
                        ? "border-bhagva bg-bhagva-soft shadow-sm"
                        : "border-line bg-white hover:border-line-strong"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors ${
                        partialCodLockedByMin || !partialCodEligible
                          ? "bg-[#ececec] text-subtle"
                          : paymentMode === "PARTIAL_COD"
                            ? "bg-gradient-to-br from-bhagva to-bhagva-deep text-white"
                            : "bg-surface text-muted"
                      }`}
                    >
                      <Split size={19} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p
                          className={`text-sm font-bold ${
                            partialCodLockedByMin || !partialCodEligible
                              ? "text-muted"
                              : "text-ink"
                          }`}
                        >
                          Partial COD
                        </p>
                        {partialCodLockedByMin ? (
                          <span className="rounded border border-line bg-white px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wide text-muted">
                            Unavailable
                          </span>
                        ) : (
                          <>
                            <span className="rounded border border-red-100 bg-red-50 px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wide text-red-700">
                              Advance non-refundable
                            </span>
                            <span className="rounded border border-[#f0c896] bg-[#FFF8F0] px-1.5 py-[1px] text-[9px] font-bold tracking-wide text-[#9a6b2f]">
                              {partialCodRuleLabel}
                            </span>
                          </>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted">
                        {partialCodEligible
                          ? `Pay ${formatINR(partialCodAdvance)} now (${partialCodRuleLabel.toLowerCase()}), rest on delivery${walletProgramOn ? " · no wallet / cashback" : ""}`
                          : "Pay a bit now, rest on delivery"}
                      </p>
                    </div>
                    {partialCodEligible ? (
                      <span className="shrink-0 text-sm font-extrabold text-ink">
                        {formatINR(partialCodAdvance)}
                      </span>
                    ) : null}
                    <span
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-colors ${
                        paymentMode === "PARTIAL_COD" && partialCodEligible
                          ? "border-bhagva bg-bhagva"
                          : "border-line-strong bg-white"
                      }`}
                    >
                      {paymentMode === "PARTIAL_COD" && partialCodEligible && (
                        <Check
                          size={11}
                          strokeWidth={3}
                          className="text-white"
                        />
                      )}
                    </span>
                  </div>

                  {partialCodLockedByMin ? (
                    <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-snug text-amber-900">
                      <Info
                        size={14}
                        className="mt-0.5 shrink-0 text-amber-700"
                        aria-hidden
                      />
                      <span>
                        Partial COD needs an order above the minimum advance of{" "}
                        <strong>{formatINR(partialCodMinAdvance)}</strong>. Add{" "}
                        <strong>{formatINR(partialCodShortfall)}</strong> more
                        to unlock Cash on Delivery.
                      </span>
                    </p>
                  ) : null}

                  {/* Smooth, separated timeline breakdown — expands without a modal-in-modal */}
                  {partialCodEligible ? (
                    <div
                      className={`rows-accordion ${paymentMode === "PARTIAL_COD" ? "is-open" : ""}`}
                    >
                      <div>
                        <div className="relative mt-4 rounded-xl border border-[#f3dcb8] bg-white/80 p-3.5 pl-9">
                          <span
                            className="absolute bottom-4 left-[21px] top-4 w-px bg-[#f0c896]"
                            aria-hidden
                          />
                          <div className="relative pb-3.5">
                            <span className="absolute -left-[21px] top-0 grid h-5 w-5 place-items-center rounded-full bg-bhagva text-white">
                              <Check size={11} strokeWidth={3} />
                            </span>
                            <p className="text-[13px] font-bold text-ink">
                              Pay now · {formatINR(partialCodAdvance)}
                            </p>
                            <p className="mt-0.5 text-[11px] text-[#8a7355]">
                              {partialCodRuleLabel} · paid securely online via
                              Razorpay
                            </p>
                          </div>
                          <div className="relative">
                            <span className="absolute -left-[21px] top-0 grid h-5 w-5 place-items-center rounded-full border-2 border-[#f0c896] bg-white" />
                            <p className="text-[13px] font-bold text-ink">
                              Pay on delivery · {formatINR(partialCodDue)}
                            </p>
                            <p className="mt-0.5 text-[11px] text-[#8a7355]">
                              Collected in cash by the delivery agent
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </button>
              </div>

              {/* Separated CTA footer — always visible, colorful, reflects the current choice */}
              <div className="flex-shrink-0 border-t border-line bg-[#FAFAF8] px-5 pb-4 pt-4 safe-pb">
                <button
                  type="button"
                  onClick={() => {
                    if (!partialCodEligible) setPaymentMode("FULL");
                    setPaymentMethodChosen(true);
                    setPaymentMethodModalOpen(false);
                    goToPaymentStep("payment_method");
                  }}
                  className={`w-full rounded-2xl py-3.5 text-sm font-bold text-white shadow-md transition-all duration-200 active:scale-[0.98] ${
                    paymentMode === "PARTIAL_COD"
                      ? "bg-gradient-to-r from-bhagva to-bhagva-deep hover:brightness-105"
                      : "bg-brand hover:bg-brand-hover"
                  }`}
                >
                  {paymentMode === "PARTIAL_COD"
                    ? `Continue with Partial COD · ${formatINR(partialCodAdvance)}`
                    : `Continue · ${formatINR(toPay)}`}
                </button>
              </div>
            </div>
          </div>
        )}

        {paymentMethodModalOpen && partialCodWarningOpen && (
          <PartialCodWarningSheet
            walletBalance={walletInfo?.balance || 0}
            walletSavings={walletMaxForOrder}
            cashbackEarn={cashbackEarn}
            cashbackPercent={cashbackPercent}
            formatINR={formatINR}
            onContinue={() => setPartialCodWarningOpen(false)}
            onSwitchFull={() => {
              setPaymentMode("FULL");
              setPartialCodWarningOpen(false);
            }}
          />
        )}

        {/* Order summary drawer */}
        {summaryOpen && (
          <div className="absolute inset-0 z-40 flex flex-col justify-end bg-black/45">
            <button
              type="button"
              className="flex-1 w-full cursor-default"
              aria-label="Close"
              onClick={() => setSummaryOpen(false)}
            />
            <div className="relative w-full h-[min(88dvh,760px)] bg-white rounded-t-2xl flex flex-col shadow-2xl">
              <div className="flex-shrink-0 flex items-center justify-between gap-3 px-5 pt-5 pb-3 border-b border-line">
                <div className="flex items-center gap-2.5 min-w-0">
                  <ShoppingCart size={18} className="text-[#222] flex-shrink-0" />
                  <h3 className="font-bold text-base">Order Summary</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSummaryOpen(false)}
                  className="h-9 w-9 rounded-full border border-line-strong grid place-items-center hover:bg-surface-alt flex-shrink-0"
                  aria-label="Close summary"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pt-4 pb-4">
                <ul className="space-y-5">
                  {items.map(({ product, quantity }) => {
                    const addon = getCartAddonBreakdown(product);
                    const upsellPricing = product.isAddonUpsell
                      ? getAddonUpsellPricing(product, quantity)
                      : null;
                    const mainTotal = product.isAddonUpsell
                      ? upsellPricing!.lineTotal
                      : addon.selected
                        ? addon.baseUnitPrice * quantity
                        : product.price * quantity;
                    return (
                      <li key={cartLineKey(product)} className="space-y-3">
                        <div className="flex gap-3.5">
                        <div className="relative h-[68px] w-[68px] rounded-xl overflow-hidden bg-surface flex-shrink-0">
                          {product.image && (
                            <Image
                              src={product.image}
                              alt=""
                              fill
                              className="object-cover"
                              sizes="68px"
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] font-semibold line-clamp-2 leading-snug">
                            {product.title}
                          </p>
                          <p className="text-[13px] text-text mt-1.5 font-medium">
                            Qty: {quantity}
                            {upsellPricing && upsellPricing.extraQty > 0
                              ? ` · ${upsellPricing.comboQty}× combo + ${upsellPricing.extraQty}× full`
                              : product.isAddonUpsell
                                ? " · Add-on"
                                : ""}
                          </p>
                        </div>
                        <div className="text-right text-sm flex-shrink-0">
                          <p className="font-bold">
                            {product.isFreeProduct &&
                            addon.baseUnitPrice <= 0 &&
                            !addon.selected ? (
                              <FreePriceLabel size="sm" />
                            ) : (
                              formatINR(mainTotal)
                            )}
                          </p>
                        </div>
                        </div>
                        {addon.selected ? (
                          <div className="flex gap-3.5 rounded-xl border border-line bg-surface-alt p-2.5">
                            <div className="relative h-[68px] w-[68px] rounded-xl overflow-hidden bg-surface flex-shrink-0">
                              {product.image ? (
                                <Image
                                  src={product.image}
                                  alt=""
                                  fill
                                  className="object-cover"
                                  sizes="68px"
                                />
                              ) : null}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9a3412]">
                                Add-on
                              </p>
                              <p className="text-[15px] font-semibold line-clamp-2 leading-snug">
                                {addon.name}
                              </p>
                              <p className="text-[13px] text-text mt-1.5 font-medium">
                                Qty: {quantity * addon.units}
                              </p>
                            </div>
                            <div className="text-right text-sm flex-shrink-0">
                              <p className="font-bold">
                                {formatINR(addon.perParentQty * quantity)}
                              </p>
                            </div>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                  {payConfig.prepaidGiftEnabled && (
                    <li className="flex gap-3.5">
                      <div className="h-[68px] w-[68px] rounded-xl bg-success-soft grid place-items-center flex-shrink-0">
                        <Gift size={24} className="text-success" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium line-clamp-2 leading-snug">
                          {payConfig.prepaidGiftTitle ||
                            "Free gift on prepaid orders"}
                        </p>
                        <span className="inline-block mt-1.5 text-[10px] font-bold bg-success-soft text-success px-1.5 py-0.5 rounded">
                          Free Item
                        </span>
                      </div>
                      <div className="text-right text-sm flex-shrink-0">
                        <p className="font-bold">{formatINR(0)}</p>
                        <p className="text-[11px] text-subtle line-through mt-0.5">
                          {formatINR(giftWorth)}
                        </p>
                      </div>
                    </li>
                  )}
                </ul>
                <FreeGiftRows
                  gifts={freeGifts.gifts}
                  unavailable={freeGifts.unavailable}
                  variant="summary"
                  className="mt-5"
                />

                <div className="mt-6 rounded-xl bg-surface p-4 space-y-3 text-sm">
                  <div className="flex justify-between text-[15px]">
                    <span className="text-muted">MRP Total</span>
                    <span className="font-semibold">{formatINR(compare)}</span>
                  </div>
                  {siddhUnits > 0 ? (
                    <div className="flex justify-between items-start gap-3 text-[13px]">
                      <span className="text-muted min-w-0">
                        <span className="font-semibold text-ink">
                          Siddh / Charged × {siddhUnits}
                        </span>
                        <span className="block text-[11px] text-muted mt-0.5 font-medium">
                          {siddhLabel}
                          {siddhTotal > 0
                            ? ` · ${formatINR(Math.round(siddhTotal / siddhUnits))}/unit`
                            : ""}
                        </span>
                      </span>
                      <span className="font-semibold text-ink tabular-nums shrink-0">
                        {siddhTotal > 0
                          ? `+${formatINR(siddhTotal)}`
                          : "Included"}
                      </span>
                    </div>
                  ) : null}
                  {savings > 0 && (
                    <div className="flex justify-between text-success font-medium text-[15px]">
                      <span>Discount on MRP</span>
                      <span>-{formatINR(savings)}</span>
                    </div>
                  )}
                  {couponDiscount > 0 && (
                    <div className="flex justify-between text-success font-medium items-center gap-2">
                      <span className="flex items-center gap-2 min-w-0">
                        Coupon ({appliedCoupon?.code})
                        <button
                          type="button"
                          onClick={removeCoupon}
                          className="text-[11px] font-bold text-red-600 underline underline-offset-2"
                        >
                          Remove
                        </button>
                      </span>
                      <span>-{formatINR(couponDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted">Subtotal</span>
                    <span>{formatINR(merchandise)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">
                      {freeProductsOnly
                        ? "Free product shipping"
                        : shippingConfig.label || "Shipping"}
                    </span>
                    {freeShipping ? (
                      <span className="text-success font-semibold">Free</span>
                    ) : (
                      <span>{formatINR(shippingTotal)}</span>
                    )}
                  </div>
                  {taxConfig.enabled && taxTotal > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted">
                        {taxConfig.label || "GST"}
                        {taxConfig.gstPercent
                          ? ` (${taxConfig.gstPercent}%)`
                          : ""}
                        {taxConfig.inclusive ? " incl." : ""}
                      </span>
                      <span>
                        {taxConfig.inclusive ? "" : "+"}
                        {formatINR(taxTotal)}
                      </span>
                    </div>
                  )}
                  {showWalletToggle && (
                      <div className="pt-2 border-t border-line space-y-2">
                        <label className="flex items-center justify-between gap-3 cursor-pointer">
                          <span className="flex items-center gap-2 min-w-0 text-success font-medium">
                            <input
                              type="checkbox"
                              className="accent-[var(--brand)] shrink-0"
                              checked={useWallet}
                              onChange={(e) => onWalletToggle(e.target.checked)}
                            />
                            <Wallet size={14} className="shrink-0" />
                            <span>
                              Wallet
                              <span className="block text-[11px] font-normal text-success">
                                {walletInfo.redeemPercent}% of products · bal.{" "}
                                {formatINR(walletInfo.balance)}
                              </span>
                            </span>
                          </span>
                          <span
                            className={`font-semibold tabular-nums shrink-0 ${
                              useWallet ? "text-success" : "text-subtle"
                            }`}
                          >
                            {useWallet
                              ? `-${formatINR(walletRedeem)}`
                              : `−${formatINR(walletMaxForOrder)}`}
                          </span>
                        </label>
                      </div>
                    )}
                  {cashbackEarn > 0 && (
                    <div className="pt-2 border-t border-line">
                      <div className="flex justify-between items-start gap-3 text-[#854D0E]">
                        <span className="font-medium">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="rounded bg-brand text-white text-[9px] font-extrabold uppercase px-1.5 py-0.5">
                              {cashbackPercent}% Cashback
                            </span>
                          </span>
                          <span className="block text-[11px] font-normal text-[#A16207] mt-1">
                            Credited to Wallet{" "}
                            {walletInfo?.creditTiming === "instant"
                              ? "after payment"
                              : "after delivery"}
                          </span>
                        </span>
                        <span className="font-bold tabular-nums shrink-0 text-[#854D0E]">
                          +{formatINR(cashbackEarn)}
                        </span>
                      </div>
                    </div>
                  )}
                  {effectivePaymentMode === "PARTIAL_COD" && walletProgramOn && (
                    <p className="pt-2 border-t border-line text-[11px] leading-snug text-amber-800">
                      Wallet &amp; cashback apply only on full prepaid orders.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex-shrink-0 px-5 py-4 border-t border-line bg-white safe-pb space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-base font-bold">To Pay</span>
                  <span className="text-base font-bold tabular-nums">
                    {formatINR(toPay)}
                  </span>
                </div>
                {walletRedeem > 0 && (
                  <p className="text-[12px] text-success font-medium text-right">
                    Includes wallet savings of {formatINR(walletRedeem)}
                  </p>
                )}
                {cashbackEarn > 0 && (
                  <p className="text-[12px] text-[#A16207] font-medium text-right">
                    You&apos;ll earn {formatINR(cashbackEarn)} cashback (
                    {cashbackPercent}% of amount paid)
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Address bottom sheet */}
        {(addressSheet || step === "address") && (
          <div className="absolute inset-0 z-40 flex flex-col justify-end bg-black/45">
            <button
              type="button"
              className="flex-1 w-full cursor-default"
              aria-label="Close"
              onClick={handleAddressSheetClose}
            />

            {addressMode === "list" && savedAddresses.length > 0 ? (
              <div className="relative w-full h-[min(90dvh,780px)] bg-white rounded-t-2xl flex flex-col shadow-2xl">
                <button
                  type="button"
                  onClick={handleAddressSheetClose}
                  className="absolute -top-10 left-1/2 -translate-x-1/2 h-9 w-9 rounded-full bg-white border border-line-strong grid place-items-center shadow z-10"
                >
                  <X size={16} />
                </button>

                <div className="flex-shrink-0 px-5 pt-5 pb-2">
                  <h3 className="font-bold text-base">Select delivery address</h3>
                  <p className="text-[12px] text-muted mt-1">
                    Choose a saved address or add a new one
                  </p>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pt-2 pb-4 space-y-3">
                  {savedAddresses.map((saved) => {
                    const selected = address.id === saved.id;
                    return (
                      <button
                        key={saved.id}
                        type="button"
                        onClick={() => selectSavedAddress(saved)}
                        className={`w-full text-left rounded-xl border p-3.5 ${
                          selected
                            ? "border-black bg-surface-alt"
                            : "border-line hover:border-[#bbb]"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-surface">
                            {saved.label || "Address"}
                          </span>
                          {saved.isDefault && (
                            <span className="text-[11px] font-bold text-success">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="font-bold text-sm">
                          {toTitleCase(saved.name)}
                        </p>
                        <p className="text-[12px] text-text mt-1 leading-relaxed">
                          {saved.line1}
                          {saved.line2 ? `, ${saved.line2}` : ""},{" "}
                          {toTitleCase(saved.city)} {toTitleCase(saved.state)},{" "}
                          {saved.pincode}
                        </p>
                        <p className="text-[12px] text-muted mt-1">
                          +91 {saved.phone}
                        </p>
                      </button>
                    );
                  })}
                </div>

                <div className="flex-shrink-0 px-5 py-3 border-t border-line bg-white safe-pb space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      blankAddress(
                        user?.name || address.name,
                        user?.email || address.email,
                      );
                      setAddressMode("form");
                    }}
                    className="w-full rounded-xl border border-black py-3.5 text-sm font-bold"
                  >
                    Add new address
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={saveAddress}
                className="relative w-full h-[min(90dvh,780px)] bg-white rounded-t-2xl flex flex-col shadow-2xl"
              >
                <button
                  type="button"
                  onClick={() => {
                    if (savedAddresses.length > 0) {
                      setAddressMode("list");
                      return;
                    }
                    handleAddressSheetClose();
                  }}
                  className="absolute -top-10 left-1/2 -translate-x-1/2 h-9 w-9 rounded-full bg-white border border-line-strong grid place-items-center shadow z-10"
                >
                  <X size={16} />
                </button>

                <div className="flex-shrink-0 px-5 pt-5 pb-2">
                  <h3 className="font-bold text-base">
                    {address.id ? "Edit Delivery Address" : "Add Delivery Address"}
                  </h3>
                  {savedAddresses.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setAddressMode("list")}
                      className="mt-1 text-xs font-semibold text-[#2563EB]"
                    >
                      ← Back to saved addresses
                    </button>
                  )}
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pt-3 pb-4 space-y-5">
                  <FloatingInput
                    label="Pincode"
                    required
                    inputMode="numeric"
                    maxLength={6}
                    value={address.pincode}
                    onChange={(e) => {
                      const nextPin = e.target.value
                        .replace(/\D/g, "")
                        .slice(0, 6);
                      setAddress((a) => ({
                        ...a,
                        id: a.id,
                        pincode: nextPin,
                        ...(nextPin.length === 6
                          ? {}
                          : { city: "", state: "" }),
                      }));
                      setPinError("");
                      if (nextPin.length === 6) {
                        void lookupAddressPincode(nextPin);
                      } else {
                        setPinLookupFor("");
                      }
                    }}
                    placeholder="362001"
                  />
                  {pinLoading && (
                    <p className="text-[11px] text-muted -mt-2">
                      Looking up city &amp; state…
                    </p>
                  )}
                  {pinError && !pinLoading && (
                    <p className="text-[12px] text-red-600 -mt-2">{pinError}</p>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <FloatingInput
                      label="City"
                      required
                      readOnly
                      tabIndex={-1}
                      value={address.city}
                    />
                    <FloatingInput
                      label="State"
                      required
                      readOnly
                      tabIndex={-1}
                      value={address.state}
                    />
                  </div>

                  <FloatingInput
                    label="Flat, House no."
                    required
                    value={address.line1}
                    onChange={(e) =>
                      setAddress((a) => ({ ...a, line1: e.target.value }))
                    }
                  />
                  <FloatingInput
                    label="Apartment, Area, Sector, Village"
                    value={address.line2}
                    onChange={(e) =>
                      setAddress((a) => ({ ...a, line2: e.target.value }))
                    }
                  />

                  <h4 className="font-bold text-sm pt-1">Customer Information</h4>
                  <FloatingInput
                    label="Full Name"
                    required
                    value={address.name}
                    onChange={(e) =>
                      setAddress((a) => ({ ...a, name: e.target.value }))
                    }
                  />
                  <FloatingInput
                    label="Email Address"
                    type="email"
                    required
                    value={address.email}
                    onChange={(e) =>
                      setAddress((a) => ({ ...a, email: e.target.value }))
                    }
                  />

                  <div>
                    <p className="text-sm font-bold mb-2">Save Address As</p>
                    <div className="flex gap-3">
                      {(["Home", "Work"] as const).map((label) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => setAddress((a) => ({ ...a, label }))}
                          className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium ${
                            address.label === label
                              ? "border-black"
                              : "border-line-strong"
                          }`}
                        >
                          <span
                            className={`h-3.5 w-3.5 rounded-full border grid place-items-center ${
                              address.label === label
                                ? "border-black"
                                : "border-[#aaa]"
                            }`}
                          >
                            {address.label === label && (
                              <span className="h-2 w-2 rounded-full bg-black" />
                            )}
                          </span>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-line p-3.5 flex items-start gap-3">
                    <div className="flex-1">
                      <p className="font-semibold text-sm">Free Shipping</p>
                      <p className="text-[12px] text-muted mt-0.5">
                        Faster Delivery on Prepaid orders{" "}
                        <span className="text-success font-bold">Free</span>
                      </p>
                    </div>
                    <span className="h-4 w-4 rounded-full border border-black grid place-items-center mt-0.5">
                      <span className="h-2 w-2 rounded-full bg-black" />
                    </span>
                  </div>
                </div>

                <div className="flex-shrink-0 px-5 py-3 border-t border-line bg-white safe-pb">
                  <button
                    type="submit"
                    disabled={!addressValid || loading}
                    className={`w-full rounded-xl py-3.5 text-sm font-bold ${
                      addressValid && !loading
                        ? "bg-black text-white"
                        : "bg-[#d3d3d3] text-muted cursor-not-allowed"
                    }`}
                  >
                    {loading ? "Saving…" : "Continue"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
    </>
  );
}

function PartialCodWarningSheet({
  walletBalance,
  walletSavings,
  cashbackEarn,
  cashbackPercent,
  formatINR,
  onContinue,
  onSwitchFull,
}: {
  walletBalance: number;
  walletSavings: number;
  cashbackEarn: number;
  cashbackPercent: number;
  formatINR: (n: number) => string;
  onContinue: () => void;
  onSwitchFull: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onContinue();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onContinue]);

  const hasWallet = walletBalance > 0 && walletSavings > 0;
  const hasCashback = cashbackEarn > 0;

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/55">
      <button
        type="button"
        className="flex-1 w-full cursor-default"
        aria-label="Close"
        onClick={onContinue}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="partial-cod-warning-title"
        className="relative w-full rounded-t-2xl bg-white px-5 pt-6 pb-5 shadow-2xl safe-pb"
      >
        <button
          type="button"
          onClick={onContinue}
          className="absolute -top-10 left-1/2 z-10 grid h-9 w-9 -translate-x-1/2 place-items-center rounded-full border border-line-strong bg-white shadow"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-amber-50 ring-1 ring-amber-200">
          <Info size={22} className="text-amber-700" aria-hidden />
        </div>

        <h3
          id="partial-cod-warning-title"
          className="text-center text-base font-bold leading-snug text-ink"
        >
          Wallet &amp; cashback not available
        </h3>
        <p className="mt-2 text-center text-[13px] leading-relaxed text-text">
          Partial COD pays a small advance online and the rest on delivery.
          Prepaid-only benefits don&apos;t apply with this option.
        </p>

        <ul className="mt-4 space-y-2.5 rounded-xl border border-amber-100 bg-amber-50/60 px-3.5 py-3">
          <li className="flex items-start gap-2.5 text-[12px] leading-snug text-amber-950">
            <Wallet size={15} className="mt-0.5 shrink-0 text-amber-700" />
            <span>
              <strong>Wallet balance cannot be used</strong>
              {hasWallet ? (
                <>
                  {" "}
                  — you&apos;re missing up to{" "}
                  <strong>{formatINR(walletSavings)}</strong> savings
                  {walletBalance > walletSavings
                    ? ` (balance ${formatINR(walletBalance)})`
                    : ""}
                </>
              ) : walletBalance > 0 ? (
                <> — balance {formatINR(walletBalance)} stays unused</>
              ) : null}
            </span>
          </li>
          {hasCashback ? (
            <li className="flex items-start gap-2.5 text-[12px] leading-snug text-amber-950">
              <Gift size={15} className="mt-0.5 shrink-0 text-amber-700" />
              <span>
                <strong>No cashback on this order</strong>
                {" "}
                — full prepaid would earn{" "}
                <strong>{formatINR(cashbackEarn)}</strong>
                {cashbackPercent > 0 ? ` (${cashbackPercent}%)` : ""}
              </span>
            </li>
          ) : null}
        </ul>

        <p className="mt-3 text-center text-[11px] leading-snug text-muted">
          Advance paid online is non-refundable once the order is placed.
        </p>

        <div className="mt-5 space-y-2.5">
          <button
            type="button"
            onClick={onSwitchFull}
            className="w-full rounded-[var(--radius-sm)] bg-brand hover:bg-brand-hover py-3.5 text-sm font-bold text-white shadow-sm hover:brightness-105"
          >
            Pay full amount online
            {(hasWallet || hasCashback) && (
              <span className="block text-[11px] font-semibold opacity-90">
                {hasWallet && hasCashback
                  ? `Use wallet · earn ${formatINR(cashbackEarn)} cashback`
                  : hasWallet
                    ? `Save up to ${formatINR(walletSavings)} with wallet`
                    : `Earn ${formatINR(cashbackEarn)} cashback`}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="w-full rounded-xl border border-line py-3 text-sm font-bold text-[#444] hover:bg-surface-alt"
          >
            Continue with Partial COD anyway
          </button>
        </div>
      </div>
    </div>
  );
}

function checkoutErrorHeading(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("coupon")) return "Coupon not applied";
  if (lower.includes("payment") || lower.includes("razorpay")) {
    return "Payment issue";
  }
  if (lower.includes("address") || lower.includes("pincode")) {
    return "Address issue";
  }
  if (lower.includes("login") || lower.includes("otp")) return "Login required";
  return "Please check";
}

function CheckoutErrorSheet({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const heading = checkoutErrorHeading(message);

  return (
    <div className="absolute inset-0 z-[100] flex flex-col justify-end bg-black/45">
      <button
        type="button"
        className="flex-1 w-full cursor-default"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="checkout-error-title"
        aria-describedby="checkout-error-desc"
        className="relative w-full bg-white rounded-t-2xl px-5 pt-6 pb-5 shadow-2xl safe-pb"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-10 left-1/2 -translate-x-1/2 h-9 w-9 rounded-full bg-white border border-line-strong grid place-items-center shadow z-10"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        <h3
          id="checkout-error-title"
          className="text-base font-bold text-center leading-snug text-ink"
        >
          {heading}
        </h3>
        <p
          id="checkout-error-desc"
          className="mt-2 text-center text-[13px] text-text leading-relaxed"
        >
          {message}
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-xl bg-black py-3.5 text-sm font-bold text-white hover:bg-[#222]"
        >
          OK, got it
        </button>
      </div>
    </div>
  );
}
