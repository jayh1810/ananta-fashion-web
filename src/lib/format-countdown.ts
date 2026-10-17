/** Split seconds into [hours, minutes, seconds]. */
export function splitCountdownSeconds(
  totalSeconds: number,
): [number, number, number] {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60];
}

/** Customer-facing display: `2 : 52 : 25` (hours unpadded, mm/ss padded). */
export function formatCountdownDisplay(totalSeconds: number): string {
  const [h, m, sec] = splitCountdownSeconds(totalSeconds);
  return `${h} : ${String(m).padStart(2, "0")} : ${String(sec).padStart(2, "0")}`;
}

/** Zero-padded parts for circular timer components. */
export function formatCountdownParts(
  totalSeconds: number,
): [string, string, string] {
  const [h, m, sec] = splitCountdownSeconds(totalSeconds);
  return [
    String(h).padStart(2, "0"),
    String(m).padStart(2, "0"),
    String(sec).padStart(2, "0"),
  ];
}
