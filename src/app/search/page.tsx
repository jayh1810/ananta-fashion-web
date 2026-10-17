import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { SearchLogger } from "@/components/SearchLogger";
import { api, type Product } from "@/lib/api";
import { metadataForPath, SITE_NAME } from "@/lib/seo";

type SearchMeta = {
  total?: number;
  matchType?: "exact" | "partial" | "fuzzy" | "related";
  relatedFallback?: boolean;
  suggestions?: string[];
  query?: string;
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}): Promise<Metadata> {
  const { q = "" } = await searchParams;
  const query = q.trim();
  return metadataForPath("/search", {
    title: query ? `Search: ${query}` : "Search",
    description: query
      ? `Search results for ${query} at ${SITE_NAME}.`
      : `Search products at ${SITE_NAME}.`,
    noIndex: true,
  });
}

function resultHeadline(
  query: string,
  count: number,
  meta: SearchMeta,
): string {
  if (!query) return "Enter a search term above";
  if (meta.relatedFallback || meta.matchType === "related") {
    return count
      ? `No exact matches for “${query}” · showing ${count} similar picks`
      : `No products found for “${query}”`;
  }
  if (meta.matchType === "fuzzy") {
    return `Showing close matches for “${query}” · ${count} products`;
  }
  return `Results for “${query}” · ${count} products`;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const query = q.trim();
  let results: Product[] = [];
  let meta: SearchMeta = {};

  if (query) {
    try {
      const res = await api<{ data: Product[]; meta?: SearchMeta }>(
        `/products?q=${encodeURIComponent(query)}&limit=48`,
      );
      results = res.data || [];
      meta = res.meta || {};
    } catch {
      results = [];
    }
  }

  const isRelated =
    !!query && (meta.relatedFallback || meta.matchType === "related");
  const suggestions = (meta.suggestions || []).filter(
    (s) => s.trim().toLowerCase() !== query.toLowerCase(),
  );

  return (
    <div className="bg-[var(--page-band)]">
    <div className="mx-auto max-w-[1400px] px-3 sm:px-5 py-6 sm:py-8">
      {query ? (
        <SearchLogger
          query={query}
          resultCount={isRelated ? 0 : results.length}
        />
      ) : null}
      <h1 className="section-title mb-2">Search</h1>
      <p className="text-sm text-muted mb-4">
        {resultHeadline(query, results.length, meta)}
      </p>

      {query && suggestions.length > 0 ? (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-[#999]">
            Try
          </span>
          {suggestions.slice(0, 6).map((term) => (
            <Link
              key={term}
              href={`/search?q=${encodeURIComponent(term)}`}
              className="rounded-full border border-[#E8E8E8] bg-white px-2.5 py-1 text-[12px] font-medium text-[#444] transition-colors hover:border-[#ccc] hover:bg-[#F7F7F7]"
            >
              {term}
            </Link>
          ))}
        </div>
      ) : null}

      {results.length > 0 ? (
        <>
          {isRelated ? (
            <p className="mb-4 text-sm text-[#666]">
              Related products you may like
            </p>
          ) : null}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-5">
            {results.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </>
      ) : (
        query && (
          <div className="text-center py-12">
            <p className="text-sm text-muted mb-4">
              No products found. Try a shorter keyword like “lipstick” or
              “kurta”.
            </p>
            <Link
              href="/collections/all"
              className="text-sm font-semibold underline"
            >
              Browse all products
            </Link>
          </div>
        )
      )}

    </div>
    </div>
  );
}
