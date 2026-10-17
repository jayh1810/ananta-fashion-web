"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export type CategoryFacetLink = { name: string; slug: string; active?: boolean };

export type CollectionFilterState = {
  /** Brand slugs. */
  brands: string[];
  /** PRICE_BUCKETS id. */
  price: string | null;
  /** Minimum discount percent. */
  discount: number | null;
};

/** GET /products/facets — counts over the whole listing scope. */
export type ListingFacets = {
  total: number;
  brands: { slug: string; name: string; count: number }[];
  price: { id: string; label: string; min: number; max: number | null; count: number }[];
  discount: { min: number; count: number }[];
};

export const EMPTY_FILTERS: CollectionFilterState = {
  brands: [],
  price: null,
  discount: null,
};

export const PRICE_BUCKETS = [
  { id: "0-499", label: "Under ₹500", min: 0, max: 499 },
  { id: "500-999", label: "₹500 – ₹999", min: 500, max: 999 },
  { id: "1000-1999", label: "₹1,000 – ₹1,999", min: 1000, max: 1999 },
  { id: "2000-4999", label: "₹2,000 – ₹4,999", min: 2000, max: 4999 },
  { id: "5000+", label: "₹5,000 & above", min: 5000, max: Infinity },
] as const;

export const DISCOUNT_STEPS = [10, 20, 30, 40, 50] as const;

/** Query string for GET /products (brand slugs, rupee price range, min discount). */
export function filterQuery(f: CollectionFilterState) {
  const q = new URLSearchParams();
  if (f.brands.length) q.set("brand", f.brands.join(","));
  const bucket = PRICE_BUCKETS.find((b) => b.id === f.price);
  if (bucket) {
    q.set("minPrice", String(bucket.min));
    if (Number.isFinite(bucket.max)) q.set("maxPrice", String(bucket.max));
  }
  if (f.discount) q.set("discount", String(f.discount));
  return q.toString();
}

/** Filters shared in the page URL (?brand=a,b&price=500-999&discount=20). */
export function filtersFromSearch(search: string): CollectionFilterState {
  const q = new URLSearchParams(search);
  const brands = [
    ...new Set(
      (q.get("brand") || "")
        .split(",")
        .map((b) => b.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  const price = q.get("price");
  const discount = Number(q.get("discount"));
  return {
    brands,
    price: PRICE_BUCKETS.some((b) => b.id === price) ? price : null,
    discount: (DISCOUNT_STEPS as readonly number[]).includes(discount) ? discount : null,
  };
}

export function writeFiltersToUrl(url: URL, f: CollectionFilterState) {
  if (f.brands.length) url.searchParams.set("brand", f.brands.join(","));
  else url.searchParams.delete("brand");
  if (f.price) url.searchParams.set("price", f.price);
  else url.searchParams.delete("price");
  if (f.discount) url.searchParams.set("discount", String(f.discount));
  else url.searchParams.delete("discount");
}

export function hasActiveFilters(f: CollectionFilterState) {
  return f.brands.length > 0 || Boolean(f.price) || Boolean(f.discount);
}

export function activeFilterCount(f: CollectionFilterState) {
  return f.brands.length + (f.price ? 1 : 0) + (f.discount ? 1 : 0);
}

function FacetGroup({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-line py-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-left text-[15px] font-medium text-ink"
      >
        {title}
        <ChevronDown
          size={16}
          className={`text-muted transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open ? <div className="mt-2.5 space-y-1">{children}</div> : null}
    </div>
  );
}

function OptionRow({
  type,
  checked,
  label,
  count,
  onChange,
  name,
}: {
  type: "checkbox" | "radio";
  checked: boolean;
  label: string;
  count?: number;
  onChange: () => void;
  name?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded px-1 py-1 text-[13px] text-text hover:bg-surface-alt">
      <input
        type={type}
        name={name}
        checked={checked}
        onChange={onChange}
        onClick={(e) => {
          if (type === "radio" && checked) {
            e.preventDefault();
            onChange();
          }
        }}
        className="h-4 w-4 shrink-0 accent-[var(--brand)]"
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {typeof count === "number" ? (
        <span className="text-[12px] text-subtle tabular-nums">({count})</span>
      ) : null}
    </label>
  );
}

/** Sidebar / sheet facets; counts cover the whole listing (from GET /products/facets). */
export function CollectionFilterPanel({
  facets,
  filters,
  onChange,
  categoryLinks,
  categoryHeading = "Category",
}: {
  facets: ListingFacets | null;
  filters: CollectionFilterState;
  onChange: (next: CollectionFilterState) => void;
  categoryLinks?: CategoryFacetLink[];
  categoryHeading?: string;
}) {
  const allBrands = facets?.brands ?? [];
  // A single-brand listing (e.g. a brand page) has nothing to choose between.
  const brands =
    allBrands.length > 1 || filters.brands.length
      ? allBrands.map((b) => [b.slug, b.name, b.count] as const)
      : [];
  const [showAllBrands, setShowAllBrands] = useState(false);
  const shownBrands = showAllBrands ? brands : brands.slice(0, 8);

  const priceCounts = PRICE_BUCKETS.map((b) => ({
    ...b,
    count: facets?.price.find((p) => p.id === b.id)?.count ?? 0,
  })).filter((b) => b.count > 0 || filters.price === b.id);

  const discountCounts = DISCOUNT_STEPS.map((d) => ({
    value: d,
    count: facets?.discount.find((x) => x.min === d)?.count ?? 0,
  })).filter((d) => d.count > 0 || filters.discount === d.value);

  return (
    <div>
      {categoryLinks?.length ? (
        <FacetGroup title={categoryHeading}>
          <ul className="space-y-0.5">
            {categoryLinks.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/collections/${c.slug}`}
                  className={`block rounded px-1 py-1 text-[13px] hover:bg-surface-alt hover:text-brand ${
                    c.active ? "font-semibold text-brand" : "text-text"
                  }`}
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </FacetGroup>
      ) : null}

      {brands.length > 0 ? (
        <FacetGroup title="Brand" defaultOpen={filters.brands.length > 0}>
          {shownBrands.map(([slug, name, count]) => (
            <OptionRow
              key={slug}
              type="checkbox"
              label={name}
              count={count}
              checked={filters.brands.includes(slug)}
              onChange={() =>
                onChange({
                  ...filters,
                  brands: filters.brands.includes(slug)
                    ? filters.brands.filter((b) => b !== slug)
                    : [...filters.brands, slug],
                })
              }
            />
          ))}
          {brands.length > 8 ? (
            <button
              type="button"
              onClick={() => setShowAllBrands((v) => !v)}
              className="px-1 pt-1 text-[13px] font-semibold text-brand"
            >
              {showAllBrands ? "Show less" : `+ ${brands.length - 8} more`}
            </button>
          ) : null}
        </FacetGroup>
      ) : null}

      {priceCounts.length > 0 ? (
        <FacetGroup title="Price" defaultOpen={Boolean(filters.price)}>
          {priceCounts.map((b) => (
            <OptionRow
              key={b.id}
              type="radio"
              name="price"
              label={b.label}
              count={b.count}
              checked={filters.price === b.id}
              onChange={() =>
                onChange({ ...filters, price: filters.price === b.id ? null : b.id })
              }
            />
          ))}
        </FacetGroup>
      ) : null}

      {discountCounts.length > 0 ? (
        <FacetGroup title="Discount" defaultOpen={Boolean(filters.discount)}>
          {discountCounts.map((d) => (
            <OptionRow
              key={d.value}
              type="radio"
              name="discount"
              label={`${d.value}% and above`}
              count={d.count}
              checked={filters.discount === d.value}
              onChange={() =>
                onChange({
                  ...filters,
                  discount: filters.discount === d.value ? null : d.value,
                })
              }
            />
          ))}
        </FacetGroup>
      ) : null}
    </div>
  );
}
