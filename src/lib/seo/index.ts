export {
  DEFAULT_SITE_URL,
  SITE_URL,
  SEO_API_URL,
  SITE_NAME,
  siteAlternateNames,
  DEFAULT_OG_IMAGE,
  ENTITY,
  SEO_REVALIDATE,
  SITEMAP_PRODUCT_PAGE_SIZE,
} from "./constants";
export {
  canonicalUrl,
  absoluteUrl,
  toAbsoluteImageUrl,
  productPath,
  collectionPath,
  articlePath,
} from "./canonical";
export { stripHtml, shortPlainText, extractFaqPairsFromHtml } from "./html";
export {
  generatePageMetadata,
  generateProductMetadata,
  generateCategoryMetadata,
  generateArticleMetadata,
  metadataForPath,
  productSeoDescription,
  resolveOgImage,
  toShareFriendlyOgUrl,
  buildPageMetadata,
  type PageMetadataInput,
} from "./metadata";
export {
  getCachedProduct,
  getCachedSeoEntry,
  getCachedFaqs,
  getCachedRelatedBlogs,
  getCachedCollection,
  getCachedCategory,
  getCachedArticle,
  type SeoEntry,
} from "./data";

import { getCachedFaqs } from "./data";
import { getCachedRelatedBlogs } from "./data";
import { getCachedSeoEntry } from "./data";

export const fetchSeoEntry = getCachedSeoEntry;
export const fetchPublicFaqs = getCachedFaqs;
export const fetchRelatedBlogs = getCachedRelatedBlogs;
export { fetchHeaderMenus, fetchFooterMenus, fetchFooterCollections, type HeaderMenuLink, type FooterCollectionLink } from "./nav";
export {
  getCachedProductInternalLinks,
  hasInternalLinks,
  type InternalLinkItem,
  type ProductInternalLinks,
} from "./product-linking";
