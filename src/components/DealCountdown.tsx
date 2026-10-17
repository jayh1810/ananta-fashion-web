"use client";

import { useEffect, useState } from "react";

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return { d, h, m, s: s % 60 };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "Ends in: 02h 42m 14s" — renders nothing before hydration or after the deal ends. */
export function DealCountdown({ endsAt }: { endsAt: string }) {
  const end = new Date(endsAt).getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (now === null || !Number.isFinite(end) || end <= now) return null;
  const { d, h, m, s } = parts(end - now);
  return (
    <p className="text-sm font-semibold text-ink tabular-nums sm:text-base" aria-live="off">
      Ends In:{" "}
      <span className="text-brand">
        {d > 0 ? `${d}d ` : ""}
        {pad(h)}h {pad(m)}m {pad(s)}s
      </span>
    </p>
  );
}
