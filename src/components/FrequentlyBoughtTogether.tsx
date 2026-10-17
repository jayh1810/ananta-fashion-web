"use client";

import Image from "next/image";
import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { formatINR, getApiUrl, type Product } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { isUsableImageSrc } from "@/lib/is-usable-image-src";
import { Container, PriceTag } from "@/components/ui";

/**
 * "Frequently bought together" bundle under the PDP. Suggestions come from
 * real order co-occurrence (API falls back to related products); items are
 * added with the same `addItem` the product cards use.
 */
export function FrequentlyBoughtTogether({ product }: { product: Product }) {
  const addItem = useCart((s) => s.addItem);
  const [items, setItems] = useState<Product[]>([]);
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());
  const skip = product.isFreeProduct;

  useEffect(() => {
    if (skip) return;
    let cancelled = false;
    fetch(
      `${getApiUrl()}/products/${encodeURIComponent(product.slug)}/frequently-bought-together?limit=2`,
    )
      .then((res) => (res.ok ? (res.json() as Promise<Product[]>) : []))
      .then((rows) => {
        if (!cancelled) {
          setItems(Array.isArray(rows) ? rows.filter((p) => !p.soldOut && !p.isFreeProduct) : []);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [product.slug, skip]);

  if (skip || !items.length) return null;

  const bundle = [product, ...items];
  const isPicked = (p: Product) => !p.soldOut && !unchecked.has(p.id);
  const picked = bundle.filter(isPicked);
  const total = picked.reduce((sum, p) => sum + (Number(p.price) || 0), 0);
  const mrp = picked.reduce(
    (sum, p) => sum + Math.max(Number(p.compareAt) || 0, Number(p.price) || 0),
    0,
  );

  const toggle = (id: string) =>
    setUnchecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className="py-6 sm:py-8" aria-labelledby="fbt-heading">
      <Container>
        <h2 id="fbt-heading" className="section-title mb-3 sm:mb-4">
          Frequently bought together
        </h2>
        <div className="rounded-[var(--radius-md)] border border-line bg-white p-3 sm:p-5 lg:flex lg:items-center lg:gap-8">
          <div className="scrollbar-hide -mx-1 flex items-stretch gap-1.5 overflow-x-auto px-1 pb-1 sm:gap-3">
            {bundle.map((p, i) => {
              const img = isUsableImageSrc(p.image) ? p.image : "";
              const current = p.id === product.id;
              return (
                <Fragment key={p.id}>
                  {i > 0 ? (
                    <span className="grid shrink-0 place-items-center text-subtle" aria-hidden>
                      <Plus size={18} />
                    </span>
                  ) : null}
                  <div
                    className={`relative flex w-[34vw] max-w-[170px] shrink-0 flex-col gap-1.5 rounded-[var(--radius-sm)] border p-2 transition-opacity sm:w-[160px] ${
                      isPicked(p) ? "border-line" : "border-dashed border-line-strong opacity-60"
                    }`}
                  >
                    <label className="absolute left-2 top-2 z-10 grid h-5 w-5 place-items-center rounded bg-white/90">
                      <input
                        type="checkbox"
                        checked={isPicked(p)}
                        disabled={p.soldOut}
                        onChange={() => toggle(p.id)}
                        aria-label={`Include ${p.title}`}
                        className="h-4 w-4 accent-[var(--brand)]"
                      />
                    </label>
                    <Link
                      href={`/products/${p.slug}`}
                      className="relative block aspect-square overflow-hidden rounded bg-surface-alt"
                    >
                      {img ? (
                        <Image src={img} alt={p.title} fill sizes="170px" className="object-contain" />
                      ) : null}
                    </Link>
                    <p className="line-clamp-2 text-[12px] leading-snug text-text">
                      {current ? <span className="font-semibold text-ink">This item: </span> : null}
                      {p.title}
                    </p>
                    <PriceTag price={p.price} compareAt={p.compareAt} size="sm" className="mt-auto" />
                  </div>
                </Fragment>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between gap-4 border-t border-line pt-3 lg:mt-0 lg:block lg:min-w-[220px] lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <div>
              <p className="text-[13px] text-muted">
                Total for {picked.length} item{picked.length === 1 ? "" : "s"}
              </p>
              <p className="flex items-baseline gap-2">
                <span className="text-lg font-semibold text-ink tabular-nums">
                  {formatINR(total)}
                </span>
                {mrp > total ? (
                  <span className="text-[13px] text-muted line-through">{formatINR(mrp)}</span>
                ) : null}
              </p>
            </div>
            <button
              type="button"
              disabled={!picked.length}
              onClick={() => picked.forEach((p) => addItem(p))}
              className="h-11 shrink-0 rounded-[var(--radius-sm)] bg-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-surface disabled:text-subtle lg:mt-3 lg:w-full"
            >
              Add {picked.length > 1 ? `${picked.length} items` : "to bag"}
              {picked.length > 1 ? " to bag" : ""}
            </button>
          </div>
        </div>
      </Container>
    </section>
  );
}
