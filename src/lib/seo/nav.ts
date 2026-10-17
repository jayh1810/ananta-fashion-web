import { navLinks } from "@/lib/api";
import { buildMenuTree, type ApiMenuRow, type MenuNode } from "@/lib/menu-tree";
import { SEO_API_URL, SEO_REVALIDATE } from "./constants";

export type HeaderMenuLink = MenuNode;

async function fetchMenuRows(): Promise<ApiMenuRow[]> {
  const res = await fetch(`${SEO_API_URL}/content/menus`, {
    next: { revalidate: SEO_REVALIDATE.settings },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(String(res.status));
  const data = (await res.json()) as ApiMenuRow[];
  if (!Array.isArray(data)) throw new Error("invalid menus");
  return data;
}

/** SSR header navigation — avoids Googlebot depending on blocked /api/ client calls. */
export async function fetchHeaderMenus(): Promise<HeaderMenuLink[]> {
  try {
    const header = buildMenuTree(await fetchMenuRows(), "HEADER");
    if (header.length) return header;
  } catch {
    /* fall through */
  }

  return navLinks;
}

/** SSR footer navigation managed in Admin → Content → Footer menu (empty = built-in columns). */
export async function fetchFooterMenus(): Promise<MenuNode[]> {
  try {
    return buildMenuTree(await fetchMenuRows(), "FOOTER");
  } catch {
    return [];
  }
}

export type FooterCollectionLink = { name: string; slug: string };

/** SSR footer collection links — crawlers get real taxonomy without client API calls. */
export async function fetchFooterCollections(): Promise<FooterCollectionLink[]> {
  try {
    const res = await fetch(`${SEO_API_URL}/collections`, {
      next: { revalidate: SEO_REVALIDATE.collection },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as {
      name?: string;
      slug?: string;
      isActive?: boolean;
      _count?: { products?: number };
    }[];
    if (!Array.isArray(rows)) return [];
    return rows
      .filter(
        (c) =>
          c.slug &&
          c.isActive !== false &&
          (c._count?.products ?? 1) > 0,
      )
      .slice(0, 14)
      .map((c) => ({ name: String(c.name || c.slug), slug: String(c.slug) }));
  } catch {
    return [];
  }
}
