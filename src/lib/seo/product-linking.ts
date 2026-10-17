import { cache } from "react";
import { api } from "../api";
import { SEO_REVALIDATE } from "./constants";

export type InternalLinkItem = {
  label: string;
  href: string;
  kind: string;
};

export type ProductInternalLinks = {
  categories: InternalLinkItem[];
  collections: InternalLinkItem[];
  shopByPurpose: InternalLinkItem[];
  featuredHubs: InternalLinkItem[];
  relatedProducts: InternalLinkItem[];
  similarProducts: InternalLinkItem[];
  guides: InternalLinkItem[];
};

const EMPTY_LINKS: ProductInternalLinks = {
  categories: [],
  collections: [],
  shopByPurpose: [],
  featuredHubs: [],
  relatedProducts: [],
  similarProducts: [],
  guides: [],
};

/** Request-deduped internal link graph for PDP SEO navigation. */
export const getCachedProductInternalLinks = cache(async (slug: string) => {
  try {
    const res = await api<Partial<ProductInternalLinks>>(
      `/products/${encodeURIComponent(slug)}/internal-links`,
      { method: "GET" },
    );
    return { ...EMPTY_LINKS, ...res };
  } catch {
    return EMPTY_LINKS;
  }
});

export function hasInternalLinks(links: ProductInternalLinks): boolean {
  return (
    links.categories.length > 0 ||
    links.collections.length > 0 ||
    links.shopByPurpose.length > 0 ||
    links.featuredHubs.length > 0 ||
    links.guides.length > 0
  );
}

export { SEO_REVALIDATE };
