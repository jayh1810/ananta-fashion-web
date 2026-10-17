"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Camera,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MessageSquareQuote,
  PenLine,
  ShieldCheck,
  Star,
  X,
} from "lucide-react";
import { BRAND } from "@/lib/api";
import { useCustomerAuth } from "@/lib/customer-auth";
import {
  fetchMyReview,
  fetchProductReviews,
  formatReviewDate,
  reviewAge,
  type PhotoReview,
  type ReviewEligibility,
  type PublicReview,
  type ReviewPhotoSlide,
  type ReviewSort,
  type ReviewSummary,
} from "@/lib/reviews";
import { ReviewFormModal } from "@/components/reviews/ReviewFormModal";

const PAGE_SIZE = 5;
const AVATAR_TONES = [
  "from-[#FF7EB0] to-[#FC2779]",
  "from-[#C084FC] to-[#7C3AED]",
  "from-[#5EEAD4] to-[#0D9488]",
  "from-[#FCA5A5] to-[#DC2626]",
  "from-[#93C5FD] to-[#2563EB]",
];

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = Math.max(0, Math.min(1, value - (n - 1)));
        return (
          <span key={n} className="relative inline-block" style={{ width: size, height: size }}>
            <Star size={size} className="absolute inset-0 text-[#E5D3B3]" />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star size={size} className="fill-[#F5B301] text-[#F5B301]" />
            </span>
          </span>
        );
      })}
    </span>
  );
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" loading="lazy" />;
  }
  const initial = (name.trim()[0] || "C").toUpperCase();
  const tone = AVATAR_TONES[initial.charCodeAt(0) % AVATAR_TONES.length];
  return (
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${tone} text-sm font-bold text-white`}>
      {initial}
    </span>
  );
}

function ReviewCard({
  review,
  onOpenPhoto,
}: {
  review: PublicReview;
  onOpenPhoto: (slides: ReviewPhotoSlide[], index: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const long = review.body.length > 320;
  return (
    <article className="rounded-2xl border border-[#F0E6D8] bg-white p-4 sm:p-5 shadow-[0_1px_8px_rgba(120,80,20,0.04)]">
      <header className="flex items-start gap-3">
        <Avatar name={review.authorName} url={review.avatarUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <p className="font-semibold text-black">{review.authorName}</p>
            {review.isVerified ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF3] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#15803D]">
                <BadgeCheck size={12} /> Verified buyer
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <Stars value={review.rating} size={13} />
            <time className="text-xs text-[#9CA3AF]" dateTime={review.createdAt}>
              {formatReviewDate(review.createdAt)}
            </time>
          </div>
        </div>
      </header>

      {review.title ? <p className="mt-3 font-semibold text-black">{review.title}</p> : null}
      <p className={`mt-1.5 whitespace-pre-line text-[14px] leading-relaxed text-[#374151] ${!expanded && long ? "line-clamp-5" : ""}`}>
        {review.body}
      </p>
      {long ? (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-1 text-xs font-semibold text-[#92400E] hover:underline">
          {expanded ? "Show less" : "Read more"}
        </button>
      ) : null}

      {review.images.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {review.images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => onOpenPhoto(review.images.map((url) => ({ url, review })), i)}
              className="h-16 w-16 overflow-hidden rounded-xl ring-1 ring-black/5 transition hover:opacity-90 sm:h-20 sm:w-20"
              aria-label={`Open photo ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Customer photo ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}

      {review.adminReply ? (
        <div className="mt-4 rounded-xl border-l-4 border-[var(--bhagva)] bg-[#FFF8EE] px-4 py-3">
          <p className="flex items-center gap-1.5 text-xs font-bold text-[#92400E]">
            <MessageSquareQuote size={14} /> Response from {BRAND}
          </p>
          <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-[#4B5563]">{review.adminReply}</p>
        </div>
      ) : null}
    </article>
  );
}

function ratingTone(rating: number) {
  if (rating >= 4) return "bg-[#16A34A]";
  if (rating === 3) return "bg-[#F59E0B]";
  return "bg-[#DC2626]";
}

function PhotoReviewInfo({ review }: { review: PhotoReview }) {
  const [expanded, setExpanded] = useState(false);
  const long = review.body.length > 180;
  return (
    <div className="text-white">
      <div className="flex items-start gap-2">
        <span className={`inline-flex shrink-0 items-center gap-0.5 rounded px-1.5 py-0.5 text-[12px] font-bold leading-4 ${ratingTone(review.rating)}`}>
          {review.rating}
          <Star size={10} className="fill-white text-white" />
        </span>
        {review.title ? <p className="text-sm font-semibold leading-5">{review.title}</p> : null}
      </div>
      <p className={`mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-white/85 ${!expanded && long ? "line-clamp-2" : "max-h-[30vh] overflow-y-auto"}`}>
        {review.body}
      </p>
      {long ? (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-0.5 text-xs font-semibold text-[#FDBA74] hover:underline">
          {expanded ? "Show less" : "Read more"}
        </button>
      ) : null}
      <p className="mt-2 text-xs font-medium text-white/60">{review.authorName}</p>
      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-white/50">
        {review.isVerified ? (
          <>
            <BadgeCheck size={13} className="text-white/60" /> Verified Buyer
            <span aria-hidden>·</span>
          </>
        ) : null}
        <time dateTime={review.createdAt}>{reviewAge(review.createdAt)}</time>
      </p>
    </div>
  );
}

/** Full-screen customer photo viewer with the review it belongs to. */
function PhotoViewer({
  slides,
  index,
  onClose,
  onIndex,
}: {
  slides: ReviewPhotoSlide[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const count = slides.length;
  const slide = slides[index];
  const touchX = useRef<number | null>(null);
  const go = useCallback((delta: number) => onIndex((index + delta + count) % count), [count, index, onIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (count > 1 && e.key === "ArrowRight") go(1);
      if (count > 1 && e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count, go, onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!slide) return null;
  const arrow =
    "absolute top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white backdrop-blur transition hover:bg-white/25 sm:grid";

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black" role="dialog" aria-modal="true" aria-label="Customer photo">
      <div className="flex shrink-0 items-center justify-between px-2 py-2 sm:px-4 sm:py-3">
        <button type="button" onClick={onClose} className="rounded-full p-2 text-white hover:bg-white/10" aria-label="Back to reviews">
          <ArrowLeft size={22} />
        </button>
        {count > 1 ? (
          <span className="text-xs font-semibold tabular-nums text-white/70">
            {index + 1} / {count}
          </span>
        ) : null}
      </div>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center px-3 sm:px-16"
        onTouchStart={(e) => {
          touchX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const start = touchX.current;
          touchX.current = null;
          if (start == null || count <= 1) return;
          const dx = (e.changedTouches[0]?.clientX ?? start) - start;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        }}
      >
        {count > 1 ? (
          <button type="button" onClick={() => go(-1)} className={`${arrow} left-4`} aria-label="Previous photo">
            <ChevronLeft size={24} />
          </button>
        ) : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={slide.url}
          src={slide.url}
          alt={slide.review ? `Photo from ${slide.review.authorName}'s review` : "Customer photo"}
          className="max-h-full max-w-full select-none object-contain"
          draggable={false}
        />
        {count > 1 ? (
          <button type="button" onClick={() => go(1)} className={`${arrow} right-4`} aria-label="Next photo">
            <ChevronRight size={24} />
          </button>
        ) : null}
      </div>

      <div className="shrink-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-6">
        <div className="mx-auto w-full max-w-5xl">
          {count > 1 ? (
            <div className="mb-3 flex justify-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
              {slides.map((s, i) => (
                <button
                  key={`${s.url}-${i}`}
                  type="button"
                  onClick={() => onIndex(i)}
                  className={`h-11 w-11 shrink-0 overflow-hidden rounded-md transition ${i === index ? "ring-2 ring-white" : "opacity-50 hover:opacity-90"}`}
                  aria-label={`Photo ${i + 1}`}
                  aria-current={i === index}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          ) : null}
          {slide.review ? <PhotoReviewInfo key={slide.review.id} review={slide.review} /> : null}
        </div>
      </div>
    </div>
  );
}

function pageList(page: number, pages: number): (number | "gap")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set([1, pages, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((n) => set.add(n));
  if (page >= pages - 2) [pages - 3, pages - 2, pages - 1].forEach((n) => set.add(n));
  const nums = [...set].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  nums.forEach((n, i) => {
    if (i > 0 && n - nums[i - 1] > 1) out.push("gap");
    out.push(n);
  });
  return out;
}

function ReviewPagination({
  page,
  pages,
  total,
  onPage,
  disabled,
}: {
  page: number;
  pages: number;
  total: number;
  onPage: (page: number) => void;
  disabled: boolean;
}) {
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, page * PAGE_SIZE);
  const btn =
    "grid h-9 min-w-9 place-items-center rounded-full px-2 text-sm font-semibold tabular-nums transition disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <nav className="mt-5 flex flex-col items-center gap-2.5 sm:flex-row sm:justify-between" aria-label="Review pages">
      <p className="text-xs text-[#6B7280]">
        Showing {from}–{to} of {total.toLocaleString("en-IN")} reviews
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={disabled || page <= 1}
          className={`${btn} border border-[#E5E7EB] bg-white text-black hover:border-black`}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>
        {pageList(page, pages).map((n, i) =>
          n === "gap" ? (
            <span key={`gap-${i}`} className="px-1 text-sm text-[#9CA3AF]">
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              onClick={() => onPage(n)}
              disabled={disabled && n !== page}
              aria-current={n === page ? "page" : undefined}
              className={`${btn} ${n === page ? "bg-black text-white" : "text-[#374151] hover:bg-[#F6EFE3]"}`}
            >
              {n}
            </button>
          ),
        )}
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={disabled || page >= pages}
          className={`${btn} border border-[#E5E7EB] bg-white text-black hover:border-black`}
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </nav>
  );
}

export function ProductReviews({
  slug,
  productId,
  productTitle,
  productImage,
  allowSubmissions = true,
}: {
  slug: string;
  productId: string;
  productTitle: string;
  productImage?: string | null;
  allowSubmissions?: boolean;
}) {
  const token = useCustomerAuth((s) => s.token);
  const openLogin = useCustomerAuth((s) => s.openLogin);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [items, setItems] = useState<PublicReview[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState<ReviewSort>("recent");
  const [rating, setRating] = useState<number | null>(null);
  const [photosOnly, setPhotosOnly] = useState(false);
  const [loadedKey, setLoadedKey] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  /** Set when a logged-out shopper taps "Write a review" — form opens once they log in. */
  const [writeAfterLogin, setWriteAfterLogin] = useState(false);
  const [ownState, setOwnState] = useState<{ token: string; elig: ReviewEligibility } | null>(null);
  const [lightbox, setLightbox] = useState<{ slides: ReviewPhotoSlide[]; index: number } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const queryKey = `${slug}|${page}|${sort}|${rating ?? ""}|${photosOnly ? 1 : 0}|${reloadKey}`;
  const loading = loadedKey !== queryKey;
  const mine = token && ownState?.token === token ? ownState.elig : null;
  const own = mine?.review ?? null;
  // Only shoppers with a delivered (not returned / RTO) order get the write button.
  const canWrite = Boolean(allowSubmissions && mine?.eligible);
  const showForm = canWrite && (formOpen || writeAfterLogin);

  useEffect(() => {
    let cancelled = false;
    fetchProductReviews(slug, { page, limit: PAGE_SIZE, sort, rating, photos: photosOnly })
      .then((res) => {
        if (cancelled) return;
        setSummary(res.summary);
        setItems(res.data);
        setPages(res.pages);
        setTotal(res.total);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoadedKey(queryKey);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, page, sort, rating, photosOnly, queryKey]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchMyReview(productId, token)
      .then((res) => {
        if (!cancelled) setOwnState({ token, elig: res });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [token, productId, reloadKey]);

  const goToPage = (next: number) => {
    if (next < 1 || next > pages || next === page) return;
    setPage(next);
    const top = listRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 80) listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const changeRating = (n: number | null) => {
    setRating(n);
    setPage(1);
  };
  const changePhotosOnly = (v: boolean) => {
    setPhotosOnly(v);
    setPage(1);
  };

  const requestLogin = useCallback(() => {
    setWriteAfterLogin(true);
    setFormOpen(false);
    openLogin();
  }, [openLogin]);

  const startWrite = () => {
    if (canWrite) setFormOpen(true);
  };

  const writeHint = !allowSubmissions || canWrite ? null : !token ? (
    <p className="text-xs text-[#6B7280]">
      Bought this product?{" "}
      <button type="button" onClick={requestLogin} className="font-semibold text-black underline underline-offset-2">
        Log in
      </button>{" "}
      to review it after delivery.
    </p>
  ) : mine ? (
    <p className="max-w-xs text-xs text-[#6B7280]">
      {mine.reason === "not_delivered"
        ? "You can write a review once your order is delivered."
        : "Only customers whose order was delivered can write a review."}
    </p>
  ) : null;

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setWriteAfterLogin(false);
  }, []);
  const onSaved = useCallback(() => {
    setPage(1);
    setReloadKey((k) => k + 1);
  }, []);
  const openPhoto = useCallback((slides: ReviewPhotoSlide[], index: number) => setLightbox({ slides, index }), []);
  const closePhoto = useCallback(() => setLightbox(null), []);
  const setPhotoIndex = useCallback(
    (i: number) => setLightbox((lb) => (lb ? { ...lb, index: i } : lb)),
    [],
  );

  const count = summary?.count || 0;
  const avg = summary?.average || 0;
  const filtersActive = rating !== null || photosOnly;

  return (
    <section id="reviews" className="mt-8 scroll-mt-24 lg:mt-4" aria-labelledby="reviews-heading">
      <div className="rounded-[var(--radius-md)] border border-line bg-white p-4 sm:p-6 lg:p-8">
        <h2 id="reviews-heading" className="text-[18px] font-semibold text-ink">
          Product Details
        </h2>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-b border-line">
          <p className="-mb-px inline-block border-b-2 border-brand pb-2.5 text-[15px] font-semibold text-ink">
            Ratings &amp; Reviews
          </p>
          {canWrite ? (
            <button
              type="button"
              onClick={startWrite}
              className="mb-2 inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-brand px-4 py-2 text-sm font-semibold text-brand hover:bg-brand-soft"
            >
              <PenLine size={15} />
              {own ? "Edit your review" : "Write Review"}
            </button>
          ) : (
            <div className="mb-2">{writeHint}</div>
          )}
        </div>

        {own && own.status !== "published" ? (
          <p className={`mt-4 rounded-xl px-4 py-2.5 text-sm ${own.status === "pending" ? "bg-amber-50 text-amber-900" : "bg-slate-100 text-slate-700"}`}>
            {own.status === "pending"
              ? "Thanks! Your review is awaiting approval and will appear here soon."
              : canWrite
                ? "Your review isn't shown publicly. You can edit and resubmit it."
                : "Your review isn't shown publicly."}
          </p>
        ) : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-8">
          {/* Summary */}
          <aside className="h-fit rounded-[var(--radius-md)] border border-line bg-white p-5">
            {count > 0 ? (
              <>
                <div className="flex items-end gap-3">
                  <p className="font-heading text-4xl font-semibold leading-none text-ink">
                    {avg.toFixed(1)}/5
                  </p>
                  <div className="pb-0.5">
                    <p className="text-[13px] font-semibold text-ink">Overall Rating</p>
                    <p className="text-[12px] text-muted">
                      {count.toLocaleString("en-IN")} verified rating{count === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
                <div className="mt-5 space-y-1.5">
                  {[5, 4, 3, 2, 1].map((n) => {
                    const c = summary?.distribution[String(n) as "1"] || 0;
                    const pct = count ? Math.round((c / count) * 100) : 0;
                    const active = rating === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        disabled={!c}
                        onClick={() => changeRating(active ? null : n)}
                        className={`flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-xs transition ${active ? "bg-[var(--bhagva-soft)]" : "hover:bg-[#FAF5EC]"} disabled:cursor-default disabled:opacity-50`}
                        aria-pressed={active}
                      >
                        <span className="flex w-7 items-center gap-0.5 font-semibold text-[#374151]">
                          {n}
                          <Star size={11} className="fill-[#F5B301] text-[#F5B301]" />
                        </span>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-[#F3EADB]">
                          <span className="block h-full rounded-full bg-gradient-to-r from-[var(--rating)] to-[var(--rating)]" style={{ width: `${pct}%` }} />
                        </span>
                        <span className="w-9 text-right tabular-nums text-[#6B7280]">{pct}%</span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="text-center">
                <Stars value={0} size={20} />
                <p className="mt-2 font-semibold text-black">No reviews yet</p>
                {allowSubmissions ? (
                  <p className="mt-1 text-xs text-[#6B7280]">Bought this product? Be the first to share your experience.</p>
                ) : null}
              </div>
            )}
            {allowSubmissions ? (
              <p className="mt-5 flex items-start gap-2 border-t border-[#F3EADB] pt-4 text-[11px] leading-snug text-[#6B7280]">
                <ShieldCheck size={15} className="mt-px shrink-0 text-[#16A34A]" />
                Only customers who bought and received this product can write a review.
              </p>
            ) : null}
          </aside>

          {/* List */}
          <div className="min-w-0">
            {summary?.photos.length ? (
              <div className="mb-5">
                <p className="mb-2 text-sm font-semibold text-ink">Photos From Customers</p>
                <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
                  {summary.photos.map((p, i) => (
                    <button
                      key={`${p.reviewId}-${p.url}`}
                      type="button"
                      onClick={() =>
                        openPhoto(
                          summary.photos.map((x) => ({
                            url: x.url,
                            review: x.review || items.find((r) => r.id === x.reviewId) || null,
                          })),
                          i,
                        )
                      }
                      className="h-20 w-20 shrink-0 overflow-hidden rounded-xl ring-1 ring-black/5 transition hover:opacity-90 sm:h-24 sm:w-24"
                      aria-label={`Open customer photo ${i + 1}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt={`Customer photo ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {count > 0 ? (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRating(null);
                    setPhotosOnly(false);
                    setPage(1);
                  }}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${!filtersActive ? "border-black bg-black text-white" : "border-[#E5E7EB] bg-white text-[#374151] hover:border-[#D1D5DB]"}`}
                >
                  All ({count})
                </button>
                {summary?.withPhotos ? (
                  <button
                    type="button"
                    onClick={() => changePhotosOnly(!photosOnly)}
                    className={`inline-flex items-center gap-1 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${photosOnly ? "border-black bg-black text-white" : "border-[#E5E7EB] bg-white text-[#374151] hover:border-[#D1D5DB]"}`}
                  >
                    <Camera size={12} /> With photos ({summary.withPhotos})
                  </button>
                ) : null}
                {rating ? (
                  <button
                    type="button"
                    onClick={() => changeRating(null)}
                    className="inline-flex items-center gap-1 rounded-full border border-black bg-black px-3.5 py-1.5 text-xs font-semibold text-white"
                  >
                    {rating} star <X size={12} />
                  </button>
                ) : null}
                <label className="ml-auto flex items-center gap-2 text-xs text-[#6B7280]">
                  Sort by
                  <select
                    value={sort}
                    onChange={(e) => {
                      setSort(e.target.value as ReviewSort);
                      setPage(1);
                    }}
                    className="rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-semibold text-black outline-none focus:border-[var(--bhagva)]"
                  >
                    <option value="recent">Most recent</option>
                    <option value="highest">Highest rated</option>
                    <option value="lowest">Lowest rated</option>
                  </select>
                </label>
              </div>
            ) : null}

            {loading && !items.length ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-32 animate-pulse rounded-2xl bg-[#F6EFE3]" />
                ))}
              </div>
            ) : items.length ? (
              <div ref={listRef} className="scroll-mt-28">
                <div className={`relative space-y-3 transition-opacity ${loading ? "pointer-events-none opacity-50" : ""}`}>
                  {loading ? (
                    <Loader2 size={22} className="absolute left-1/2 top-10 z-10 -translate-x-1/2 animate-spin text-[var(--bhagva)]" />
                  ) : null}
                  {items.map((r) => (
                    <ReviewCard key={r.id} review={r} onOpenPhoto={openPhoto} />
                  ))}
                </div>
                {pages > 1 ? (
                  <ReviewPagination page={page} pages={pages} total={total} onPage={goToPage} disabled={loading} />
                ) : null}
              </div>
            ) : count > 0 ? (
              <p className="rounded-2xl border border-dashed border-[#E8D9C4] px-4 py-10 text-center text-sm text-[#6B7280]">
                No reviews match this filter.
              </p>
            ) : (
              <div className="rounded-2xl border border-dashed border-[#E8D9C4] bg-white px-4 py-12 text-center">
                <MessageSquareQuote className="mx-auto text-[var(--bhagva)]" size={36} />
                <p className="mt-3 font-heading text-lg font-semibold text-black">
                  Share your experience
                </p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-[#6B7280]">
                  {canWrite
                    ? "Your review helps other seekers choose the right product with confidence."
                    : "No customer reviews for this product yet."}
                </p>
                {canWrite ? (
                  <button type="button" onClick={startWrite} className="mt-5 inline-flex items-center gap-2 rounded-full bg-black px-5 py-2.5 text-sm font-bold text-white hover:bg-[#222]">
                    <PenLine size={15} /> {own ? "Edit your review" : "Write a review"}
                  </button>
                ) : writeHint ? (
                  <div className="mt-3 flex justify-center">{writeHint}</div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>

      {showForm ? (
      <ReviewFormModal
        open
        onClose={closeForm}
        productId={productId}
        productTitle={productTitle}
        productImage={productImage}
        onSaved={onSaved}
        onRequestLogin={requestLogin}
      />
      ) : null}
      {lightbox ? (
        <PhotoViewer
          slides={lightbox.slides}
          index={lightbox.index}
          onClose={closePhoto}
          onIndex={setPhotoIndex}
        />
      ) : null}
    </section>
  );
}
