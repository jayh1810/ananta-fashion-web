"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  Loader2,
  PackageCheck,
  ShieldCheck,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useCustomerAuth } from "@/lib/customer-auth";
import { useStoreOffer } from "@/components/StoreOfferProvider";
import {
  RATING_LABELS,
  REVIEW_BODY_MAX,
  REVIEW_BODY_MIN,
  REVIEW_MAX_PHOTOS,
  REVIEW_PHOTO_MAX_MB,
  deleteMyReview,
  fetchMyReview,
  submitReview,
  uploadReviewPhoto,
  type OwnReview,
  type ReviewEligibility,
  type ReviewPhoto,
} from "@/lib/reviews";

type PhotoSlot = ReviewPhoto & { key: string; preview: string; progress: number | null; error?: string };

export function ReviewFormModal({
  open,
  onClose,
  productId,
  productTitle,
  productImage,
  onSaved,
  onRequestLogin,
}: {
  open: boolean;
  onClose: () => void;
  productId: string;
  productTitle: string;
  productImage?: string | null;
  onSaved: () => void;
  onRequestLogin: () => void;
}) {
  const token = useCustomerAuth((s) => s.token);
  const allowPhotos = useStoreOffer().reviewPhotos;
  const [elig, setElig] = useState<ReviewEligibility | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [photos, setPhotos] = useState<PhotoSlot[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<OwnReview["status"] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !token) return;
    let cancelled = false;
    fetchMyReview(productId, token)
      .then((res) => {
        if (cancelled) return;
        setElig(res);
        const r = res.review;
        setRating(r?.rating || 0);
        setTitle(r?.title || "");
        setBody(r?.body || "");
        setName(r?.authorName || res.defaultName || "");
        setPhotos(
          (r?.images || []).map((url) => ({ url, key: url, preview: url, progress: null })),
        );
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, token, productId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, saving, onClose]);

  if (!open) return null;

  const uploading = photos.some((p) => p.progress !== null);
  const bodyLen = body.trim().length;
  const canSubmit = rating > 0 && bodyLen >= REVIEW_BODY_MIN && !uploading && !saving;
  const shownRating = hover || rating;

  function addFiles(list: FileList | null) {
    if (!list || !token) return;
    const room = REVIEW_MAX_PHOTOS - photos.length;
    const files = Array.from(list).slice(0, Math.max(0, room));
    for (const file of files) {
      const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
        setError("Please add JPG, PNG or WebP photos.");
        continue;
      }
      if (file.size > REVIEW_PHOTO_MAX_MB * 1024 * 1024) {
        setError(`Each photo must be under ${REVIEW_PHOTO_MAX_MB} MB.`);
        continue;
      }
      const preview = URL.createObjectURL(file);
      setPhotos((prev) => [...prev, { key, url: "", preview, progress: 0 }]);
      const job = uploadReviewPhoto(file, token, (pct) =>
        setPhotos((prev) => prev.map((p) => (p.key === key ? { ...p, progress: pct } : p))),
      );
      job.promise
        .then((res) =>
          setPhotos((prev) =>
            prev.map((p) => (p.key === key ? { ...p, url: res.url, sig: res.sig, progress: null } : p)),
          ),
        )
        .catch((e: unknown) => {
          setPhotos((prev) => prev.filter((p) => p.key !== key));
          setError(e instanceof Error ? e.message : "Upload failed");
        });
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submit() {
    if (!token || !canSubmit) return;
    setSaving(true);
    setError("");
    try {
      const res = await submitReview(token, {
        productId,
        rating,
        title: title.trim() || undefined,
        body: body.trim(),
        authorName: name.trim() || undefined,
        images: photos.filter((p) => p.url).map(({ url, sig }) => ({ url, sig })),
      });
      setDone(res.review?.status || "pending");
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not submit your review");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!token || !elig?.review) return;
    if (!window.confirm("Delete your review?")) return;
    setSaving(true);
    try {
      await deleteMyReview(token, elig.review.id);
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not delete");
    } finally {
      setSaving(false);
    }
  }

  const editing = Boolean(elig?.review);

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="review-form-title">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => !saving && onClose()} />
      <div className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-w-lg sm:rounded-3xl">
        <div className="flex items-center gap-3 border-b border-[#F0E6D8] bg-gradient-to-r from-[#FFF8EE] to-white px-5 py-4">
          {productImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={productImage} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-black/5" />
          ) : null}
          <div className="min-w-0 flex-1">
            <p id="review-form-title" className="font-heading text-lg font-semibold text-black">
              {editing ? "Edit your review" : "Write a review"}
            </p>
            <p className="truncate text-xs text-[#6B7280]">{productTitle}</p>
          </div>
          <button type="button" onClick={() => !saving && onClose()} className="rounded-full p-2 text-[#6B7280] hover:bg-black/5" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {!token ? (
            <div className="py-6 text-center">
              <ShieldCheck className="mx-auto text-[#16A34A]" size={40} />
              <p className="mt-3 font-semibold text-black">Log in to write a review</p>
              <p className="mt-1 text-sm text-[#6B7280]">
                Only verified buyers can review, so every review on our store is genuine.
              </p>
              <button
                type="button"
                onClick={onRequestLogin}
                className="mt-5 inline-flex items-center justify-center rounded-full bg-black px-6 py-2.5 text-sm font-bold text-white hover:bg-[#222]"
              >
                Log in to continue
              </button>
            </div>
          ) : loading || !elig ? (
            <div className="flex items-center justify-center py-12 text-[#6B7280]">
              {error ? <p className="text-sm text-red-600">{error}</p> : <Loader2 className="animate-spin" />}
            </div>
          ) : done ? (
            <div className="py-6 text-center">
              <CheckCircle2 className="mx-auto text-[#16A34A]" size={48} />
              <p className="mt-3 font-heading text-xl font-semibold text-black">
                Thank you for your review!
              </p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-[#6B7280]">
                {done === "published"
                  ? "Your review is now live on this page."
                  : "It will appear on this page once our team has checked it — usually within 24 hours."}
              </p>
              <button type="button" onClick={onClose} className="mt-5 rounded-full border border-black px-6 py-2 text-sm font-bold hover:bg-black hover:text-white">
                Done
              </button>
            </div>
          ) : !elig.eligible ? (
            <div className="py-6 text-center">
              <PackageCheck className="mx-auto text-[var(--bhagva)]" size={40} />
              <p className="mt-3 font-semibold text-black">
                {elig.reason === "not_delivered"
                  ? "Your order is on its way"
                  : elig.reason === "returned"
                    ? "This order was returned"
                    : "Reviews are for verified buyers"}
              </p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-[#6B7280]">
                {elig.reason === "not_delivered"
                  ? "You can review this product as soon as your order is delivered."
                  : elig.reason === "returned"
                    ? "Reviews can only be written for orders that were delivered and kept."
                    : "Once you buy this product and it's delivered, you can share your experience here."}
              </p>
              {elig.reason === "not_delivered" ? (
                <Link href="/account/orders" className="mt-5 inline-flex rounded-full bg-black px-6 py-2.5 text-sm font-bold text-white hover:bg-[#222]">
                  Track my order
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="space-y-5">
              {elig.review?.status === "pending" ? (
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Your review is awaiting approval. Saving changes keeps it in the queue.
                </p>
              ) : elig.review?.status === "hidden" ? (
                <p className="rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-700">
                  Your review is not shown publicly. You can update it and resubmit for approval.
                </p>
              ) : null}

              <div>
                <p className="text-sm font-semibold text-black">Your rating</p>
                <div className="mt-2 flex items-center gap-1" onMouseLeave={() => setHover(0)}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onMouseEnter={() => setHover(n)}
                      onClick={() => setRating(n)}
                      className="rounded-md p-0.5 transition-transform hover:scale-110"
                      aria-label={`${n} star${n > 1 ? "s" : ""}`}
                      aria-pressed={rating === n}
                    >
                      <Star size={34} className={n <= shownRating ? "fill-[#F5B301] text-[#F5B301]" : "text-[#D1D5DB]"} />
                    </button>
                  ))}
                  <span className="ml-2 text-sm font-semibold text-[#92400E]">{RATING_LABELS[shownRating] || ""}</span>
                </div>
              </div>

              <label className="block">
                <span className="text-sm font-semibold text-black">Title <span className="font-normal text-[#9CA3AF]">(optional)</span></span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value.slice(0, 120))}
                  placeholder="Sum it up in a few words"
                  className="mt-1.5 w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--bhagva)] focus:ring-2 focus:ring-[var(--bhagva-soft)]"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-black">Your review</span>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value.slice(0, REVIEW_BODY_MAX))}
                  rows={5}
                  placeholder="How was the quality, packaging and your experience after using it?"
                  className="mt-1.5 w-full resize-none rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--bhagva)] focus:ring-2 focus:ring-[var(--bhagva-soft)]"
                />
                <span className={`mt-1 block text-right text-[11px] ${bodyLen > 0 && bodyLen < REVIEW_BODY_MIN ? "text-red-600" : "text-[#9CA3AF]"}`}>
                  {bodyLen < REVIEW_BODY_MIN ? `At least ${REVIEW_BODY_MIN} characters` : `${bodyLen}/${REVIEW_BODY_MAX}`}
                </span>
              </label>

              {allowPhotos || photos.length ? (
              <div>
                <p className="text-sm font-semibold text-black">
                  {allowPhotos ? (
                    <>
                      Add photos <span className="font-normal text-[#9CA3AF]">(optional, up to {REVIEW_MAX_PHOTOS})</span>
                    </>
                  ) : (
                    "Your photos"
                  )}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {photos.map((p) => (
                    <div key={p.key} className="relative h-20 w-20 overflow-hidden rounded-xl bg-[#F3F1EC] ring-1 ring-black/5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.preview} alt="" className="h-full w-full object-cover" />
                      {p.progress !== null ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-xs font-bold text-white">
                          {p.progress}%
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPhotos((prev) => prev.filter((x) => x.key !== p.key))}
                          className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black"
                          aria-label="Remove photo"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                  {allowPhotos && photos.length < REVIEW_MAX_PHOTOS ? (
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[#E8D9C4] text-[11px] font-semibold text-[#92400E] hover:border-[var(--bhagva)] hover:bg-[var(--bhagva-soft)]"
                    >
                      <Camera size={18} />
                      Add
                    </button>
                  ) : null}
                </div>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => addFiles(e.target.files)} />
              </div>
              ) : null}

              <label className="block">
                <span className="text-sm font-semibold text-black">Display name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, 60))}
                  placeholder="e.g. Priya S."
                  className="mt-1.5 w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--bhagva)] focus:ring-2 focus:ring-[var(--bhagva-soft)]"
                />
                <span className="mt-1 block text-[11px] text-[#9CA3AF]">Shown publicly with your review.</span>
              </label>

              {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
            </div>
          )}
        </div>

        {token && elig?.eligible && !done && !loading ? (
          <div className="flex items-center gap-3 border-t border-[#F0E6D8] px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {editing ? (
              <button type="button" onClick={remove} disabled={saving} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">
                <Trash2 size={15} /> Delete
              </button>
            ) : null}
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="ml-auto inline-flex min-w-[160px] items-center justify-center gap-2 rounded-full bg-black px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-[#222] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              {uploading ? "Uploading photos…" : editing ? "Update review" : "Submit review"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
