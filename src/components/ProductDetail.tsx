"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { WishlistButton } from "@/components/WishlistButton";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Gift,
  MapPin,
  Percent,
  Star,
  Timer,
  Truck,
  Users,
  BadgeCheck,
  RefreshCw,
  X,
  Eye,
  Play,
  Heart,
  Send,
  Share2,
  ShoppingCart,
  Volume2,
  VolumeX,
  ExternalLink,
  Link2,
  Check,
  Info,
  Store,
} from "lucide-react";
import type { PdpBanner, Product } from "@/lib/api";
import { PdpPromoBanner } from "@/components/PdpPromoBanner";
import { ProductCard } from "@/components/ProductCard";
import {
  api,
  BRAND,
  formatINR,
  formatOfferLabel,
  discountPercent,
} from "@/lib/api";
import { useCart, maxOrderQty } from "@/lib/cart";
import { looksLikeHtml, sanitizeProductHtml } from "@/lib/sanitize-html";
import { trackProductView, trackBuyNowEvent } from "@/lib/analytics";
import {
  PRODUCT_HERO_QUALITY,
  PRODUCT_HERO_SIZES,
} from "@/lib/product-hero-image";
import { useStoreOffer } from "@/components/StoreOfferProvider";
import { getDefaultPackIndex, getProductPacks, packQuantityFromLabel } from "@/lib/product-packs";
import {
  findMatchingVariant,
  getDefaultAttributeSelection,
  isAttributeValueAvailable,
  isColorAttributeGroup,
  colorHexFromLabel,
} from "@/lib/product-variants";
import { trackViewContent } from "@/lib/meta-pixel";
import { checkDeliveryPincode } from "@/lib/pincode";
import { OrderSocialProofToast } from "@/components/OrderSocialProofToast";
import { FreePriceLabel } from "@/components/FreeProductBadge";
import { isUsableImageSrc } from "@/lib/is-usable-image-src";
import { productImageDetail } from "@/lib/product-image-seo";
import { RecentlyViewed } from "@/components/RecentlyViewed";
import { ProductReviews } from "@/components/reviews/ProductReviews";

const REVIEW_THEMES = [
  {
    border: "border-[#BAE6FD]",
    bg: "bg-gradient-to-br from-white via-white to-[#F0F9FF]",
  },
  {
    border: "border-[#C4B5FD]",
    bg: "bg-gradient-to-br from-white via-white to-[#F5F3FF]",
  },
  {
    border: "border-[#F9A8D4]",
    bg: "bg-gradient-to-br from-white via-white to-[#FDF2F8]",
  },
  {
    border: "border-[#6EE7B7]",
    bg: "bg-gradient-to-br from-white via-white to-[#ECFDF5]",
  },
  {
    border: "border-[#FCD34D]",
    bg: "bg-gradient-to-br from-white via-white to-brand-soft",
  },
];

function Countdown({ endsAt }: { endsAt?: string | null }) {
  const end = useMemo(() => {
    if (!endsAt?.trim()) return null;
    const t = new Date(endsAt).getTime();
    return Number.isFinite(t) ? t : null;
  }, [endsAt]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!end) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [end]);

  if (!end) return null;

  const diff = end - now;
  // No end time left / expired → hide
  if (diff <= 0) return null;

  const totalHours = diff / 3600000;
  const urgent = totalHours < 12;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div
      className={`rounded-xl border px-3 py-2.5 text-center ${
        urgent
          ? "border-red-200 bg-red-50"
          : "border-emerald-200 bg-emerald-50/60"
      }`}
    >
      <p
        className={`text-[13px] sm:text-sm font-semibold tabular-nums ${
          urgent ? "text-red-600" : "text-success"
        }`}
      >
        Offer ends in{" "}
        <span className="font-bold">
          {pad(h)} hr : {pad(m)} min : {pad(s)} sec
        </span>
      </p>
    </div>
  );
}

const DEFAULT_PACKAGING_BODY =
  "Presented in a sturdy black kappa box with foam, designed especially for safekeeping and gifting.";

const DEFAULT_RETURNS_BODY =
  "We offer a 7-day return policy from the date of delivery. Items must be unused, in original packaging, and with all tags attached. Damaged or used products are not eligible for return.";

function stripHtml(input?: string | null) {
  return String(input || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const DEFAULT_CASHBACK_BODY = `1. Offer Eligibility & Applicability
1.1. Prepaid Orders Only — Cashback applies only on prepaid (online) orders.

1.2. Scenario A — Eligible prepaid order: cashback is credited to your store wallet after delivery.
1.3. Scenario B — Partial COD, full COD, cancelled or returned orders: cashback is not applicable, and wallet balance cannot be used on Partial COD.

2. Calculation & Limits
Cashback is calculated on the paid merchandise value (after coupons; before shipping where exclusive). Caps and rates may vary by campaign.

3. Credit & Timeline
Wallet credit is typically issued within 7–14 days after successful delivery and the return window closing.`;

function accordionTitleKey(title: string) {
  return title.trim().toLowerCase().replace(/\?+$/, "");
}

/** Stable ids for SpeakableSpecification / HowTo / FAQ CSS selectors. */
function accordionSectionId(title: string): string | undefined {
  const key = accordionTitleKey(title);
  if (/^faq|frequently asked/.test(key)) return "product-faqs";
  if (/^how to wear|^how to use|^how should|^how to place|^placement/.test(key))
    return "product-how-to-use";
  if (/cashback/.test(key)) return "pdp-accordion-cashback";
  return undefined;
}

function AccordionRow({
  title,
  children,
  defaultOpen = false,
  id,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  id?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div id={id} className="border-b border-[#E8E8E8]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 py-4 text-left text-[15px] font-semibold text-ink"
      >
        <span>{title}</span>
        <span
          className={`relative grid h-5 w-5 shrink-0 place-items-center text-text transition-transform duration-300 ease-out ${
            open ? "rotate-45" : "rotate-0"
          }`}
          aria-hidden
        >
          <span className="absolute h-[1.5px] w-3.5 rounded-full bg-current" />
          <span className="absolute h-3.5 w-[1.5px] rounded-full bg-current" />
        </span>
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className={`pb-5 text-[14px] text-text leading-relaxed transition-opacity duration-300 ease-out ${
              open ? "opacity-100" : "opacity-0"
            }`}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function parseSpecRows(spec?: string | null) {
  if (!spec?.trim()) return [];
  return spec
    .split(/\n|·|\|/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^([^:–-]+)\s*[:–-]\s*(.+)$/);
      if (m) return { label: m[1].trim(), value: m[2].trim() };
      return null;
    })
    .filter(Boolean) as { label: string; value: string }[];
}

export function ProductDetail({
  product,
  related,
  renderTitle = true,
  titleAs = "h1",
  initialPackIdx,
  pdpBanner,
}: {
  product: Product;
  related: Product[];
  /** Admin offer banner shown between the delivery check and reviews. */
  pdpBanner?: PdpBanner | null;
  /** When false, omit visible title (unused — prefer titleAs). */
  renderTitle?: boolean;
  /** Heading level for the product name — server page sets h1 for SEO. */
  titleAs?: "h1" | "p";
  /** Server-computed default pack index — avoids post-hydration price shift. */
  initialPackIdx?: number;
}) {
  const TitleTag = titleAs;
  const offer = useStoreOffer();
  const images = useMemo(() => {
    const list =
      product.images && product.images.length > 0
        ? [...product.images]
        : product.image
          ? [product.image]
          : [];
    const usable = list.filter(isUsableImageSrc);
    const primary = isUsableImageSrc(product.image) ? product.image! : null;
    if (primary && usable.length) {
      const rest = usable.filter((u) => u !== primary);
      return [primary, ...rest];
    }
    return usable;
  }, [product.images, product.image]);

  const relatedItems = useMemo(
    () =>
      (related || [])
        .filter((p) => p.id !== product.id)
        .slice(0, 8)
        .map((p) => ({
          ...p,
          image: isUsableImageSrc(p.image) ? p.image : "",
        })),
    [related, product.id],
  );

  const [active, setActive] = useState(0);
  /** Defer neighbor/thumbnail bandwidth until the LCP hero has painted. */
  const [heroReady, setHeroReady] = useState(false);
  const [galleryPaused, setGalleryPaused] = useState(false);
  const galleryRef = useRef<HTMLDivElement>(null);
  const galleryProgrammatic = useRef(false);
  const [packIdx, setPackIdx] = useState(
    initialPackIdx ?? getDefaultPackIndex(product),
  );
  const [attributeSelection, setAttributeSelection] = useState<
    Record<string, string>
  >(() => getDefaultAttributeSelection(product));

  const packs = useMemo(() => getProductPacks(product), [product.variantOptions]);
  const attributeGroups = product.attributeOptions || [];
  const hasAttributeVariants =
    !!product.hasVariants && attributeGroups.length > 0;
  const selectedAttrVariant = useMemo(
    () =>
      hasAttributeVariants
        ? findMatchingVariant(product, attributeSelection)
        : null,
    [hasAttributeVariants, product, attributeSelection],
  );
  const displayImages = useMemo(() => {
    const variantImg = selectedAttrVariant?.imageUrl?.trim();
    if (!variantImg || !isUsableImageSrc(variantImg)) return images;
    const rest = images.filter((u) => u !== variantImg);
    return [variantImg, ...rest];
  }, [images, selectedAttrVariant?.imageUrl]);
  const [siddhAddon, setSiddhAddon] = useState(false);
  const [siddhInfoOpen, setSiddhInfoOpen] = useState(false);
  const siddhInfoRef = useRef<HTMLDivElement | null>(null);
  const [siddhVibrant, setSiddhVibrant] = useState(false);
  const [reviewIdx, setReviewIdx] = useState(0);
  const [reviewPaused, setReviewPaused] = useState(false);
  const reviewTouchX = useRef<number | null>(null);
  const [descTab, setDescTab] = useState<"description" | "howto">("description");
  const [descOpen, setDescOpen] = useState(false);
  const [pincode, setPincode] = useState("");
  const [deliveryMsg, setDeliveryMsg] = useState("");
  const [deliveryDetail, setDeliveryDetail] = useState("");
  const [deliveryEstimate, setDeliveryEstimate] = useState<{
    date: string;
    time: string;
    courier?: string | null;
    days?: number | null;
  } | null>(null);
  const [deliveryChecking, setDeliveryChecking] = useState(false);
  const [deliveryOk, setDeliveryOk] = useState<boolean | null>(null);
  const siteName = offer.siteName || BRAND;
  const defaultRibbon = offer.defaultCashbackLabel;
  const cashbackEnabled =
    offer.cashbackRibbonEnabled && offer.cashbackEarnEnabled;
  const globalPackaging = offer.packagingText || DEFAULT_PACKAGING_BODY;
  const globalReturns = offer.returnsText || DEFAULT_RETURNS_BODY;
  const globalCashbackTerms = offer.cashbackTerms || DEFAULT_CASHBACK_BODY;
  const showPackaging = offer.packagingEnabled;
  const showReturns = offer.returnsEnabled;
  const showCashbackTerms =
    offer.cashbackTermsEnabled && offer.cashbackEarnEnabled;
  const showWhyBrand = offer.whyBrandEnabled;
  const showWhyHappy = offer.whyBrandHappyCustomersEnabled;
  const showWhyCertified = offer.whyBrandCertifiedEnabled;
  const showWhyReturns = offer.whyBrandReturnsEnabled;
  const showWhyShipping = offer.whyBrandShippingEnabled;
  const freeShippingAbove = Math.round(offer.freeShippingAbovePaise / 100);
  const showTaxNote = offer.pricesIncludeTax && !product.isFreeProduct;
  const whyHappy =
    offer.whyBrandHappyCustomers ||
    "Trusted by shoppers across India.";
  const whyCertified =
    offer.whyBrandCertified || "100% genuine products from trusted brands.";
  const whyReturns =
    offer.whyBrandReturns ||
    "Easy 7-day return & exchange on eligible unused items.";
  const whyShipping =
    offer.whyBrandShipping || "Free shipping on eligible orders across India.";
  const [offerOpen, setOfferOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [socialVideoIdx, setSocialVideoIdx] = useState<number | null>(null);
  const [socialLiked, setSocialLiked] = useState<Record<number, boolean>>({});
  const [socialMuted, setSocialMuted] = useState(true);
  const socialTrackRef = useRef<HTMLDivElement>(null);
  const relatedRailRef = useRef<HTMLDivElement>(null);
  const socialVideoRef = useRef<HTMLVideoElement>(null);

  const addItem = useCart((s) => s.addItem);
  const setCartSiddhAddon = useCart((s) => s.setSiddhAddon);
  const openCheckout = useCart((s) => s.openCheckout);
  const cartCount = useCart((s) => s.count());
  const openCart = useCart((s) => s.openCart);

  useEffect(() => {
    if (product?.id && product?.slug) {
      trackProductView({ id: product.id, slug: product.slug });
    }
  }, [product.id, product.slug]);

  function scrollGalleryTo(i: number, smooth = true) {
    const el = galleryRef.current;
    if (!el || displayImages.length < 1) return;
    const next = ((i % displayImages.length) + displayImages.length) % displayImages.length;
    const child = el.children[next] as HTMLElement | undefined;
    if (!child) return;
    galleryProgrammatic.current = true;
    el.scrollTo({
      left: child.offsetLeft,
      behavior: smooth ? "smooth" : "auto",
    });
    setActive(next);
    window.setTimeout(() => {
      galleryProgrammatic.current = false;
    }, smooth ? 450 : 50);
  }

  function onGalleryScroll() {
    const el = galleryRef.current;
    if (!el || galleryProgrammatic.current || displayImages.length < 2) return;
    const w = el.clientWidth || 1;
    const i = Math.round(el.scrollLeft / w);
    if (i >= 0 && i < displayImages.length && i !== active) setActive(i);
  }

  useEffect(() => {
    if (!heroReady || displayImages.length < 2 || galleryPaused) return;
    const t = setInterval(() => {
      setActive((i) => {
        const next = (i + 1) % displayImages.length;
        const el = galleryRef.current;
        const child = el?.children[next] as HTMLElement | undefined;
        if (el && child) {
          galleryProgrammatic.current = true;
          el.scrollTo({ left: child.offsetLeft, behavior: "smooth" });
          window.setTimeout(() => {
            galleryProgrammatic.current = false;
          }, 450);
        }
        return next;
      });
    }, 4000);
    return () => clearInterval(t);
  }, [displayImages.length, galleryPaused, heroReady]);

  useEffect(() => {
    setActive(0);
    setHeroReady(false);
    requestAnimationFrame(() => {
      galleryRef.current?.scrollTo({ left: 0, behavior: "auto" });
    });
  }, [selectedAttrVariant?.imageUrl]);

  useEffect(() => {
    setActive(0);
    setHeroReady(false);
    setReviewIdx(0);
    requestAnimationFrame(() => {
      const el = galleryRef.current;
      if (el) el.scrollTo({ left: 0, behavior: "auto" });
    });
    setPackIdx(initialPackIdx ?? getDefaultPackIndex(product));
  }, [product.id, initialPackIdx, product]);

  useEffect(() => {
    if (socialVideoIdx == null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSocialVideoIdx(null);
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [socialVideoIdx]);

  useEffect(() => {
    if (!siddhInfoOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSiddhInfoOpen(false);
    }
    function onPointerDown(e: MouseEvent | TouchEvent) {
      const el = siddhInfoRef.current;
      if (el && !el.contains(e.target as Node)) setSiddhInfoOpen(false);
    }
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [siddhInfoOpen]);

  useEffect(() => {
    const v = socialVideoRef.current;
    if (!v) return;
    v.muted = socialMuted;
  }, [socialMuted, socialVideoIdx]);

  useEffect(() => {
    setAttributeSelection(getDefaultAttributeSelection(product));
    setPackIdx(initialPackIdx ?? getDefaultPackIndex(product));
  }, [product.id, initialPackIdx]);
  const popularPackIdx = useMemo(
    () => packs.findIndex((p) => p.popular),
    [packs],
  );
  const selectedPack = packs[packIdx] || null;
  const selectedPackQty = packQuantityFromLabel(
    selectedPack?.label || selectedAttrVariant?.title || "",
  );
  const showSiddhAddon =
    !!product.siddhAddonEnabled &&
    typeof product.siddhAddonPrice === "number" &&
    product.siddhAddonPrice > 0;
  const siddhAddonUnitPrice = showSiddhAddon ? product.siddhAddonPrice || 0 : 0;
  /** Pack of 2 → 2× plate price, Pack of 3 → 3×, etc. */
  const siddhAddonPrice = siddhAddonUnitPrice * selectedPackQty;

  useEffect(() => {
    if (!showSiddhAddon) {
      setSiddhVibrant(false);
      return;
    }
    setSiddhVibrant(false);
    const t = window.setTimeout(() => setSiddhVibrant(true), 2000);
    return () => window.clearTimeout(t);
  }, [showSiddhAddon, product.id]);
  const baseDisplayPrice = product.isFreeProduct
    ? 0
    : selectedAttrVariant
      ? selectedAttrVariant.price
      : (selectedPack?.price ?? product.price);
  const displayPrice =
    baseDisplayPrice + (siddhAddon && showSiddhAddon ? siddhAddonPrice : 0);
  const displayCompareAt = product.isFreeProduct
    ? Math.max(
        product.compareAt || 0,
        selectedAttrVariant?.price ??
          selectedPack?.price ??
          product.price ??
          0,
      )
    : selectedAttrVariant?.compareAt && selectedAttrVariant.compareAt > 0
      ? selectedAttrVariant.compareAt
      : product.compareAt;

  useEffect(() => {
    if (!product?.id) return;
    trackViewContent({
      content_ids: [product.id],
      content_name: product.title,
      content_type: "product",
      value: displayPrice,
      currency: "INR",
    });
  }, [product.id, product.slug, product.title, displayPrice]);

  const activeStock =
    selectedAttrVariant?.stock != null
      ? selectedAttrVariant.stock
      : selectedPack?.stock != null
        ? selectedPack.stock
        : product.stock != null
          ? product.stock
          : null;
  const isSoldOut =
    activeStock != null
      ? activeStock <= 0
      : !!product.soldOut ||
        selectedPack?.soldOut === true ||
        selectedAttrVariant?.soldOut === true;
  const unitsLeft =
    activeStock != null && activeStock > 0 ? Math.floor(activeStock) : null;

  /** Offer % + save amount recalculate from the selected pack price. */
  const offerLabel = formatOfferLabel(
    displayPrice,
    displayCompareAt,
    product.extraOfferLabel,
  );
  const saveAmount =
    displayCompareAt > displayPrice
      ? displayCompareAt - displayPrice
      : product.offerSaveAmount && !selectedPack
        ? product.offerSaveAmount
        : 0;

  const ribbonRaw =
    cashbackEnabled && product.showCashbackRibbon
      ? product.cashbackRibbon || defaultRibbon || ""
      : "";
  // Never treat long T&C dumps as a ribbon (scrape / settings mistakes)
  const ribbon =
    ribbonRaw.length > 80 || /\n/.test(ribbonRaw) || /1\.\d/.test(ribbonRaw)
      ? ""
      : ribbonRaw.trim();
  const primaryTag = product.highlightTags?.[0];

  const shortOfferGift = (() => {
    const raw = product.offerGiftText?.trim() || "";
    if (!raw) return "";
    if (raw.length > 120 || /\n/.test(raw) || /1\.\d/.test(raw)) return "";
    return raw;
  })();

  /** Green strip on price/CTA card — admin-managed; not Offer gift text. */
  const promoBanner = (() => {
    if (product.showPriceCardBanner === false) return "";
    const text = product.priceCardBannerText?.trim() || "";
    if (text.length > 120 || /\n/.test(text) || /1\.\d/.test(text)) return "";
    return text;
  })();

  const productAccordions = useMemo(() => {
    const isGlobalTitle = (title: string) =>
      /(packaging|package|gift wrap|return|exchange|cashback|cash back)/i.test(
        title,
      );
    const fromApi = (product.pdpAccordions || [])
      .filter((a) => a?.title?.trim() && a?.body?.trim())
      .filter((a) => !isGlobalTitle(a.title))
      .map((a) => ({ title: a.title.trim(), body: a.body.trim() }));
    const hasHowTo = fromApi.some((a) =>
      /^how to wear|^how to use|^how should|^how to place|^placement/i.test(
        a.title,
      ),
    );
    if (fromApi.length) {
      if (product.howToWear?.trim() && !hasHowTo) {
        return [
          ...fromApi,
          { title: "How to use", body: product.howToWear.trim() },
        ];
      }
      return fromApi;
    }

    const blocks =
      product.benefitBlocks?.filter((b) => b?.title)?.length
        ? product.benefitBlocks.filter((b) => b?.title)
        : [];
    const out: { title: string; body: string }[] = [];
    if (blocks.length) {
      out.push({
        title: "Benefits",
        body: blocks
          .map((b) => (b.body ? `${b.title} – ${b.body}` : b.title))
          .join("\n"),
      });
    } else if (product.benefits?.length) {
      out.push({ title: "Benefits", body: product.benefits.join("\n") });
    }
    if (product.howToWear?.trim()) {
      out.push({ title: "How to wear", body: product.howToWear.trim() });
    }
    if (product.styleTips?.length) {
      out.push({ title: "Style tips", body: product.styleTips.join("\n") });
    }
    if (product.bestDayToWear?.trim()) {
      out.push({
        title: "Best day to wear",
        body: product.bestDayToWear.trim(),
      });
    }
    if (product.productSpec?.trim()) {
      out.push({
        title: "Product specification",
        body: product.productSpec.trim(),
      });
    }
    if (product.authenticityText?.trim()) {
      out.push({
        title: "Authenticity",
        body: product.authenticityText.trim(),
      });
    }
    if (product.disclaimerText?.trim()) {
      out.push({ title: "Disclaimer", body: product.disclaimerText.trim() });
    }
    return out;
  }, [product]);

  const defaultAccordions = useMemo(() => {
    const used = new Set(
      productAccordions.map((a) => accordionTitleKey(a.title)),
    );
    const defaults: { title: string; body: string }[] = [];
    if (showPackaging && globalPackaging.trim()) {
      defaults.push({ title: "Packaging", body: globalPackaging });
    }
    if (showReturns && globalReturns.trim()) {
      defaults.push({ title: "Returns + Exchanges", body: globalReturns });
    }
    if (showCashbackTerms && globalCashbackTerms.trim()) {
      defaults.push({
        title: "Cashback Terms & Conditions",
        body: globalCashbackTerms,
      });
    }
    return defaults.filter((d) => !used.has(accordionTitleKey(d.title)));
  }, [
    productAccordions,
    showPackaging,
    showReturns,
    showCashbackTerms,
    globalPackaging,
    globalReturns,
    globalCashbackTerms,
  ]);

  const showReviews = offer.reviewsOnProductPage;
  const showReviewSlider = offer.reviewsSlider;
  const showRatingSummary = showReviews || showReviewSlider;
  const reviewItems = useMemo(() => {
    if (!showRatingSummary) return [];
    const list =
      product.reviewList?.filter((r) => r.body)?.map((r) => ({
        name: r.authorName || "Customer",
        text: r.body,
        rating: r.rating || 5,
        verified: !!r.isVerified,
        avatar: r.avatarUrl || null,
      })) || [];
    // Featured review is a legacy/single fallback — only show it when there
    // are no published reviews yet (avoids 7 reviews badge + 8 carousel dots).
    if (
      list.length === 0 &&
      product.featuredReviewText
    ) {
      list.push({
        name: product.featuredReviewName || "Customer",
        text: product.featuredReviewText,
        rating: product.featuredReviewRating || 5,
        verified: true,
        avatar: product.featuredReviewAvatar || null,
      });
    }
    return list;
  }, [product, showRatingSummary]);
  const reviews = showReviewSlider ? reviewItems : [];
  const howToAccordion = productAccordions.find((a) =>
    /^how to wear|^how to use|^how should|^how to place|^placement/i.test(a.title),
  );
  const descPlainLen = stripHtml(
    `${product.shortDescription || ""} ${product.description || ""}`,
  ).length;

  useEffect(() => {
    if (reviews.length <= 1 || reviewPaused) return;
    const t = setInterval(() => {
      setReviewIdx((i) => (i + 1) % reviews.length);
    }, 5500);
    return () => clearInterval(t);
  }, [reviews.length, reviewPaused]);

  // Cap the visible carousel dots to a small sliding window (max 6) so
  // products with many reviews don't render a huge wall of dots.
  const MAX_REVIEW_DOTS = 6;
  const reviewDotIndices = useMemo(() => {
    const total = reviews.length;
    if (total <= MAX_REVIEW_DOTS) {
      return Array.from({ length: total }, (_, i) => i);
    }
    const half = Math.floor(MAX_REVIEW_DOTS / 2);
    let start = reviewIdx - half;
    start = Math.max(0, Math.min(start, total - MAX_REVIEW_DOTS));
    return Array.from({ length: MAX_REVIEW_DOTS }, (_, i) => start + i);
  }, [reviews.length, reviewIdx]);

  const specRows = parseSpecRows(product.productSpec);
  const crystals = product.crystals?.filter((c) => c?.name) || [];
  const social =
    product.socialProof?.filter(
      (s) =>
        s?.label &&
        ((s?.image && isUsableImageSrc(s.image)) || s?.videoUrl),
    ) || [];

  function cartProduct(): Product {
    const stock = unitsLeft ?? 0;
    const linked = product.siddhAddonProduct;
    const linkedUpsellReady = !!(
      linked?.id &&
      linked.variantId &&
      !linked.soldOut &&
      (linked.stock == null || linked.stock > 0)
    );
    const useLinkedUpsell = !!(
      siddhAddon &&
      showSiddhAddon &&
      linkedUpsellReady
    );
    const addonOn = !!(siddhAddon && showSiddhAddon && !useLinkedUpsell);
    const freeBase = product.isFreeProduct ? 0 : null;
    const base = selectedAttrVariant
      ? {
          ...product,
          price:
            (freeBase ?? selectedAttrVariant.price) +
            (addonOn ? siddhAddonPrice : 0),
          compareAt: Math.max(
            displayCompareAt,
            (freeBase ?? selectedAttrVariant.price) +
              (addonOn ? siddhAddonPrice : 0),
          ),
          variantId: selectedAttrVariant.id,
          title: `${product.title} (${selectedAttrVariant.title})`,
          image: selectedAttrVariant.imageUrl || product.image,
        }
      : selectedPack
        ? {
            ...product,
            price:
              (freeBase ?? selectedPack.price) +
              (addonOn ? siddhAddonPrice : 0),
            compareAt: Math.max(
              product.compareAt,
              (freeBase ?? selectedPack.price) +
                (addonOn ? siddhAddonPrice : 0),
            ),
            variantId: selectedPack.variantId || product.variantId,
            title: `${product.title} (${selectedPack.label})`,
          }
        : {
            ...product,
            price:
              (freeBase ?? product.price) + (addonOn ? siddhAddonPrice : 0),
          };
    return {
      ...base,
      stock,
      soldOut: stock <= 0,
      siddhAddonSelected: addonOn,
      siddhAddonUnits: addonOn || useLinkedUpsell ? selectedPackQty : undefined,
      siddhAddonProduct: linked || null,
      isFreeProduct: !!product.isFreeProduct,
    };
  }

  function addonUpsellProduct(): Product | null {
    const linked = product.siddhAddonProduct;
    const linkedUpsellReady = !!(
      linked?.id &&
      linked.variantId &&
      !linked.soldOut &&
      (linked.stock == null || linked.stock > 0)
    );
    if (!siddhAddon || !showSiddhAddon || !linkedUpsellReady) {
      return null;
    }
    const catalogPrice = Math.max(
      siddhAddonUnitPrice,
      linked.price || siddhAddonUnitPrice,
    );
    return {
      id: linked.id,
      title: product.siddhAddonName || linked.title,
      slug: linked.slug,
      price: siddhAddonUnitPrice,
      compareAt: catalogPrice,
      image: linked.image || "",
      description: "",
      reviews: 0,
      rating: 0,
      variantId: linked.variantId || undefined,
      stock: linked.stock ?? selectedPackQty,
      soldOut: !!linked.soldOut,
      isAddonUpsell: true,
      addonParentId: product.id,
      addonUnitsPerParent: selectedPackQty,
      addonComboQty: selectedPackQty,
      addonComboPrice: siddhAddonUnitPrice,
      addonCatalogPrice: catalogPrice,
      siddhAddonEnabled: false,
      siddhAddonSelected: false,
    };
  }

  function ensureAddonInCart(variantId?: string | null) {
    if (!siddhAddon || !showSiddhAddon) return;
    const upsell = addonUpsellProduct();
    if (upsell) {
      const up = addItem(upsell, selectedPackQty);
      if (!up.ok) {
        // Linked SKU unavailable — keep the ₹100 on the parent line instead.
        setCartSiddhAddon(product.id, variantId, true);
      }
      return;
    }
    // No linked upsell line — fee must live on the parent.
    setCartSiddhAddon(product.id, variantId, true);
  }

  function add() {
    if (isSoldOut || maxOrderQty(cartProduct()) <= 0) return;
    const line = cartProduct();
    const result = addItem(line);
    if (!result.ok) return;
    ensureAddonInCart(line.variantId);
  }
  function buy() {
    if (isSoldOut || maxOrderQty(cartProduct()) <= 0) return;
    const line = cartProduct();
    try {
      trackBuyNowEvent({
        productId: line.id,
        slug: line.slug,
        title: line.title,
        quantity: 1,
        value: line.price + (addonUpsellProduct()?.price || 0) * selectedPackQty,
      });
    } catch {
      /* analytics must never block buy */
    }
    addItem(line);
    ensureAddonInCart(line.variantId);
    openCheckout();
  }

  function onSiddhAddonToggle(checked: boolean) {
    setSiddhAddon(checked);
    const variantId =
      selectedAttrVariant?.id ||
      selectedPack?.variantId ||
      product.variantId;
    const inCart = useCart
      .getState()
      .items.some(
        (i) =>
          !i.product.isAddonUpsell &&
          i.product.id === product.id &&
          (i.product.variantId || "") === (variantId || ""),
      );
    if (!inCart) return;
    setCartSiddhAddon(product.id, variantId, checked);
  }
  function scrollSocial(dir: -1 | 1) {
    const el = socialTrackRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-social-card]");
    const step = (card?.offsetWidth || 180) + 12;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  }

  function scrollRelatedRail(dir: -1 | 1) {
    const el = relatedRailRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-related-card]");
    const step = (card?.offsetWidth || 148) + 12;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  }

  function shareSocialClip(label: string) {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const text = label ? `${label} — ${siteName}` : siteName;
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({ title: text, url }).catch(() => {});
      return;
    }
    if (typeof navigator !== "undefined" && navigator.clipboard && url) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
  }

  async function shareProduct() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      try {
        const el = document.createElement("textarea");
        el.value = url;
        el.setAttribute("readonly", "");
        el.style.position = "absolute";
        el.style.left = "-9999px";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
        setShareCopied(true);
        window.setTimeout(() => setShareCopied(false), 2000);
      } catch {
        /* ignore */
      }
    }
  }

  async function checkPincode() {
    const pin = pincode.trim();
    if (!/^\d{6}$/.test(pin)) {
      setDeliveryOk(false);
      setDeliveryMsg("Please enter a valid 6-digit pincode.");
      setDeliveryDetail("");
      setDeliveryEstimate(null);
      return;
    }
    setDeliveryChecking(true);
    setDeliveryMsg("");
    setDeliveryDetail("");
    setDeliveryEstimate(null);
    try {
      const loc = await checkDeliveryPincode(pin, {
        weightKg: product.shippingWeightKg ?? undefined,
        quantity: selectedPackQty || 1,
      });
      const etdText =
        loc.suggestedCourier?.etdText ||
        loc.etdText ||
        null;
      const etdDate =
        loc.suggestedCourier?.etdDate ||
        loc.etdDate ||
        null;
      const etdTime =
        loc.suggestedCourier?.etdTime ||
        loc.etdTime ||
        null;
      let date = etdDate;
      let time = etdTime;
      if ((!date || !time) && (etdText || loc.etd)) {
        const fromIso = loc.etd ? new Date(loc.etd) : null;
        if (fromIso && !Number.isNaN(fromIso.getTime())) {
          date =
            date ||
            fromIso.toLocaleDateString("en-IN", {
              weekday: "short",
              day: "numeric",
              month: "short",
            });
          time =
            time ||
            fromIso.toLocaleTimeString("en-IN", {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            });
        } else if (etdText && !date) {
          date = etdText;
        }
      }
      const unserviceable = loc.serviceable === false;
      setDeliveryOk(!unserviceable);
      if (unserviceable) {
        setDeliveryMsg(
          `Delivery not available to ${loc.city}, ${loc.state} (${pin}).`,
        );
        setDeliveryDetail("");
        setDeliveryEstimate(null);
      } else if (date) {
        setDeliveryEstimate({
          date,
          time: time || "9:00 pm",
          courier: loc.courierName || loc.suggestedCourier?.courierName,
          days: loc.estimatedDays,
        });
        setDeliveryMsg(
          time
            ? `Estimated delivery by ${date} · ${time}`
            : `Estimated delivery by ${date}`,
        );
        // City/state only — courier name is internal (Shiprocket suggestion; may change at ship time).
        setDeliveryDetail([loc.city, loc.state].filter(Boolean).join(", "));
      } else {
        setDeliveryMsg(`Delivery available to ${loc.city}, ${loc.state}`);
        // Never show admin/setup notes (serviceabilityNote) on the storefront.
        setDeliveryDetail("");
        setDeliveryEstimate(null);
      }
    } catch {
      setDeliveryOk(false);
      setDeliveryMsg("Could not check this pincode. Please try again.");
      setDeliveryDetail("");
      setDeliveryEstimate(null);
    } finally {
      setDeliveryChecking(false);
    }
  }

  function activeZoomLayer() {
    const slide = galleryRef.current?.children[active] as HTMLElement | undefined;
    return slide?.querySelector<HTMLElement>("[data-zoom-layer]") ?? null;
  }

  function onGalleryZoomMove(e: ReactMouseEvent<HTMLDivElement>) {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const layer = activeZoomLayer();
    if (!layer) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    layer.style.transformOrigin = `${x}% ${y}%`;
    layer.style.transform = "scale(2)";
  }

  function resetGalleryZoom() {
    galleryRef.current
      ?.querySelectorAll<HTMLElement>("[data-zoom-layer]")
      .forEach((el) => {
        el.style.transform = "";
      });
  }

  return (
    <div className="bg-white pb-[168px] md:pb-10 max-w-[100vw] lg:bg-[var(--page-band)]">
      <div className="mx-auto max-w-[1180px] px-3 sm:px-5 md:px-6 pt-3 sm:pt-6 md:pt-8 lg:pt-3 min-w-0">
        {pdpBanner ? (
          <PdpPromoBanner banner={pdpBanner} className="mb-3 lg:mb-4" />
        ) : null}
        <div className="grid items-start gap-5 min-w-0 md:gap-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-0 lg:rounded-[var(--radius-md)] lg:border lg:border-line lg:bg-white lg:shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          {/* Gallery — swipe on touch, thumbnails + arrows */}
          <div className="min-w-0 space-y-3 lg:sticky lg:top-28 lg:flex lg:flex-row-reverse lg:gap-3 lg:space-y-0 lg:p-6">
            <div
              className="relative overflow-hidden rounded-[var(--radius-md)] border border-line bg-surface md:cursor-zoom-in lg:min-w-0 lg:flex-1 lg:border-0 lg:bg-white"
              onMouseEnter={() => setGalleryPaused(true)}
              onMouseLeave={() => {
                setGalleryPaused(false);
                resetGalleryZoom();
              }}
              onMouseMove={onGalleryZoomMove}
              onTouchStart={() => setGalleryPaused(true)}
            >
              <WishlistButton
                product={product}
                className="absolute right-3 top-3 z-10 md:hidden lg:grid lg:h-10 lg:w-10"
              />
              <div
                ref={galleryRef}
                onScroll={onGalleryScroll}
                className="flex aspect-square overflow-x-auto snap-x snap-mandatory scrollbar-hide overscroll-x-contain"
                style={{
                  touchAction: "pan-x pan-y",
                  WebkitOverflowScrolling: "touch",
                }}
              >
                {displayImages.map((src, i) => {
                  // Only the active slide until hero paints — avoids stealing bandwidth
                  // from the LCP image (neighbor + all thumbs used to race it).
                  const shouldLoad =
                    i === active ||
                    (heroReady && Math.abs(i - active) <= 1);
                  const detail = productImageDetail(product, src);
                  return (
                  <div
                    key={src + i}
                    className="relative h-full w-full min-w-full flex-shrink-0 snap-center snap-always"
                  >
                    {shouldLoad ? (
                    <div data-zoom-layer className="absolute inset-0 transition-transform duration-150 ease-out will-change-transform">
                    <Image
                      src={src}
                      alt={
                        detail.altText ||
                        (i === 0 && product.seo?.primaryImageAlt
                          ? product.seo.primaryImageAlt
                          : `${product.title}${i > 0 ? ` ${i + 1}` : ""}`)
                      }
                      fill
                      priority={i === 0 && active === 0}
                      fetchPriority={i === active ? "high" : "low"}
                      loading={i === active ? "eager" : "lazy"}
                      quality={PRODUCT_HERO_QUALITY}
                      className={`object-contain pointer-events-none select-none transition-opacity duration-300 ${
                        i === active && !heroReady ? "opacity-0" : "opacity-100"
                      }`}
                      sizes={PRODUCT_HERO_SIZES}
                      draggable={false}
                      onLoad={() => {
                        if (i === active) setHeroReady(true);
                      }}
                      onError={() => setHeroReady(true)}
                    />
                    </div>
                    ) : (
                      <div className="absolute inset-0 bg-surface" aria-hidden />
                    )}
                  </div>
                  );
                })}
              </div>
            </div>

            {displayImages.length > 1 && (
              <div className="flex justify-center items-center gap-1.5 py-2 sm:hidden">
                {displayImages.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Image ${i + 1}`}
                    onClick={() => {
                      setGalleryPaused(true);
                      scrollGalleryTo(i);
                    }}
                    className={`h-1.5 rounded-full transition-all ${
                      active === i ? "w-4 bg-brand" : "w-1.5 bg-black/25"
                    }`}
                  />
                ))}
              </div>
            )}

            {displayImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-0.5 px-0.5 lg:mx-0 lg:max-h-[520px] lg:w-[68px] lg:shrink-0 lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:px-0 lg:pb-0">
                {displayImages.map((src, i) => (
                  <button
                    key={src + i}
                    type="button"
                    aria-label={`View ${
                      productImageDetail(product, src).title ||
                      productImageDetail(product, src).altText ||
                      `${product.title}${i > 0 ? ` ${i + 1}` : ""}`
                    }`}
                    onClick={() => {
                      setGalleryPaused(true);
                      scrollGalleryTo(i);
                    }}
                    className={`relative w-14 h-14 sm:w-16 sm:h-16 md:w-[72px] md:h-[72px] lg:h-16 lg:w-16 flex-shrink-0 overflow-hidden rounded-xl border-2 lg:rounded-md lg:border ${
                      active === i ? "border-brand" : "border-line"
                    }`}
                  >
                    {heroReady ? (
                      <Image
                        src={src}
                        alt=""
                        fill
                        loading="lazy"
                        fetchPriority="low"
                        quality={PRODUCT_HERO_QUALITY}
                        className="object-cover"
                        sizes="72px"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-surface" aria-hidden />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Purchase column */}
          <div className="min-w-0 max-w-full lg:min-h-full lg:border-l lg:border-line lg:p-6">
            {product.brand?.name ? (
              <Link
                href={
                  product.brand.slug
                    ? `/brands/${product.brand.slug}`
                    : `/search?q=${encodeURIComponent(product.brand.name)}`
                }
                className="mb-1 inline-block text-[13px] font-semibold uppercase tracking-wide text-brand hover:text-brand-hover"
              >
                {product.brand.name}
              </Link>
            ) : null}
            <div className="flex items-start gap-2 min-w-0">
              {renderTitle ? (
                <TitleTag className="min-w-0 flex-1 break-words font-sans text-[16px] font-medium leading-snug text-ink sm:text-[18px] lg:text-[17px]">
                  {product.title}
                </TitleTag>
              ) : null}
              <button
                type="button"
                onClick={shareProduct}
                aria-label={shareCopied ? "Link copied" : "Share product"}
                title={shareCopied ? "Link copied!" : "Copy product link"}
                className={`relative mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${
                  shareCopied
                    ? "bg-success-soft text-success"
                    : "text-muted hover:bg-surface hover:text-ink"
                }`}
              >
                {shareCopied ? <Check size={18} /> : <Share2 size={18} />}
              </button>
            </div>

            {shareCopied ? (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-[12px] font-semibold text-success">
                <Link2 size={12} />
                Product link copied
              </p>
            ) : null}

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              {reviewItems.length > 0 ? (
                <a
                  href={showReviews ? "#reviews" : undefined}
                  className={`inline-flex items-center gap-1.5 text-[13px] text-muted ${showReviews ? "hover:text-ink" : ""}`}
                >
                  <span className="inline-flex" aria-hidden>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={14}
                        className={
                          i < Math.round(Number(product.rating) || 0)
                            ? "fill-ink text-ink"
                            : "fill-[#E6E6E6] text-[#E6E6E6]"
                        }
                      />
                    ))}
                  </span>
                  <span className="font-semibold text-ink">
                    {(Number(product.rating) || 0).toFixed(1)}/5
                  </span>
                  <span>
                    {(product.reviews || reviewItems.length).toLocaleString("en-IN")}{" "}
                    ratings &amp; reviews
                  </span>
                </a>
              ) : null}
              {primaryTag ? (
                <span className="inline-flex items-center rounded-sm bg-brand-soft px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-brand">
                  {primaryTag}
                </span>
              ) : null}
            </div>

            {hasAttributeVariants && (
              <div className="mt-5 space-y-4 min-w-0">
                {attributeGroups.map((group) => {
                  const isColor = isColorAttributeGroup(group);
                  const selectedValue = attributeSelection[group.name];

                  return (
                    <div key={group.slug || group.name}>
                      <p className="text-sm text-text">
                        <span className="font-semibold text-ink">
                          {group.name}
                        </span>
                        {selectedValue ? (
                          <span className="font-medium text-muted">
                            {" "}
                            · {selectedValue}
                          </span>
                        ) : null}
                      </p>

                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {group.values.map((val) => {
                          const selected = selectedValue === val.label;
                          const available = isAttributeValueAvailable(
                            product,
                            group.name,
                            val.label,
                            attributeSelection,
                          );
                          const swatch = isColor
                            ? colorHexFromLabel(val.label)
                            : null;

                          return (
                            <button
                              key={val.id}
                              type="button"
                              disabled={!available}
                              aria-pressed={selected}
                              aria-label={`${group.name} ${val.label}`}
                              onClick={() =>
                                setAttributeSelection((prev) => ({
                                  ...prev,
                                  [group.name]: val.label,
                                }))
                              }
                              className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25 focus-visible:ring-offset-2 ${
                                selected
                                  ? "border-brand bg-brand-soft text-brand"
                                  : available
                                    ? "border-line-strong bg-white text-ink hover:border-brand/50"
                                    : "border-line bg-surface-alt text-subtle line-through cursor-not-allowed"
                              }`}
                            >
                              {isColor && swatch ? (
                                <span
                                  className={`h-3.5 w-3.5 shrink-0 rounded-full border ${
                                    selected
                                      ? "border-brand/30"
                                      : "border-black/10"
                                  }`}
                                  style={{ backgroundColor: swatch }}
                                  aria-hidden
                                />
                              ) : null}
                              {val.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {selectedAttrVariant?.soldOut ? (
                  <p className="text-sm font-medium text-red-600">
                    This combination is currently out of stock.
                  </p>
                ) : selectedAttrVariant?.stock != null &&
                  selectedAttrVariant.stock > 0 &&
                  selectedAttrVariant.stock <= 5 ? (
                  <p className="text-sm text-amber-800">
                    Only {selectedAttrVariant.stock} left in this option.
                  </p>
                ) : null}
              </div>
            )}

            {/* Pack / quantity — only when admin set packs with price */}
            {packs.length > 0 && (
              <div className="mt-5 min-w-0">
                <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
                  Select quantity
                </p>
                <div
                  className={`mt-3 pt-3 grid gap-2.5 min-w-0 ${
                    packs.length === 1
                      ? "grid-cols-1"
                      : packs.length === 2
                        ? "grid-cols-2"
                        : "grid-cols-2 sm:grid-cols-3"
                  }`}
                >
                  {packs.map((opt, i) => {
                    const selected = packIdx === i;
                    const showPopular = i === popularPackIdx;
                    return (
                      <button
                        key={`${opt.label}-${i}`}
                        type="button"
                        onClick={() => setPackIdx(i)}
                        className={`relative min-w-0 rounded-xl px-2 pt-5 pb-3.5 text-center transition-all duration-200 box-border ${
                          selected
                            ? "border-2 border-brand bg-brand-soft shadow-[0_2px_8px_rgba(252,39,121,0.18)]"
                            : "border border-line bg-white hover:border-brand/60"
                        }`}
                      >
                        {showPopular && (
                          <span className="absolute -top-2.5 left-1/2 z-10 -translate-x-1/2 max-w-[calc(100%+8px)] truncate rounded-full bg-brand px-2 py-0.5 text-[9px] font-bold leading-none text-white shadow-sm">
                            Most Popular
                          </span>
                        )}
                        <span className="block text-[12px] sm:text-[13px] font-semibold text-ink truncate">
                          {opt.label}
                        </span>
                        <span className="mt-1.5 block text-[15px] sm:text-[17px] font-bold tabular-nums text-black">
                          {product.isFreeProduct ? (
                            <FreePriceLabel size="sm" />
                          ) : (
                            formatINR(opt.price)
                          )}
                        </span>
                        {opt.saveLabel && (
                          <span
                            className={`mt-1 block text-[10px] sm:text-[11px] font-semibold truncate ${
                              opt.saveHighlight
                                ? "text-success"
                                : "text-text"
                            }`}
                          >
                            {opt.saveLabel}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Price + CTA card (desktop). Mobile uses sticky twin below. */}
            <div className="mt-5 hidden md:block overflow-hidden rounded-[var(--radius-md)] border border-line bg-white lg:mt-4 lg:border-0">
              {promoBanner ? (
                <div className="bg-success px-3.5 py-2.5 text-center text-[13px] font-bold leading-snug text-white lg:rounded-[var(--radius-sm)]">
                  {promoBanner}
                </div>
              ) : null}
              <div className="px-3.5 pt-3.5 pb-3.5 lg:px-0">
                <div
                  className={`flex flex-wrap items-baseline gap-x-2 gap-y-1 ${
                    showTaxNote ? "mb-1" : "mb-3.5"
                  }`}
                >
                  {displayCompareAt > displayPrice && (
                    <span className="text-[15px] text-muted tabular-nums">
                      MRP:{" "}
                      <span className="line-through">
                        {formatINR(displayCompareAt)}
                      </span>
                    </span>
                  )}
                  {product.isFreeProduct && displayPrice <= 0 ? (
                    <FreePriceLabel size="lg" />
                  ) : (
                    <span className="text-[24px] font-semibold leading-none text-ink tabular-nums">
                      {formatINR(displayPrice)}
                    </span>
                  )}
                  {product.isFreeProduct && displayCompareAt > 0 && (
                    <span className="text-[15px] font-semibold text-success">
                      100% Off
                    </span>
                  )}
                  {offerLabel && !product.isFreeProduct && (
                    <span className="text-[15px] font-semibold text-success">
                      {offerLabel}
                    </span>
                  )}
                </div>
                {showTaxNote ? (
                  <p className="mb-3.5 text-[13px] font-medium text-success lg:mb-4">
                    Inclusive of all taxes
                  </p>
                ) : null}
                <div className="lg:flex lg:items-start lg:gap-5">
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-2.5 lg:flex lg:w-[220px] lg:shrink-0 lg:flex-col">
                    <button
                      type="button"
                      disabled={isSoldOut}
                      onClick={add}
                      className="rounded-[var(--radius-sm)] bg-brand py-3 text-[14px] font-semibold text-white transition-colors disabled:opacity-40 hover:bg-brand-hover lg:h-12 lg:text-[16px]"
                    >
                      Add to Bag
                    </button>
                    <button
                      type="button"
                      disabled={isSoldOut}
                      onClick={buy}
                      className="rounded-[var(--radius-sm)] border border-brand bg-white py-3 text-[14px] font-semibold text-brand transition-colors disabled:opacity-40 hover:bg-brand-soft lg:h-10 lg:text-[14px]"
                    >
                      Buy Now
                    </button>
                    <WishlistButton product={product} variant="inline" className="lg:hidden" />
                  </div>
                  <div className="mt-4 hidden min-w-0 flex-1 lg:mt-0 lg:block">
                    <p className="text-[14px] font-semibold text-ink">Delivery Options</p>
                    <div className="mt-2 flex overflow-hidden rounded-[var(--radius-sm)] border border-line-strong bg-white focus-within:border-brand">
                      <input
                        value={pincode}
                        onChange={(e) =>
                          setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))
                        }
                        onKeyDown={(e) => e.key === "Enter" && checkPincode()}
                        placeholder="Enter pincode"
                        inputMode="numeric"
                        aria-label="Pincode"
                        className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm outline-none"
                      />
                      <button
                        type="button"
                        onClick={checkPincode}
                        disabled={deliveryChecking}
                        className="px-3 text-sm font-semibold text-brand hover:text-brand-hover disabled:opacity-70"
                      >
                        {deliveryChecking ? "…" : "Check"}
                      </button>
                    </div>
                    {deliveryMsg ? (
                      <p
                        className={`mt-1.5 text-[12px] font-medium ${
                          deliveryOk === false ? "text-danger" : "text-success"
                        }`}
                      >
                        {deliveryEstimate
                          ? `Estimated delivery by ${deliveryEstimate.date}${
                              deliveryEstimate.time ? ` · ${deliveryEstimate.time}` : ""
                            }`
                          : deliveryMsg}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            {showSiddhAddon && (
              <div className="mt-5">
                <p className="text-base sm:text-lg font-bold text-ink">
                  {product.siddhAddonHeading || "Energize / Siddh"}
                </p>
                <div
                  className={`mt-2.5 flex items-center gap-3.5 rounded-xl border-2 px-4 py-3.5 select-none transition-[border-color,background-color,box-shadow] duration-500 ${
                    siddhVibrant
                      ? "siddh-addon-vibrant border-brand bg-brand-soft"
                      : "border-line-strong bg-surface-alt"
                  }`}
                >
                  {isUsableImageSrc(product.siddhAddonProduct?.image) ? (
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-line bg-surface">
                      <Image
                        src={product.siddhAddonProduct!.image!}
                        alt={
                          product.siddhAddonName ||
                          product.siddhAddonProduct!.title
                        }
                        fill
                        className="object-cover"
                        sizes="56px"
                      />
                    </div>
                  ) : null}
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3.5">
                    <input
                      type="checkbox"
                      checked={siddhAddon}
                      onChange={(e) => onSiddhAddonToggle(e.target.checked)}
                      className="h-5 w-5 shrink-0 rounded-[4px] border-2 border-line-strong accent-[var(--brand)] cursor-pointer"
                    />
                    <span className="flex-1 text-[15px] sm:text-base text-ink leading-snug">
                      Get{" "}
                      <strong className="font-bold">
                        {product.siddhAddonName || "Add-on product"}
                      </strong>{" "}
                      for just{" "}
                      <strong className="font-bold text-[#9a3412]">
                        {formatINR(siddhAddonPrice)}
                      </strong>
                      {selectedPackQty > 1 ? (
                        <span className="text-muted">
                          {" "}
                          ({formatINR(siddhAddonUnitPrice)} × {selectedPackQty})
                        </span>
                      ) : null}
                    </span>
                  </label>
                  <div ref={siddhInfoRef} className="relative shrink-0 overflow-visible">
                    <button
                      type="button"
                      className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-black/5 hover:text-ink"
                      aria-label="About this add-on"
                      aria-expanded={siddhInfoOpen}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSiddhInfoOpen((v) => !v);
                      }}
                    >
                      <Info size={20} />
                    </button>
                    {siddhInfoOpen && (
                      <div
                        role="tooltip"
                        style={{ width: 320, maxWidth: "calc(100vw - 1.5rem)" }}
                        className="absolute right-0 bottom-[calc(100%+10px)] z-40 box-border rounded-2xl border border-line bg-white px-4 py-3.5 text-left shadow-[0_12px_28px_rgba(0,0,0,0.14)]"
                      >
                        <span
                          className="absolute -bottom-[7px] right-3 h-3.5 w-3.5 rotate-45 border-r border-b border-line bg-white"
                          aria-hidden
                        />
                        <p className="relative w-full text-[13px] leading-relaxed text-text whitespace-pre-wrap break-words">
                          {product.siddhAddonInfo?.trim() ||
                            "Add this item to your order at a special price."}
                        </p>
                        <div className="relative mt-3 flex w-full justify-end">
                          <span className="inline-flex rounded-full bg-success px-2.5 py-1 text-[11px] font-bold text-white">
                            Extra {formatINR(siddhAddonPrice)}
                            {selectedPackQty > 1
                              ? ` (${formatINR(siddhAddonUnitPrice)} × ${selectedPackQty})`
                              : ""}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-5 space-y-3">
              {product.showOfferCountdown && (
                <Countdown endsAt={product.offerEndsAt} />
              )}

              {product.showSpecialOffer &&
                (product.offerTitle ||
                  shortOfferGift ||
                  saveAmount > 0 ||
                  product.offerGiftWorth) && (
                <div className="rounded-[var(--radius-md)] border border-dashed border-offer/40 bg-offer-soft p-3 sm:p-3.5">
                  {/* Header row */}
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-offer text-white">
                      <Percent size={16} strokeWidth={2.5} />
                    </div>
                    <p className="min-w-0 flex-1 text-[14px] sm:text-[15px] font-medium text-ink leading-snug">
                      {product.offerTitle || "Special offer"}
                    </p>
                    {saveAmount > 0 && (
                      <span className="shrink-0 rounded-full bg-success px-2.5 py-1 text-[11px] sm:text-[12px] font-bold text-white shadow-sm">
                        Save {formatINR(saveAmount)}
                      </span>
                    )}
                  </div>

                  {/* Toggle */}
                  <button
                    type="button"
                    onClick={() => setOfferOpen((v) => !v)}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-offer/30 bg-white py-2.5 text-[14px] font-semibold text-offer"
                  >
                    {offerOpen ? "Hide Offer" : "View Offer"}
                    <span
                      className={`text-[10px] leading-none transition-transform ${
                        offerOpen ? "" : "rotate-180"
                      }`}
                    >
                      ▲
                    </span>
                  </button>

                  {/* Coupon ticket details — short copy only; full T&C lives in accordion */}
                  {offerOpen && (
                    <div className="relative mt-3 overflow-hidden rounded-xl border border-[#86EFAC] bg-white px-4 py-3.5">
                      {/* Ticket notches */}
                      <span className="pointer-events-none absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-offer-soft border border-[#86EFAC]" />
                      <span className="pointer-events-none absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-offer-soft border border-[#86EFAC]" />

                      <div className="flex items-start gap-2">
                        <p className="flex-1 text-[14px] sm:text-[15px] font-bold leading-snug text-success">
                          {shortOfferGift ||
                            [
                              product.offerGiftWorth
                                ? `Free gift worth ${formatINR(product.offerGiftWorth)}`
                                : null,
                              ribbon || null,
                            ]
                              .filter(Boolean)
                              .join(" + ") ||
                            "Prepaid offer on this product"}
                        </p>
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-success text-[11px] font-bold text-white">
                          ✓
                        </span>
                      </div>

                      <p className="mt-2 text-[12px] sm:text-[13px] leading-relaxed text-muted">
                        Complete prepaid checkout to unlock this offer on this
                        product.
                      </p>

                      {(showCashbackTerms && (globalCashbackTerms || ribbon)) && (
                        <button
                          type="button"
                          onClick={() => {
                            const el = document.getElementById(
                              "pdp-accordion-cashback",
                            );
                            if (el) {
                              el.scrollIntoView({ behavior: "smooth" });
                              el.querySelector("button")?.click();
                            }
                          }}
                          className="mt-2 text-[13px] font-semibold text-success underline underline-offset-2"
                        >
                          View Terms &amp; Conditions
                        </button>
                      )}

                      <div className="my-3 border-t border-dashed border-line" />

                      <div className="flex items-center gap-3 sm:gap-4">
                        {/* GPay */}
                        <span className="inline-flex items-center gap-0.5 text-[11px] font-bold tracking-tight">
                          <span className="text-[#4285F4]">G</span>
                          <span className="text-[#EA4335]">o</span>
                          <span className="text-[#FBBC05]">o</span>
                          <span className="text-[#4285F4]">g</span>
                          <span className="text-[#34A853]">l</span>
                          <span className="text-[#EA4335]">e</span>
                          <span className="ml-0.5 text-[#5F6368] font-semibold">
                            Pay
                          </span>
                        </span>
                        {/* Paytm */}
                        <span className="text-[12px] font-extrabold tracking-tight">
                          <span className="text-[#00BAF2]">Pay</span>
                          <span className="text-[#002E6E]">tm</span>
                        </span>
                        {/* PhonePe */}
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#5F259F]">
                          <span className="grid h-4 w-4 place-items-center rounded-full bg-[#5F259F] text-[8px] text-white">
                            Pe
                          </span>
                          PhonePe
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Delivery — above reviews */}
              <div className="rounded-[var(--radius-md)] border border-line bg-white p-4 lg:hidden">
                <div className="flex items-start gap-2.5">
                  <Timer
                    size={22}
                    className="mt-0.5 shrink-0 text-brand"
                  />
                  <div>
                    <p className="text-[14px] font-semibold text-ink">
                      Get estimated delivery date
                    </p>
                    <p className="mt-0.5 text-[12px] text-muted">
                      Enter your pincode to check delivery.
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex overflow-hidden rounded-[var(--radius-sm)] border border-line-strong bg-white focus-within:border-brand">
                  <div className="flex items-center pl-3 text-subtle">
                    <MapPin size={18} />
                  </div>
                  <input
                    value={pincode}
                    onChange={(e) =>
                      setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    onKeyDown={(e) => e.key === "Enter" && checkPincode()}
                    placeholder="Enter your pincode"
                    inputMode="numeric"
                    className="min-w-0 flex-1 bg-transparent px-2 py-2.5 text-sm outline-none"
                  />
                  <button
                    type="button"
                    onClick={checkPincode}
                    disabled={deliveryChecking}
                    className="px-4 text-sm font-semibold text-brand hover:text-brand-hover disabled:opacity-70"
                  >
                    {deliveryChecking ? "…" : "Check"}
                  </button>
                </div>
                {deliveryMsg && (
                  <div className="mt-2 space-y-0.5">
                    <p
                      className={`text-[12px] font-medium ${
                        deliveryOk === false
                          ? "text-danger"
                          : "text-success"
                      }`}
                    >
                      {deliveryEstimate
                        ? `Estimated delivery by ${deliveryEstimate.date}${
                            deliveryEstimate.time
                              ? ` · ${deliveryEstimate.time}`
                              : ""
                          }`
                        : deliveryMsg}
                    </p>
                    {deliveryDetail ? (
                      <p className="text-[11px] text-muted">
                        {deliveryDetail}
                      </p>
                    ) : null}
                  </div>
                )}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ribbon ? (
                    <div className="flex items-start gap-2 text-[12px] text-text">
                      <Gift
                        size={18}
                        className="mt-0.5 shrink-0 text-[#B45309]"
                      />
                      <p className="leading-snug line-clamp-2">
                        <span className="font-semibold">{ribbon}</span>
                      </p>
                    </div>
                  ) : null}
                  {product.isFreeProduct ? null : (
                    <div className="flex items-start gap-2 text-[12px] text-text">
                      <Truck
                        size={18}
                        className="mt-0.5 shrink-0 text-success"
                      />
                      <p className="leading-snug">
                        {freeShippingAbove > 0 ? (
                          <>
                            <span className="font-semibold">FREE Shipping</span>{" "}
                            on orders above {formatINR(freeShippingAbove)}
                          </>
                        ) : (
                          <>
                            <span className="font-semibold">FREE Shipping</span>{" "}
                            on all orders
                          </>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="hidden flex-wrap items-center gap-x-6 gap-y-2 rounded-[var(--radius-md)] bg-[#F3F3F3] px-4 py-3 text-[13px] text-text lg:flex">
                {showWhyCertified ? (
                  <span className="inline-flex items-center gap-1.5">
                    <BadgeCheck size={18} className="text-muted" aria-hidden />
                    100% Genuine Products
                  </span>
                ) : null}
                {showReturns ? (
                  <span className="inline-flex items-center gap-1.5">
                    <RefreshCw size={16} className="text-muted" aria-hidden />
                    Easy Return Policy
                  </span>
                ) : null}
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <Store size={16} className="shrink-0 text-muted" aria-hidden />
                  <span className="truncate">Sold by: {siteName}</span>
                </span>
              </div>

              {!isSoldOut && unitsLeft != null && unitsLeft <= 20 && (
                <div className="rounded-xl border border-[#FDBA74] bg-white px-3 py-2.5 text-center">
                  <p className="text-[13px] sm:text-sm font-semibold text-danger">
                    ⏰⏰ Only {unitsLeft} left in stock ⏰⏰
                  </p>
                </div>
              )}
              {isSoldOut && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-center">
                  <p className="text-[13px] sm:text-sm font-semibold text-red-700">
                    Sold out
                  </p>
                </div>
              )}

              {!isSoldOut && product.freeGifts?.length ? (
                <p className="flex items-center gap-1.5 rounded-lg bg-success-soft px-2.5 py-1.5 text-[12px] leading-tight text-[#166534]">
                  <Gift size={14} className="shrink-0" />
                  <span className="min-w-0 truncate">
                    <span className="font-bold">FREE:</span>{" "}
                    {product.freeGifts
                      .map((g) =>
                        g.quantity > 1 ? `${g.title} ×${g.quantity}` : g.title,
                      )
                      .join(" + ")}
                    {(() => {
                      const worth = product.freeGifts.reduce(
                        (s, g) => s + g.worth * g.quantity,
                        0,
                      );
                      return worth > 0 ? ` (worth ${formatINR(worth)})` : "";
                    })()}
                    <span className="text-text"> · added at checkout</span>
                  </span>
                </p>
              ) : null}

              {/* Review slider — horizontal slide, soft bordered cards */}
              {reviews.length > 0 && (
                <div
                  className="relative"
                  onMouseEnter={() => setReviewPaused(true)}
                  onMouseLeave={() => setReviewPaused(false)}
                  onTouchStart={(e) => {
                    setReviewPaused(true);
                    reviewTouchX.current = e.touches[0]?.clientX ?? null;
                  }}
                  onTouchEnd={(e) => {
                    const startX = reviewTouchX.current;
                    reviewTouchX.current = null;
                    if (startX == null || reviews.length <= 1) return;
                    const dx = (e.changedTouches[0]?.clientX ?? startX) - startX;
                    if (Math.abs(dx) < 40) return;
                    setReviewIdx((i) =>
                      dx < 0
                        ? (i + 1) % reviews.length
                        : (i - 1 + reviews.length) % reviews.length,
                    );
                  }}
                >
                  {reviews.length > 1 && (
                    <>
                      <button
                        type="button"
                        aria-label="Previous review"
                        onClick={() =>
                          setReviewIdx(
                            (i) => (i - 1 + reviews.length) % reviews.length,
                          )
                        }
                        className="absolute left-1.5 sm:left-2 top-1/2 z-10 -translate-y-1/2 grid h-8 w-8 place-items-center text-black"
                      >
                        <ChevronLeft size={20} strokeWidth={2.25} />
                      </button>
                      <button
                        type="button"
                        aria-label="Next review"
                        onClick={() =>
                          setReviewIdx((i) => (i + 1) % reviews.length)
                        }
                        className="absolute right-1.5 sm:right-2 top-1/2 z-10 -translate-y-1/2 grid h-8 w-8 place-items-center text-black"
                      >
                        <ChevronRight size={20} strokeWidth={2.25} />
                      </button>
                    </>
                  )}

                  <div className="overflow-hidden">
                    <div
                      className="flex transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform"
                      style={{
                        width: `${reviews.length * 100}%`,
                        transform: `translateX(-${(reviewIdx * 100) / reviews.length}%)`,
                      }}
                    >
                      {reviews.map((r, i) => {
                        const theme = REVIEW_THEMES[i % REVIEW_THEMES.length];
                        return (
                          <div
                            key={`${r.name}-${i}`}
                            className="shrink-0 px-0"
                            style={{ width: `${100 / reviews.length}%` }}
                          >
                            <article
                              className={`mx-0 rounded-2xl border border-solid p-5 sm:p-6 shadow-[0_8px_28px_rgba(15,23,42,0.07)] ${theme.border} ${theme.bg}`}
                            >
                              <div className="px-7 sm:px-9">
                                <div className="flex items-start gap-3">
                                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-[#E5E7EB]">
                                    {r.avatar ? (
                                      <Image
                                        src={r.avatar}
                                        alt=""
                                        fill
                                        className="object-cover"
                                        sizes="48px"
                                      />
                                    ) : (
                                      <span className="grid h-full w-full place-items-center text-base font-semibold text-white bg-[#9CA3AF]">
                                        {r.name.charAt(0).toUpperCase()}
                                      </span>
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1 pt-0.5">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="text-[15px] sm:text-base font-bold text-black">
                                        {r.name}
                                      </p>
                                      {r.verified && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-black px-2 py-[3px] text-[10px] font-semibold text-white">
                                          <CheckCircle2
                                            size={11}
                                            className="shrink-0"
                                          />
                                          Verified
                                        </span>
                                      )}
                                    </div>
                                    <div className="mt-1.5 flex gap-0.5">
                                      {Array.from({ length: 5 }).map((_, si) => (
                                        <Star
                                          key={si}
                                          size={15}
                                          className={
                                            si < Math.round(r.rating)
                                              ? "fill-[#F5C518] text-[#F5C518]"
                                              : "fill-[#E5E7EB] text-[#E5E7EB]"
                                          }
                                        />
                                      ))}
                                    </div>
                                  </div>
                                </div>
                                <p className="mt-3.5 text-[13px] sm:text-[14px] leading-[1.65] text-text">
                                  {r.text}
                                </p>
                              </div>
                            </article>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {reviews.length > 1 && (
                    <div className="mt-3.5 flex items-center justify-center gap-2">
                      {reviewDotIndices[0] > 0 && (
                        <span className="h-1 w-1 rounded-full bg-[#D1D5DB]" />
                      )}
                      {reviewDotIndices.map((i) => (
                        <button
                          key={i}
                          type="button"
                          aria-label={`Review ${i + 1}`}
                          onClick={() => setReviewIdx(i)}
                          className={`rounded-full transition-all duration-300 ${
                            i === reviewIdx
                              ? "h-2 w-4 bg-[#4B5563]"
                              : "h-2 w-2 bg-[#D1D5DB]"
                          }`}
                        />
                      ))}
                      {reviewDotIndices[reviewDotIndices.length - 1] <
                        reviews.length - 1 && (
                        <span className="h-1 w-1 rounded-full bg-[#D1D5DB]" />
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Related / variants rail */}
            {relatedItems.length > 0 && (
              <div className="mt-6 min-w-0">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="min-w-0 flex-1 text-[15px] font-semibold leading-snug text-black line-clamp-2">
                    {product.title}
                  </p>
                  {relatedItems.length > 1 && (
                    <div className="hidden shrink-0 items-center gap-1.5 self-center sm:flex">
                      <button
                        type="button"
                        aria-label="Previous products"
                        onClick={() => scrollRelatedRail(-1)}
                        className="grid h-9 w-9 place-items-center rounded-full border border-line-strong bg-white text-ink shadow-sm hover:border-brand/40 hover:bg-surface-alt"
                      >
                        <ChevronLeft size={20} strokeWidth={2.25} />
                      </button>
                      <button
                        type="button"
                        aria-label="Next products"
                        onClick={() => scrollRelatedRail(1)}
                        className="grid h-9 w-9 place-items-center rounded-full border border-line-strong bg-white text-ink shadow-sm hover:border-brand/40 hover:bg-surface-alt"
                      >
                        <ChevronRight size={20} strokeWidth={2.25} />
                      </button>
                    </div>
                  )}
                </div>

                <div
                  ref={relatedRailRef}
                  className="flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory scrollbar-hide pb-1 -mx-0.5 px-0.5"
                >
                  {relatedItems.map((item) => (
                    <Link
                      key={item.id}
                      data-related-card
                      href={`/products/${item.slug}`}
                      className="w-[132px] sm:w-[148px] flex-shrink-0 snap-start rounded-xl border border-line bg-white p-2 hover:border-brand"
                    >
                      <div className="relative aspect-square overflow-hidden rounded-lg bg-surface">
                        {isUsableImageSrc(item.image) && (
                          <Image
                            src={item.image!}
                            alt={item.title}
                            fill
                            className="object-cover"
                            sizes="148px"
                          />
                        )}
                      </div>
                      <p className="mt-2 line-clamp-2 text-[12px] font-medium leading-snug text-black">
                        {item.title}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px]">
                        {item.isFreeProduct ? (
                          <>
                            <FreePriceLabel size="sm" />
                            {Math.max(item.compareAt || 0, item.price || 0) >
                              0 && (
                              <span className="text-[11px] text-subtle line-through">
                                {formatINR(
                                  Math.max(item.compareAt || 0, item.price || 0),
                                )}
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <span className="font-bold">
                              {formatINR(item.price)}
                            </span>
                            {item.compareAt > item.price && (
                              <span className="text-[11px] text-subtle line-through">
                                {formatINR(item.compareAt)}
                              </span>
                            )}
                          </>
                        )}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {socialVideoIdx != null &&
              social[socialVideoIdx]?.videoUrl && (() => {
                const clip = social[socialVideoIdx];
                const liked = !!socialLiked[socialVideoIdx];
                const offPct = discountPercent(displayPrice, displayCompareAt);
                return (
                  <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90">
                    <div className="relative h-[100dvh] w-full max-w-[420px] overflow-hidden bg-black sm:h-[min(100dvh,860px)] sm:rounded-2xl sm:max-h-[92vh]">
                      <video
                        ref={socialVideoRef}
                        key={clip.videoUrl}
                        src={clip.videoUrl}
                        poster={clip.image || undefined}
                        className="absolute inset-0 h-full w-full object-cover"
                        autoPlay
                        playsInline
                        loop
                        muted={socialMuted}
                      />

                      {/* Top controls */}
                      <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
                        <div className="flex gap-2">
                          {social.length > 1 && (
                            <>
                              <button
                                type="button"
                                aria-label="Previous"
                                onClick={() =>
                                  setSocialVideoIdx(
                                    (i) =>
                                      ((i ?? 0) - 1 + social.length) %
                                      social.length,
                                  )
                                }
                                className="grid h-9 w-9 place-items-center rounded-full bg-black/40 text-white backdrop-blur-sm"
                              >
                                <ChevronLeft size={18} />
                              </button>
                              <button
                                type="button"
                                aria-label="Next"
                                onClick={() =>
                                  setSocialVideoIdx(
                                    (i) => ((i ?? 0) + 1) % social.length,
                                  )
                                }
                                className="grid h-9 w-9 place-items-center rounded-full bg-black/40 text-white backdrop-blur-sm"
                              >
                                <ChevronRight size={18} />
                              </button>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            aria-label={socialMuted ? "Unmute" : "Mute"}
                            onClick={() => setSocialMuted((m) => !m)}
                            className="grid h-9 w-9 place-items-center rounded-full bg-black/40 text-white backdrop-blur-sm"
                          >
                            {socialMuted ? (
                              <VolumeX size={18} />
                            ) : (
                              <Volume2 size={18} />
                            )}
                          </button>
                          <button
                            type="button"
                            aria-label="Close"
                            onClick={() => setSocialVideoIdx(null)}
                            className="grid h-9 w-9 place-items-center rounded-full bg-white text-black shadow"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      </div>

                      {/* Right action rail */}
                      <div className="absolute right-3 top-1/2 z-20 -translate-y-1/2 flex flex-col items-center gap-1 rounded-2xl bg-black/35 px-2 py-2.5 backdrop-blur-md">
                        <button
                          type="button"
                          aria-label={liked ? "Unlike" : "Like"}
                          onClick={() =>
                            setSocialLiked((m) => ({
                              ...m,
                              [socialVideoIdx]: !m[socialVideoIdx],
                            }))
                          }
                          className="flex flex-col items-center gap-0.5 px-1 py-1.5 text-white"
                        >
                          <Heart
                            size={24}
                            className={
                              liked
                                ? "fill-[#EF4444] text-[#EF4444]"
                                : "fill-transparent"
                            }
                          />
                          <span className="text-[11px] font-semibold tabular-nums">
                            {liked ? "Liked" : "Like"}
                          </span>
                        </button>
                        <button
                          type="button"
                          aria-label="Share"
                          onClick={() => shareSocialClip(clip.label)}
                          className="flex flex-col items-center gap-0.5 px-1 py-1.5 text-white"
                        >
                          <Send size={22} />
                          <span className="text-[11px] font-semibold">
                            Share
                          </span>
                        </button>
                        <button
                          type="button"
                          aria-label="Cart"
                          onClick={() => {
                            setSocialVideoIdx(null);
                            openCart();
                          }}
                          className="relative flex flex-col items-center gap-0.5 px-1 py-1.5 text-white"
                        >
                          <ShoppingCart size={22} />
                          {cartCount > 0 && (
                            <span className="absolute -right-0.5 top-0.5 grid min-h-[16px] min-w-[16px] place-items-center rounded-full bg-[#EF4444] px-1 text-[9px] font-bold leading-none">
                              {cartCount > 9 ? "9+" : cartCount}
                            </span>
                          )}
                          <span className="text-[11px] font-semibold">Cart</span>
                        </button>
                      </div>

                      {/* Caption */}
                      {clip.label && (
                        <p className="pointer-events-none absolute inset-x-4 bottom-[168px] z-10 text-center text-[15px] font-bold leading-snug text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] sm:bottom-[180px]">
                          {clip.label}
                        </p>
                      )}

                      {/* Bottom product card */}
                      <div className="absolute inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-20 rounded-2xl bg-[#2a2a2a]/88 p-2.5 shadow-xl backdrop-blur-md sm:inset-x-4">
                        <div className="flex items-start gap-2.5">
                          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[#111]">
                            {isUsableImageSrc(
                              product.image || product.images?.[0],
                            ) && (
                              <Image
                                src={
                                  (isUsableImageSrc(product.image)
                                    ? product.image
                                    : product.images![0])!
                                }
                                alt=""
                                fill
                                className="object-cover"
                                sizes="48px"
                              />
                            )}
                          </div>
                          <div className="min-w-0 flex-1 pt-0.5">
                            <div className="flex items-start gap-2">
                              <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white">
                                {product.title}
                              </p>
                              <button
                                type="button"
                                aria-label="View product"
                                onClick={() => setSocialVideoIdx(null)}
                                className="shrink-0 text-white/80 hover:text-white"
                              >
                                <ExternalLink size={15} />
                              </button>
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-2">
                              {product.isFreeProduct && displayPrice <= 0 ? (
                                <FreePriceLabel size="sm" />
                              ) : (
                                <span className="text-[14px] font-bold text-white tabular-nums">
                                  {formatINR(displayPrice)}
                                </span>
                              )}
                              {offPct > 0 && !product.isFreeProduct && (
                                <span className="text-[12px] font-bold text-[#4ADE80]">
                                  {offPct}% Off
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={isSoldOut}
                          onClick={() => {
                            add();
                          }}
                          className="mt-2.5 w-full rounded-[var(--radius-sm)] bg-brand py-3 text-[14px] font-semibold text-white disabled:opacity-40 hover:bg-brand-hover"
                        >
                          {isSoldOut ? "Sold out" : "Add to cart"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
          </div>
        </div>

        <div className="lg:mt-4 lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-4">
        <div className="min-w-0">
        <div className="min-w-0 lg:rounded-[var(--radius-md)] lg:border lg:border-line lg:bg-white lg:px-8 lg:pb-6 lg:pt-5 lg:shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <h2 className="text-[18px] font-semibold text-ink">Product Description</h2>
          <div className="mt-3 flex gap-6 border-b border-line text-[14px] font-semibold">
            <button
              type="button"
              onClick={() => setDescTab("description")}
              className={`-mb-px border-b-2 pb-2.5 ${
                descTab === "description"
                  ? "border-brand text-ink"
                  : "border-transparent text-muted"
              }`}
            >
              Description
            </button>
            {howToAccordion ? (
              <button
                type="button"
                onClick={() => setDescTab("howto")}
                className={`-mb-px border-b-2 pb-2.5 ${
                  descTab === "howto"
                    ? "border-brand text-ink"
                    : "border-transparent text-muted"
                }`}
              >
                How To Use
              </button>
            ) : null}
          </div>
          {descTab === "howto" && howToAccordion ? (
            <div className="mt-4 text-[14px] leading-relaxed text-text">
              {looksLikeHtml(howToAccordion.body) ? (
                <div
                  className="product-desc [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
                  dangerouslySetInnerHTML={{
                    __html: sanitizeProductHtml(howToAccordion.body),
                  }}
                />
              ) : (
                <p className="whitespace-pre-line">{howToAccordion.body}</p>
              )}
            </div>
          ) : null}
          {/* Description + crystals — admin “Description” field */}
          {descTab === "description" &&
          (product.shortDescription ||
            product.description ||
            crystals.length > 0 ||
            product.productNote) ? (
            <section className="mt-4">
              <div
                className={`text-[14px] leading-relaxed text-text ${
                  !descOpen && descPlainLen > 280 ? "line-clamp-6" : ""
                }`}
              >
                {product.shortDescription && (
                  <p className="text-[15px] font-medium text-ink">
                    {product.shortDescription}
                  </p>
                )}

                {product.description &&
                  (looksLikeHtml(product.description) ? (
                    <div
                      className="product-desc mt-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_a]:font-medium [&_a]:text-[#0F766E] [&_a]:underline [&_b]:font-semibold [&_strong]:font-semibold"
                      dangerouslySetInnerHTML={{
                        __html: sanitizeProductHtml(product.description),
                      }}
                    />
                  ) : (
                    <p className="mt-2">
                      {!product.shortDescription && (
                        <span className="font-semibold text-black">
                          {product.title}
                          {" — "}
                        </span>
                      )}
                      {product.description}
                    </p>
                  ))}

                {crystals.length > 0 && (
                  <ul className="mt-4 space-y-2">
                    {crystals.map((c) => (
                      <li key={c.name}>
                        <span className="font-semibold text-black">
                          {c.name}
                        </span>
                        {c.benefit ? ` – ${c.benefit}` : ""}
                      </li>
                    ))}
                  </ul>
                )}

                {product.productNote && (
                  <p className="mt-4 rounded-xl bg-surface-alt px-3.5 py-3 text-[13px] text-text">
                    <span className="font-semibold text-black">Note:</span>{" "}
                    {product.productNote}
                  </p>
                )}
              </div>
              {descPlainLen > 280 ? (
                <button
                  type="button"
                  onClick={() => setDescOpen((v) => !v)}
                  className="mt-3 text-[14px] font-semibold text-brand"
                >
                  {descOpen ? "Read Less" : "Read More"}
                </button>
              ) : null}
            </section>
          ) : null}

          {/* Product accordions + always-last defaults */}
          <section className="mt-6">
            {productAccordions.map((section, i) => {
              if (howToAccordion && section.title === howToAccordion.title) return null;
              const isCashback = /cashback/i.test(section.title);
              return (
                <AccordionRow
                  key={`pdp-${accordionTitleKey(section.title)}-${i}`}
                  id={accordionSectionId(section.title)}
                  title={section.title}
                  defaultOpen={!isCashback && i === 0}
                >
                  {looksLikeHtml(section.body) ? (
                    <div
                      className="product-desc text-[14px] leading-relaxed text-text [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1.5 [&_a]:text-[#0F766E] [&_a]:underline [&_b]:font-semibold [&_strong]:font-semibold"
                      dangerouslySetInnerHTML={{
                        __html: sanitizeProductHtml(section.body),
                      }}
                    />
                  ) : (
                    <p className="whitespace-pre-line">{section.body}</p>
                  )}
                </AccordionRow>
              );
            })}
            {defaultAccordions.map((section) => {
              return (
                <AccordionRow
                  key={`def-${accordionTitleKey(section.title)}`}
                  id={accordionSectionId(section.title)}
                  title={section.title}
                >
                  {looksLikeHtml(section.body) ? (
                    <div
                      className="product-desc text-[14px] leading-relaxed text-text [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_p]:my-1.5"
                      dangerouslySetInnerHTML={{
                        __html: sanitizeProductHtml(section.body),
                      }}
                    />
                  ) : (
                    <p className="whitespace-pre-line">{section.body}</p>
                  )}
                </AccordionRow>
              );
            })}
          </section>

          {/* Specs */}
          {(specRows.length > 0 || product.productSpec) && (
            <section className="mt-8">
              <h2 className="text-center font-heading text-xl font-semibold text-black">
                Specifications
              </h2>
              {specRows.length > 0 ? (
                <div className="mt-4 divide-y divide-[#E8E8E8]">
                  {specRows.map((row, i) => (
                    <div
                      key={`${row.label}-${row.value}-${i}`}
                      className="flex items-start justify-between gap-4 py-3 text-[14px]"
                    >
                      <span className="text-muted">{row.label}</span>
                      <span className="max-w-[55%] text-right font-medium text-black">
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-[14px] text-text leading-relaxed">
                  {product.productSpec}
                </p>
              )}
            </section>
          )}

          {product.certificationUrl && (
            <p className="mt-4 text-sm">
              <a
                href={product.certificationUrl}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-success underline"
              >
                {product.certificationLabel || "View certification"}
              </a>
            </p>
          )}
        </div>

        {/* Why brand — Admin → Settings → Offers (whyBrandEnabled + per-card) */}
        {showWhyBrand &&
          (showWhyHappy ||
            showWhyCertified ||
            showWhyReturns ||
            showWhyShipping) && (
        <section className="mt-8 rounded-2xl bg-surface-alt p-4 sm:p-5 lg:mt-4 lg:rounded-[var(--radius-md)] lg:border lg:border-line lg:bg-white lg:px-8 lg:py-6">
          <h2 className="font-heading text-xl font-semibold text-black">
            Why {siteName}?
          </h2>
          <div className="mt-4 space-y-3">
            {[
              showWhyHappy && {
                icon: Users,
                title: "Happy Customers",
                body: whyHappy,
                tint: "bg-[#DBEAFE]",
              },
              showWhyCertified && {
                icon: BadgeCheck,
                title: "100% Original & Certified",
                body:
                  stripHtml(
                    product.authenticityText || whyCertified || "",
                  ) || whyCertified,
                tint: "bg-[#EDE4FF]",
              },
              showWhyReturns && {
                icon: RefreshCw,
                title: "Return & Exchange",
                body: whyReturns,
                tint: "bg-[#DCFCE7]",
              },
              showWhyShipping && {
                icon: Truck,
                title: "Free Shipping",
                body: whyShipping,
                tint: "bg-[#FFEDD5]",
              },
            ]
              .filter(
                (row): row is {
                  icon: typeof Users;
                  title: string;
                  body: string;
                  tint: string;
                } => !!row,
              )
              .map((row) => (
              <div
                key={row.title}
                className={`flex gap-3 rounded-xl ${row.tint} p-3`}
              >
                <row.icon size={22} className="mt-0.5 shrink-0 text-text" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-black">
                    {row.title}
                  </p>
                  <p className="mt-0.5 text-[12px] text-text leading-snug">
                    {row.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
        )}

        {/* Social proof video slider — Reels-style */}
        {social.length > 0 && (
          <div className="mt-8 sm:mt-10">
            <p className="text-center text-[17px] sm:text-[20px] font-bold text-black tracking-tight">
              Loved by 15 lakh+ customers
            </p>

            <div className="relative mt-4 sm:mt-5">
              {social.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Previous clip"
                    onClick={() => scrollSocial(-1)}
                    className="absolute left-1 top-1/2 z-20 -translate-y-1/2 grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-full bg-black/55 text-white shadow-md backdrop-blur-[2px] hover:bg-black/70"
                  >
                    <ChevronLeft size={20} strokeWidth={2.25} />
                  </button>
                  <button
                    type="button"
                    aria-label="Next clip"
                    onClick={() => scrollSocial(1)}
                    className="absolute right-1 top-1/2 z-20 -translate-y-1/2 grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-full bg-black/55 text-white shadow-md backdrop-blur-[2px] hover:bg-black/70"
                  >
                    <ChevronRight size={20} strokeWidth={2.25} />
                  </button>
                </>
              )}

              <div
                ref={socialTrackRef}
                className="flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory scrollbar-hide px-1 pb-1"
              >
                {social.map((s, i) => {
                  const hasVideo = !!s.videoUrl;
                  const liked = !!socialLiked[i];
                  return (
                    <article
                      key={`${s.videoUrl || s.image}-${i}`}
                      data-social-card
                      className="relative aspect-[9/16] w-[min(70vw,210px)] sm:w-[168px] md:w-[175px] lg:w-[180px] flex-shrink-0 snap-start overflow-hidden rounded-2xl bg-[#111] shadow-[0_8px_24px_rgba(0,0,0,0.12)] group"
                    >
                      <button
                        type="button"
                        className="absolute inset-0 z-0"
                        onClick={() => {
                          if (hasVideo) setSocialVideoIdx(i);
                        }}
                        aria-label={
                          hasVideo
                            ? `Play ${s.label || "video"}`
                            : s.label || "Clip"
                        }
                      >
                        {isUsableImageSrc(s.image) ? (
                          <Image
                            src={s.image!}
                            alt={s.label || ""}
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 70vw, 180px"
                          />
                        ) : hasVideo ? (
                          <video
                            src={s.videoUrl}
                            className="absolute inset-0 h-full w-full object-cover"
                            muted
                            playsInline
                            loop
                            autoPlay
                            preload="metadata"
                          />
                        ) : null}
                        <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/25 pointer-events-none" />
                      </button>

                      {s.views && (
                        <span className="pointer-events-none absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur-[2px]">
                          <Eye size={12} className="opacity-90" />
                          {s.views}
                        </span>
                      )}

                      {hasVideo && (
                        <span className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 grid h-10 w-10 place-items-center rounded-full bg-black/45 text-white ring-1 ring-white/25 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <Play size={16} className="ml-0.5 fill-white" />
                        </span>
                      )}

                      <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-2 p-2.5 pt-10 pointer-events-none">
                        <p className="min-w-0 flex-1 text-[13px] sm:text-[14px] font-bold leading-snug text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] line-clamp-3">
                          {s.label}
                        </p>
                        <div className="pointer-events-auto flex flex-col items-center gap-2.5 shrink-0 pb-0.5">
                          <button
                            type="button"
                            aria-label={liked ? "Unlike" : "Like"}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSocialLiked((m) => ({
                                ...m,
                                [i]: !m[i],
                              }));
                            }}
                            className="grid place-items-center text-white drop-shadow"
                          >
                            <Heart
                              size={22}
                              className={
                                liked
                                  ? "fill-[#EF4444] text-[#EF4444]"
                                  : "fill-transparent"
                              }
                            />
                          </button>
                          <button
                            type="button"
                            aria-label="Share"
                            onClick={(e) => {
                              e.stopPropagation();
                              shareSocialClip(s.label);
                            }}
                            className="grid place-items-center text-white drop-shadow"
                          >
                            <Send size={20} />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {relatedItems.length > 0 && (
          <section className="mt-8 lg:mt-4 lg:rounded-[var(--radius-md)] lg:border lg:border-line lg:bg-white lg:px-6 lg:py-5">
            <h2 className="text-[18px] font-semibold text-ink">Customers also Viewed</h2>
            <div className="mt-4 flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
              {relatedItems.slice(0, 8).map((item) => (
                <div key={`yml-${item.id}`} className="w-[168px] shrink-0 sm:w-[190px]">
                  <ProductCard
                    product={item}
                    prefetch={false}
                    imageSizes="190px"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {showReviews ? (
          <ProductReviews
            slug={product.slug}
            productId={product.id}
            productTitle={product.title}
            productImage={isUsableImageSrc(product.image) ? product.image : null}
            allowSubmissions={offer.reviewSubmissions}
          />
        ) : null}
        </div>
        <aside className="sticky top-24 hidden lg:block">
          <div className="rounded-[var(--radius-md)] border border-line bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            <div className="flex gap-3">
              <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-md bg-surface">
                {isUsableImageSrc(displayImages[0]) ? (
                  <Image
                    src={displayImages[0]}
                    alt=""
                    fill
                    className="object-contain"
                    sizes="72px"
                  />
                ) : null}
              </div>
              <div className="min-w-0">
                <p className="line-clamp-2 text-[13px] font-medium leading-snug text-ink">
                  {product.title}
                </p>
                <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 text-[13px]">
                  {product.isFreeProduct && displayPrice <= 0 ? (
                    <FreePriceLabel size="sm" />
                  ) : (
                    <span className="font-semibold text-ink">{formatINR(displayPrice)}</span>
                  )}
                  {displayCompareAt > displayPrice ? (
                    <span className="text-muted line-through">{formatINR(displayCompareAt)}</span>
                  ) : null}
                  {offerLabel && !product.isFreeProduct ? (
                    <span className="font-semibold text-success">{offerLabel}</span>
                  ) : null}
                </p>
                {reviewItems.length > 0 ? (
                  <p className="mt-1 inline-flex items-center gap-1 text-[12px] text-muted">
                    <Star size={12} className="fill-ink text-ink" aria-hidden />
                    {(Number(product.rating) || 0).toFixed(1)}
                    <span>({reviewItems.length})</span>
                  </p>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              disabled={isSoldOut}
              onClick={add}
              className="mt-3 h-11 w-full rounded-[var(--radius-sm)] bg-brand text-[15px] font-semibold text-white disabled:opacity-40 hover:bg-brand-hover"
            >
              {isSoldOut ? "Sold out" : "Add to Bag"}
            </button>
          </div>
        </aside>
        </div>

        <RecentlyViewed currentSlug={product.slug} />
      </div>

      {/* Sticky mobile CTA — same card as reference */}
      <div className="fixed bottom-0 left-0 right-0 z-30 md:hidden px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 pointer-events-none w-full max-w-[100vw] box-border">
        <div className="pointer-events-auto overflow-hidden rounded-[var(--radius-md)] border border-line bg-white shadow-[0_-4px_24px_rgba(0,0,0,0.12)] max-w-full">
          {promoBanner ? (
            <div className="bg-success px-3 py-2 text-center text-[12px] font-bold leading-snug text-white truncate">
              {promoBanner}
            </div>
          ) : null}
          <div className="px-3 pt-2.5 pb-2.5 min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 min-w-0">
              {product.isFreeProduct && displayPrice <= 0 ? (
                <FreePriceLabel />
              ) : (
                <span className="text-[18px] font-semibold leading-none text-ink tabular-nums">
                  {formatINR(displayPrice)}
                </span>
              )}
              {displayCompareAt > displayPrice && (
                <span className="text-[11px] text-subtle line-through tabular-nums">
                  {formatINR(displayCompareAt)}
                </span>
              )}
              {product.isFreeProduct && displayCompareAt > 0 && (
                <span className="text-[10px] font-semibold text-success">
                  100% OFF
                </span>
              )}
              {offerLabel && !product.isFreeProduct && (
                <span className="text-[10px] font-bold text-success">
                  {offerLabel}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isSoldOut}
                onClick={add}
                className="rounded-[var(--radius-sm)] bg-brand py-3 text-[13px] font-semibold text-white transition-colors disabled:opacity-40 hover:bg-brand-hover"
              >
                Add to Bag
              </button>
              <button
                type="button"
                disabled={isSoldOut}
                onClick={buy}
                className="rounded-[var(--radius-sm)] border border-brand bg-white py-3 text-[13px] font-semibold text-brand transition-colors disabled:opacity-40"
              >
                Buy Now
              </button>
            </div>
          </div>
        </div>
      </div>

      <OrderSocialProofToast />
    </div>
  );
}
