import type { Product } from "@/lib/api";

export type AttributeOptionValue = NonNullable<
  Product["attributeOptions"]
>[number]["values"][number];

export type ProductAttributeVariant = NonNullable<
  Product["productVariants"]
>[number];

/** Find the variant row matching all selected attribute labels. */
export function findMatchingVariant(
  product: Product,
  selected: Record<string, string>,
): ProductAttributeVariant | null {
  const variants = product.productVariants || [];
  if (!variants.length) return null;
  const keys = Object.keys(selected).filter((k) => selected[k]);
  if (!keys.length) {
    return variants.find((v) => v.isDefault) || variants[0] || null;
  }
  return (
    variants.find((v) =>
      keys.every((k) => (v.options?.[k] || "") === selected[k]),
    ) || null
  );
}

/** Default selection: default variant options, else first value per group. */
export function getDefaultAttributeSelection(
  product: Product,
): Record<string, string> {
  const out: Record<string, string> = {};
  const groups = product.attributeOptions || [];
  if (!groups.length) return out;

  const defaultVariant =
    product.productVariants?.find((v) => v.isDefault) ||
    product.productVariants?.[0];

  for (const group of groups) {
    const fromDefault = defaultVariant?.options?.[group.name];
    if (fromDefault) {
      out[group.name] = fromDefault;
      continue;
    }
    const first = group.values[0];
    if (first?.label) out[group.name] = first.label;
  }
  return out;
}

export function isAttributeValueAvailable(
  product: Product,
  groupName: string,
  valueLabel: string,
  selected: Record<string, string>,
): boolean {
  const trial = { ...selected, [groupName]: valueLabel };
  return !!findMatchingVariant(product, trial);
}

export function formatAttributeSelectionLabel(
  groups: NonNullable<Product["attributeOptions"]>,
  selected: Record<string, string>,
): string {
  return groups
    .map((g) => selected[g.name]?.trim())
    .filter(Boolean)
    .join(" / ");
}

export function isColorAttributeGroup(group: {
  name: string;
  slug?: string;
}): boolean {
  const key = `${group.slug || ""} ${group.name}`.toLowerCase();
  return /color|colour|shade/.test(key);
}

export function isSizeAttributeGroup(group: {
  name: string;
  slug?: string;
}): boolean {
  const key = `${group.slug || ""} ${group.name}`.toLowerCase();
  return /size|dimension|measure/.test(key);
}

const COLOR_LABEL_HEX: Record<string, string> = {
  black: "#111111",
  white: "#FFFFFF",
  red: "#DC2626",
  blue: "#2563EB",
  green: "#16A34A",
  gold: "#C9A227",
  golden: "#C9A227",
  yellow: "#EAB308",
  pink: "#EC4899",
  purple: "#9333EA",
  brown: "#92400E",
  grey: "#6B7280",
  gray: "#6B7280",
  silver: "#94A3B8",
  orange: "#EA580C",
};

/** Best-effort swatch color from admin label (e.g. "Black", "RED"). */
export function colorHexFromLabel(label: string): string | null {
  const key = label.trim().toLowerCase();
  if (!key) return null;
  if (COLOR_LABEL_HEX[key]) return COLOR_LABEL_HEX[key];
  for (const [name, hex] of Object.entries(COLOR_LABEL_HEX)) {
    if (key.includes(name)) return hex;
  }
  return null;
}
