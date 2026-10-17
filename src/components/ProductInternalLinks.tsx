import type { ReactNode } from "react";
import Link from "next/link";
import {
  Compass,
  LayoutGrid,
  Layers,
  Sparkles,
  Tag,
} from "lucide-react";
import type { InternalLinkItem, ProductInternalLinks } from "@/lib/seo/product-linking";

type LinkGroup = {
  title: string;
  items: InternalLinkItem[];
  icon: ReactNode;
};

function groupsFromLinks(links: ProductInternalLinks): LinkGroup[] {
  const groups: LinkGroup[] = [];

  if (links.categories.length) {
    groups.push({
      title: "Categories",
      items: links.categories,
      icon: <Tag size={14} aria-hidden />,
    });
  }
  if (links.collections.length) {
    groups.push({
      title: "Collections",
      items: links.collections,
      icon: <Layers size={14} aria-hidden />,
    });
  }
  if (links.shopByPurpose.length) {
    groups.push({
      title: "Shop by purpose",
      items: links.shopByPurpose,
      icon: <Sparkles size={14} aria-hidden />,
    });
  }
  if (links.featuredHubs.length) {
    groups.push({
      title: "Shop the department",
      items: links.featuredHubs,
      icon: <LayoutGrid size={14} aria-hidden />,
    });
  }

  return groups;
}

function topStripItems(links: ProductInternalLinks): InternalLinkItem[] {
  return [
    ...links.categories,
    ...links.collections,
    ...links.shopByPurpose,
    ...links.featuredHubs,
  ].filter(
    (item, index, arr) =>
      arr.findIndex((x) => x.href === item.href) === index,
  );
}

function LinkPills({ items }: { items: InternalLinkItem[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li key={item.href}>
          <Link
            href={item.href}
            className="inline-flex items-center rounded-full border border-[#E8E4DC] bg-white px-3.5 py-1.5 text-xs font-semibold text-ink shadow-sm hover:border-teal/40 hover:bg-teal/[0.04] hover:text-teal transition-all"
          >
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Server-rendered contextual internal links for product discoverability.
 * Uses only taxonomy and content relationships from the API — no hardcoded products.
 */
export function ProductInternalLinks({
  links,
  variant = "explore",
}: {
  links: ProductInternalLinks;
  /** compact = breadcrumb strip; explore = grouped hub links; guides = blog cards */
  variant?: "compact" | "explore" | "guides";
}) {
  if (variant === "compact") {
    const topItems = topStripItems(links);
    if (topItems.length) {
      return (
        <nav
          className="text-xs text-muted mb-2 flex flex-wrap gap-x-2 gap-y-1"
          aria-label="Product categories and collections"
        >
          <span className="text-ink/70">Explore:</span>
          {topItems.map((t, i) => (
            <span key={t.href}>
              {i > 0 ? <span className="mx-1">·</span> : null}
              <Link
                href={t.href}
                className="hover:text-teal underline-offset-2 hover:underline"
              >
                {t.label}
              </Link>
            </span>
          ))}
        </nav>
      );
    }
    return (
      <p className="text-xs text-muted mb-2">
        Browse more in{" "}
        <Link href="/collections/all" className="text-teal hover:underline">
          all products
        </Link>
        .
      </p>
    );
  }

  if (variant === "guides") {
    return null;
  }

  const groups = groupsFromLinks(links);
  if (!groups.length) return null;

  return (
    <section
      className="mx-auto max-w-[1400px] px-3 sm:px-5 pb-8 sm:pb-10"
      aria-label="Explore related categories"
    >
      <div className="rounded-2xl border border-[#E8E4DC] bg-[#FBF9F6] p-5 sm:p-7 shadow-[0_4px_24px_-16px_rgba(47,54,69,0.08)]">
        <div className="flex items-start gap-3 mb-5 sm:mb-6">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white border border-[#E8E4DC] text-teal shadow-sm">
            <Compass size={18} aria-hidden />
          </span>
          <div>
            <h2 className="font-heading text-lg sm:text-xl font-semibold text-ink">
              Explore related topics
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              Browse categories and collections connected to this product.
            </p>
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <div
              key={group.title}
              className="rounded-xl bg-white/80 border border-[#E8E4DC]/80 p-4"
            >
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted mb-3">
                <span className="text-teal">{group.icon}</span>
                {group.title}
              </h3>
              <LinkPills items={group.items} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
