import { ApiError, api, getApiUrl } from "@/lib/api";

export type PublicReview = {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  authorName: string;
  avatarUrl: string | null;
  isVerified: boolean;
  images: string[];
  adminReply: string | null;
  adminReplyAt: string | null;
  createdAt: string;
};

export type ReviewSummary = {
  average: number;
  count: number;
  distribution: Record<"1" | "2" | "3" | "4" | "5", number>;
  withPhotos: number;
  photos: { reviewId: string; url: string; review?: PhotoReview }[];
};

/** Review details shown under a photo in the full-screen viewer. */
export type PhotoReview = Pick<
  PublicReview,
  "id" | "rating" | "title" | "body" | "authorName" | "isVerified" | "createdAt"
>;

export type ReviewPhotoSlide = { url: string; review: PhotoReview | null };

export type ReviewPage = {
  summary: ReviewSummary;
  data: PublicReview[];
  total: number;
  page: number;
  limit: number;
  pages: number;
};

export type ReviewSort = "recent" | "highest" | "lowest";

export type OwnReview = {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  authorName: string | null;
  images: string[];
  status: "published" | "pending" | "hidden";
  adminReply: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReviewEligibility = {
  eligible: boolean;
  reason: "not_purchased" | "not_delivered" | "returned" | null;
  defaultName: string;
  review: OwnReview | null;
};

export type ReviewPhoto = { url: string; sig?: string };

export const REVIEW_MAX_PHOTOS = 5;
export const REVIEW_PHOTO_MAX_MB = 8;
export const REVIEW_BODY_MIN = 10;
export const REVIEW_BODY_MAX = 3000;

export function fetchProductReviews(
  slug: string,
  opts: { page?: number; limit?: number; sort?: ReviewSort; rating?: number | null; photos?: boolean },
) {
  const q = new URLSearchParams({
    page: String(opts.page || 1),
    limit: String(opts.limit || 6),
    sort: opts.sort || "recent",
  });
  if (opts.rating) q.set("rating", String(opts.rating));
  if (opts.photos) q.set("photos", "1");
  return api<ReviewPage>(`/products/${encodeURIComponent(slug)}/reviews?${q}`);
}

export function fetchMyReview(productId: string, token: string) {
  return api<ReviewEligibility>(
    `/reviews/mine?productId=${encodeURIComponent(productId)}`,
    { token },
  );
}

export function submitReview(
  token: string,
  body: {
    productId: string;
    rating: number;
    title?: string;
    body: string;
    authorName?: string;
    images: ReviewPhoto[];
  },
) {
  return api<{ ok: true; review: OwnReview }>("/reviews", {
    method: "POST",
    token,
    body,
  });
}

export function deleteMyReview(token: string, id: string) {
  return api<{ ok: true }>(`/reviews/${encodeURIComponent(id)}`, {
    method: "DELETE",
    token,
  });
}

/** Upload one review photo with progress (0–100). Resolves to a signed photo. */
export function uploadReviewPhoto(
  file: File,
  token: string,
  onProgress?: (pct: number) => void,
): { promise: Promise<Required<ReviewPhoto>>; abort: () => void } {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<Required<ReviewPhoto>>((resolve, reject) => {
    const fd = new FormData();
    fd.append("file", file);
    xhr.open("POST", `${getApiUrl()}/reviews/uploads`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(xhr.responseText || "{}");
      } catch {
        /* non-JSON error page */
      }
      if (xhr.status >= 200 && xhr.status < 300 && typeof data.url === "string") {
        resolve({ url: data.url, sig: String(data.sig || "") });
        return;
      }
      const msg =
        xhr.status === 413
          ? `Photo is too large (max ${REVIEW_PHOTO_MAX_MB} MB)`
          : typeof data.message === "string"
            ? data.message
            : "Upload failed. Please try again.";
      reject(new ApiError(msg, xhr.status));
    };
    xhr.onerror = () => reject(new ApiError("Network error while uploading. Please retry.", 0));
    xhr.onabort = () => reject(new ApiError("Upload cancelled", 0));
    xhr.send(fd);
  });
  return { promise, abort: () => xhr.abort() };
}

/** "today", "3 days ago", "5 months ago", "2 years ago". */
export function reviewAge(iso: string, now = Date.now()) {
  const days = Math.floor((now - new Date(iso).getTime()) / 86_400_000);
  if (!Number.isFinite(days) || days < 1) return "today";
  if (days < 30) return `${days} day${days > 1 ? "s" : ""} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months > 1 ? "s" : ""} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years > 1 ? "s" : ""} ago`;
}

export function formatReviewDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export const RATING_LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];
