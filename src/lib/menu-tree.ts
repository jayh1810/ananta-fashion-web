export type MenuNode = {
  label: string;
  href: string;
  openInNewTab?: boolean;
  /** Mega-menu promo tile (top-level items). */
  imageUrl?: string;
  /** Mega-menu column for second-level headings (1-based). */
  column?: number;
  children?: MenuNode[];
};

export type ApiMenuRow = {
  id?: string;
  location: string;
  label: string;
  href: string;
  sortOrder: number;
  openInNewTab?: boolean;
  imageUrl?: string | null;
  menuColumn?: number | null;
  parentId?: string | null;
};

/** Admin menu rows → nested tree (top level → columns → links). Orphans become top-level. */
export function buildMenuTree(rows: ApiMenuRow[], location: string): MenuNode[] {
  const scoped = rows
    .filter((m) => m.location === location)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const ids = new Set(scoped.map((m) => m.id).filter(Boolean) as string[]);
  const childrenOf = new Map<string, ApiMenuRow[]>();
  for (const row of scoped) {
    if (row.parentId && ids.has(row.parentId)) {
      const list = childrenOf.get(row.parentId) || [];
      list.push(row);
      childrenOf.set(row.parentId, list);
    }
  }
  const toNode = (row: ApiMenuRow, depth: number): MenuNode => {
    const kids = row.id && depth < 2 ? childrenOf.get(row.id) || [] : [];
    return {
      label: row.label,
      href: row.href,
      ...(row.openInNewTab ? { openInNewTab: true } : {}),
      ...(row.imageUrl ? { imageUrl: row.imageUrl } : {}),
      ...(row.menuColumn ? { column: row.menuColumn } : {}),
      ...(kids.length ? { children: kids.map((k) => toNode(k, depth + 1)) } : {}),
    };
  };
  return scoped
    .filter((m) => !m.parentId || !ids.has(m.parentId))
    .map((m) => toNode(m, 0));
}
