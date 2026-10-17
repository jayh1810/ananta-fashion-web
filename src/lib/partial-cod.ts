export type PartialCodPercentTier = {
  aboveAmount: number;
  percent: number;
};

export type PartialCodConfig = {
  enabled: boolean;
  percent: number;
  minAdvanceAmount: number;
  percentTiers: PartialCodPercentTier[];
};

export const DEFAULT_PARTIAL_COD_TIERS: PartialCodPercentTier[] = [
  { aboveAmount: 1000, percent: 25 },
  { aboveAmount: 2000, percent: 20 },
  { aboveAmount: 5000, percent: 15 },
];

export const DEFAULT_PARTIAL_COD: PartialCodConfig = {
  enabled: false,
  percent: 30,
  minAdvanceAmount: 200,
  percentTiers: DEFAULT_PARTIAL_COD_TIERS,
};

export function normalizePartialCodTiers(
  raw: unknown,
  fallbackWhenMissing: PartialCodPercentTier[] | null = null,
): PartialCodPercentTier[] {
  if (!Array.isArray(raw)) {
    return fallbackWhenMissing ? [...fallbackWhenMissing] : [];
  }
  const byAbove = new Map<number, number>();
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const above = Math.round(Number((row as PartialCodPercentTier).aboveAmount));
    const pct = Math.round(Number((row as PartialCodPercentTier).percent));
    if (!Number.isFinite(above) || above < 1) continue;
    if (!Number.isFinite(pct) || pct < 1 || pct > 100) continue;
    byAbove.set(above, pct);
  }
  return [...byAbove.entries()]
    .map(([aboveAmount, percent]) => ({ aboveAmount, percent }))
    .sort((a, b) => a.aboveAmount - b.aboveAmount);
}

export function normalizePartialCodConfig(
  raw: Record<string, unknown> | null | undefined,
): PartialCodConfig {
  if (!raw || typeof raw !== "object") {
    return {
      ...DEFAULT_PARTIAL_COD,
      percentTiers: [...DEFAULT_PARTIAL_COD_TIERS],
    };
  }
  const percentRaw = Number(raw.percent);
  const percent = Number.isFinite(percentRaw)
    ? Math.min(100, Math.max(1, Math.round(percentRaw)))
    : DEFAULT_PARTIAL_COD.percent;
  const minAdvanceRaw = Number(
    raw.minAdvanceAmount ??
      (raw as { fixedAmount?: number }).fixedAmount ??
      DEFAULT_PARTIAL_COD.minAdvanceAmount,
  );
  const minAdvanceAmount = Number.isFinite(minAdvanceRaw)
    ? Math.max(0, Math.round(minAdvanceRaw))
    : DEFAULT_PARTIAL_COD.minAdvanceAmount;
  const percentTiers = Array.isArray(raw.percentTiers)
    ? normalizePartialCodTiers(raw.percentTiers)
    : [];
  return {
    enabled: raw.enabled === true,
    percent,
    minAdvanceAmount,
    percentTiers,
  };
}

export function resolvePartialCodPercent(
  orderRupees: number,
  cfg: Pick<PartialCodConfig, "percent" | "percentTiers">,
): number {
  const total = Math.max(0, Number(orderRupees) || 0);
  let percent = Math.min(100, Math.max(1, Math.round(Number(cfg.percent) || 0)));
  for (const tier of [...(cfg.percentTiers || [])].sort(
    (a, b) => a.aboveAmount - b.aboveAmount,
  )) {
    if (total >= tier.aboveAmount) {
      percent = Math.min(100, Math.max(1, Math.round(Number(tier.percent) || 0)));
    }
  }
  return percent;
}

export function resolvePartialCodAdvanceRupees(
  orderRupees: number,
  cfg: PartialCodConfig,
): { advance: number; percent: number; usedMinFloor: boolean } {
  const total = Math.max(0, Math.round(Number(orderRupees) || 0));
  const percent = resolvePartialCodPercent(total, cfg);
  const percentAdvance = Math.round((total * percent) / 100);
  const minAdvance = Math.max(0, Math.round(Number(cfg.minAdvanceAmount) || 0));
  const advance = Math.max(percentAdvance, minAdvance);
  return {
    advance,
    percent,
    usedMinFloor:
      minAdvance > 0 && advance === minAdvance && percentAdvance < minAdvance,
  };
}
