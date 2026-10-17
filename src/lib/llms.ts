import { DEFAULT_SITE_URL, SEO_API_URL, SITE_NAME, SITE_URL } from "@/lib/seo";
import type { LlmsCatalog, LlmsCollectionSnapshot, LlmsProduct } from "@/lib/llms-render";
import {
  renderLlmsCollectionTxt,
  renderLlmsFullTxt,
  renderLlmsProductDetailTxt,
  renderLlmsProductsTxt,
  renderLlmsTxt,
} from "@/lib/llms-render";

export type {
  LlmsCatalog,
  LlmsPage,
  LlmsProduct,
  LlmsTaxonomy,
  LlmsCollectionSnapshot,
} from "@/lib/llms-render";
export {
  renderLlmsCollectionTxt,
  renderLlmsFullTxt,
  renderLlmsProductDetailTxt,
  renderLlmsProductsTxt,
  renderLlmsTxt,
};

const EMPTY: LlmsCatalog = {
  generatedAt: new Date().toISOString(),
  siteUrl: SITE_URL || DEFAULT_SITE_URL,
  brand: {
    name: SITE_NAME,
    legalEntity: "Ananta Labs",
    tagline: null,
    description: [],
    market: "India",
    phone: null,
    email: null,
    supportHours: null,
    address: null,
    instagram: null,
    facebook: null,
    shippingNote: null,
    returnsNote: null,
    payments: [],
  },
  pages: [],
  categories: [],
  collections: [],
  blogs: [],
  faqs: [],
  products: [],
  featuredProducts: [],
  productCount: 0,
};

export const LLMS_REVALIDATE_SECONDS = 300;

export async function fetchLlmsCatalog(): Promise<LlmsCatalog> {
  try {
    const res = await fetch(`${SEO_API_URL}/seo/llms`, {
      next: { revalidate: LLMS_REVALIDATE_SECONDS },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return EMPTY;
    const data = (await res.json()) as LlmsCatalog;
    if (!data || !Array.isArray(data.products)) return EMPTY;
    return {
      ...data,
      featuredProducts: Array.isArray(data.featuredProducts)
        ? data.featuredProducts
        : data.products.slice(0, 20),
    };
  } catch {
    return EMPTY;
  }
}

export async function fetchLlmsProduct(slug: string): Promise<LlmsProduct | null> {
  try {
    const res = await fetch(
      `${SEO_API_URL}/seo/llms/products/${encodeURIComponent(slug)}`,
      {
        next: { revalidate: LLMS_REVALIDATE_SECONDS },
        headers: { Accept: "application/json" },
      },
    );
    if (!res.ok) return null;
    return (await res.json()) as LlmsProduct;
  } catch {
    return null;
  }
}

export async function fetchLlmsCollection(
  slug: string,
): Promise<LlmsCollectionSnapshot | null> {
  try {
    const res = await fetch(
      `${SEO_API_URL}/seo/llms/collections/${encodeURIComponent(slug)}`,
      {
        next: { revalidate: LLMS_REVALIDATE_SECONDS },
        headers: { Accept: "application/json" },
      },
    );
    if (!res.ok) return null;
    return (await res.json()) as LlmsCollectionSnapshot;
  } catch {
    return null;
  }
}

export function llmsTextResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": `public, s-maxage=${LLMS_REVALIDATE_SECONDS}, stale-while-revalidate=86400`,
    },
  });
}
