import { api, ApiError } from "@/lib/api";

/** GET /brands — active brands that have live products. */
export type StoreBrand = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  logoUrl?: string | null;
  isFeatured?: boolean;
  productCount: number;
  seoTitle?: string | null;
  seoDescription?: string | null;
};

export async function fetchBrands(opts: { featured?: boolean; limit?: number } = {}) {
  const q = new URLSearchParams();
  if (opts.featured) q.set("featured", "true");
  if (opts.limit) q.set("limit", String(opts.limit));
  try {
    const data = await api<StoreBrand[]>(`/brands${q.size ? `?${q}` : ""}`);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function fetchBrand(slug: string): Promise<StoreBrand | null> {
  try {
    return await api<StoreBrand>(`/brands/${encodeURIComponent(slug)}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export function brandHref(slug: string) {
  return `/brands/${slug}`;
}
