import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api, BRAND, getApiUrl, type Product } from "@/lib/api";
import {
  CATALOG_CACHE_TAG,
  FREE_PRODUCTS_CACHE_TAG,
} from "@/lib/catalog-cache";
import { absoluteUrl, fetchRelatedBlogs, generateCategoryMetadata } from "@/lib/seo";
import {
  buildCategorySeoDescription,
  buildCategorySeoTitle,
} from "@/lib/seo/category-engine";
import {
  buildBreadcrumbJsonLd,
  buildCollectionJsonLd,
} from "@/lib/schema";
import { CollectionReadMore } from "@/components/CollectionReadMore";
import {
  CollectionProductGrid,
  COLLECTION_PAGE_SIZE,
} from "@/components/CollectionProductGrid";

/**
 * ISR: collection HTML is cacheable for crawlers. Admin catalog edits
 * appear within two minutes — same freshness window as product pages.
 */
export const revalidate = 120;

type ProductsResponse = {
  data: Product[];
  meta?: { total: number; page: number; limit: number; pages: number };
};

async function fetchCollectionProducts(
  basePath: string,
  page = 1,
): Promise<{
  list: Product[];
  total: number;
  page: number;
  pages: number;
  basePath: string;
}> {
  const safePage = Math.max(1, page);
  const sep = basePath.includes("?") ? "&" : "?";
  const path = `${basePath}${sep}limit=${COLLECTION_PAGE_SIZE}&page=${safePage}`;
  const res = await fetch(`${getApiUrl()}${path}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    next: {
      revalidate: 120,
      tags: [CATALOG_CACHE_TAG, FREE_PRODUCTS_CACHE_TAG],
    },
  });
  if (!res.ok) {
    const cached = await api<ProductsResponse>(path);
    const list = cached.data || [];
    const total = cached.meta?.total ?? list.length;
    const pages =
      cached.meta?.pages ??
      Math.max(1, Math.ceil(total / COLLECTION_PAGE_SIZE));
    return {
      list,
      total: Math.max(total, list.length),
      page: cached.meta?.page ?? safePage,
      pages,
      basePath,
    };
  }
  const json = (await res.json().catch(() => ({}))) as ProductsResponse;
  const list = json.data || [];
  const total = json.meta?.total ?? list.length;
  const pages =
    json.meta?.pages ?? Math.max(1, Math.ceil(total / COLLECTION_PAGE_SIZE));
  return {
    list,
    total: Math.max(total, list.length),
    page: json.meta?.page ?? safePage,
    pages,
    basePath,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const label = slug.replace(/-/g, " ");
  let title = label;
  let description = `Shop ${label} online at ${BRAND}. Top brands, genuine products and fast delivery across India.`;
  let image: string | null = null;

  try {
    if (slug === "all") {
      title = "All products";
      description = `Browse all products at ${BRAND}.`;
      const res = await fetchCollectionProducts("/products", 1);
      image = res.list.find((p) => p.image)?.image || null;
    } else {
      try {
        const col = await api<{
          name?: string;
          description?: string | null;
          imageUrl?: string | null;
          seoTitle?: string | null;
          seoDescription?: string | null;
        }>(`/collections/${slug}`);
        title = col.seoTitle || col.name || title;
        description = col.seoDescription || col.description || description;
        image = col.imageUrl || null;
      } catch {
        try {
          const cat = await api<{
            name?: string;
            description?: string | null;
            imageUrl?: string | null;
            seoTitle?: string | null;
            seoDescription?: string | null;
          }>(`/categories/${slug}`);
          title = cat.seoTitle || cat.name || title;
          description = cat.seoDescription || cat.description || description;
          image = cat.imageUrl || null;
        } catch {
          if (slug === "bestsellers") {
            title = "Bestsellers";
            description = `Top-selling products at ${BRAND}.`;
          }
        }
      }

      if (!image) {
        try {
          const productPath =
            slug === "bestsellers"
              ? "/products?bestsellers=true"
              : `/products?collection=${encodeURIComponent(slug)}`;
          const res = await fetchCollectionProducts(productPath, 1);
          image = res.list.find((p) => p.image)?.image || null;
          if (!image && slug !== "bestsellers") {
            const fallback = await fetchCollectionProducts(
              `/products?category=${encodeURIComponent(slug)}`,
              1,
            );
            image = fallback.list.find((p) => p.image)?.image || null;
          }
        } catch {
          /* keep null */
        }
      }
    }
  } catch {
    /* ignore */
  }

  return generateCategoryMetadata({
    slug,
    title: buildCategorySeoTitle({ name: title, slug }),
    description: buildCategorySeoDescription({
      name: title,
      slug,
      description: String(description),
    }),
    image,
  });
}

function CollectionJsonLd({
  slug,
  name,
  description,
  productUrls,
  parent,
}: {
  slug: string;
  name: string;
  description: string;
  productUrls: string[];
  parent?: { name: string; slug: string } | null;
}) {
  const url = absoluteUrl(`/collections/${slug}`);

  const crumbs = [
    { name: "Home", href: "/" },
    ...(parent ? [{ name: parent.name, href: `/collections/${parent.slug}` }] : []),
    { name, href: `/collections/${slug}` },
  ];

  const pageLd = buildCollectionJsonLd({
    url,
    name,
    description,
    productUrls,
  });
  const breadcrumbLd = buildBreadcrumbJsonLd(crumbs);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pageLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
    </>
  );
}

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  parentId?: string | null;
  sortOrder?: number;
  description?: string | null;
  seoDescription?: string | null;
  _count?: { products?: number };
};

/** Category facet: children of the current category, else its siblings, else top-level. */
async function categoryFacet(slug: string): Promise<{
  heading: string;
  links: { name: string; slug: string; active?: boolean }[];
  parent: { name: string; slug: string } | null;
  current: CategoryRow | null;
}> {
  let rows: CategoryRow[] = [];
  try {
    const data = await api<CategoryRow[]>("/categories");
    rows = Array.isArray(data) ? data : [];
  } catch {
    return { heading: "Category", links: [], parent: null, current: null };
  }
  const withProducts = (c: CategoryRow) => (c._count?.products ?? 1) > 0;
  const current = rows.find((c) => c.slug === slug);
  const parent = current?.parentId
    ? rows.find((c) => c.id === current.parentId) || null
    : null;
  let heading = "Category";
  let list: CategoryRow[] = [];
  if (current) {
    const children = rows.filter((c) => c.parentId === current.id && withProducts(c));
    if (children.length) {
      list = children;
      heading = current.name;
    } else if (parent) {
      list = rows.filter((c) => c.parentId === parent.id && withProducts(c));
      heading = parent.name;
    }
  }
  if (!list.length) {
    list = rows.filter((c) => !c.parentId && withProducts(c));
  }
  return {
    heading,
    links: list.slice(0, 30).map((c) => ({
      name: c.name,
      slug: c.slug,
      active: c.slug === slug,
    })),
    parent: parent ? { name: parent.name, slug: parent.slug } : null,
    current: current || null,
  };
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let title = slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  let bodyDescription = "";
  let list: Product[] = [];
  let total = 0;
  let pages = 1;
  let productBasePath = "/products";
  let collectionNamed = false;

  try {
    if (slug === "all") {
      const res = await fetchCollectionProducts("/products", 1);
      list = res.list;
      total = res.total;
      pages = res.pages;
      productBasePath = res.basePath;
      title = "All products";
    } else {
      let path = `/products?collection=${encodeURIComponent(slug)}`;
      let res = await fetchCollectionProducts(path, 1);
      if (!res.list.length && slug === "bestsellers") {
        path = "/products?bestsellers=true";
        res = await fetchCollectionProducts(path, 1);
      }
      if (!res.list.length) {
        path = `/products?category=${encodeURIComponent(slug)}`;
        res = await fetchCollectionProducts(path, 1);
      }
      list = res.list;
      total = res.total;
      pages = res.pages;
      productBasePath = path;

      try {
        const col = await api<{
          name?: string;
          description?: string | null;
          seoDescription?: string | null;
        }>(`/collections/${slug}`);
        if (col.name) {
          title = col.name;
          collectionNamed = true;
        }
        if (!bodyDescription && (col.description || col.seoDescription)) {
          bodyDescription = col.description || col.seoDescription || "";
        }
      } catch {
        /* keep slug title */
      }
    }
  } catch {
    list = [];
    total = 0;
    pages = 1;
  }

  const knownHub = slug === "all" || slug === "bestsellers";

  if (!knownHub && list.length === 0) {
    let exists = false;
    try {
      await api(`/collections/${slug}`);
      exists = true;
    } catch {
      try {
        await api(`/categories/${slug}`);
        exists = true;
      } catch {
        /* neither collection nor category */
      }
    }
    if (!exists) notFound();
  }

  const facet = await categoryFacet(slug);
  if (facet.current && !collectionNamed) {
    title = facet.current.name;
    if (!bodyDescription) {
      bodyDescription =
        facet.current.description || facet.current.seoDescription || "";
    }
  }

  const metaDescription =
    (typeof bodyDescription === "string"
      ? bodyDescription.replace(/<[^>]+>/g, " ").slice(0, 160)
      : "");

  let relatedBlogs: { title: string; slug: string; excerpt: string | null }[] =
    [];
  try {
    relatedBlogs = await fetchRelatedBlogs(title);
  } catch {
    relatedBlogs = [];
  }

  return (
    <div className="bg-[var(--page-band)]">
    <div className="mx-auto max-w-[1400px] px-3 sm:px-5 py-4 sm:py-5">
      <CollectionJsonLd
        slug={slug}
        name={title}
        description={metaDescription || title}
        parent={facet.parent}
        productUrls={list
          .slice(0, 24)
          .map((p) => absoluteUrl(`/products/${p.slug}`))}
      />
      <nav className="mb-2 text-xs text-muted lg:text-[13px]" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-brand">
          Home
        </Link>
        {facet.parent ? (
          <>
            <span className="mx-1.5">›</span>
            <Link href={`/collections/${facet.parent.slug}`} className="hover:text-brand">
              {facet.parent.name}
            </Link>
          </>
        ) : null}
        <span className="mx-1.5">›</span>
        <span className="text-ink">{title}</span>
      </nav>

      {/* Intro copy kept in DOM for crawlers — hidden with display:none */}
      {bodyDescription ? (
        <div style={{ display: "none" }} aria-hidden="true">
          <div className="mb-6 max-w-3xl">
            <CollectionReadMore html={bodyDescription} />
          </div>
        </div>
      ) : null}

      <h1 className="mb-4 text-center font-heading text-[20px] font-semibold leading-tight text-ink sm:mb-6 sm:text-[24px]">
        {title}
        {total > 0 ? (
          <span className="ml-1.5 align-middle text-[14px] font-normal text-muted sm:text-[16px]">
            ({total})
          </span>
        ) : null}
      </h1>

      <CollectionProductGrid
        cacheKey={slug}
        productBasePath={productBasePath}
        initialProducts={list}
        initialTotal={total}
        initialPages={pages}
        categoryLinks={facet.links}
        categoryHeading={facet.heading}
        emptySlot={
          <p className="text-sm text-muted py-12 text-center">
            No products in this collection yet.
          </p>
        }
      />

      {relatedBlogs.length ? (
        <div className="mt-10 max-w-3xl">
          <h2 className="text-base font-bold text-ink mb-3">Related guides</h2>
          <ul className="space-y-2">
            {relatedBlogs.map((post) => (
              <li key={post.slug}>
                <Link
                  href={`/blogs/${post.slug}`}
                  className="text-sm font-semibold text-brand hover:underline"
                >
                  {post.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
    </div>
  );
}
