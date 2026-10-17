"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Ref,
} from "react";
import { api } from "@/lib/api";

const FALLBACK = ["Top Brands", "Easy Returns", "Secure Payments"];

type MarqueeItem = { text: string; gold: boolean };

function MarqueeHalf({
  items,
  copy,
  halfRef,
}: {
  items: MarqueeItem[];
  copy: number;
  halfRef?: Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={halfRef}
      className="trust-marquee-half"
      aria-hidden={copy === 1 ? true : undefined}
    >
      {items.map((item, i) => (
        <span key={`${copy}-${i}`} className="inline-flex shrink-0 items-center">
          <span
            className={`whitespace-nowrap text-[12px] font-bold uppercase tracking-[0.08em] sm:text-[14px] ${
              item.gold
                ? "text-[var(--ticker-accent)]"
                : "text-[var(--ticker-text)]"
            }`}
          >
            {item.text}
          </span>
          <span
            className="mx-4 select-none text-[14px] font-light leading-none text-[var(--ticker-text)] opacity-70 sm:mx-6"
            aria-hidden
          >
            |
          </span>
        </span>
      ))}
    </div>
  );
}

/** Continuous auto-scroll: accent / text colour alternate, pause on hover. */
export function TrustTicker() {
  const [enabled, setEnabled] = useState(true);
  const [messages, setMessages] = useState<string[]>(FALLBACK);
  const [speedSec, setSpeedSec] = useState(28);
  const halfRef = useRef<HTMLDivElement>(null);
  const [halfWidth, setHalfWidth] = useState(0);

  useEffect(() => {
    api<{
      trustTicker?: {
        enabled?: boolean;
        messages?: string[];
        speedSec?: number;
      };
    }>("/settings")
      .then((s) => {
        const t = s.trustTicker;
        if (!t) return;
        setEnabled(t.enabled !== false);
        if (t.messages?.length) setMessages(t.messages);
        if (typeof t.speedSec === "number" && t.speedSec >= 8) {
          setSpeedSec(t.speedSec);
        }
      })
      .catch(() => {});
  }, []);

  const source = useMemo(() => {
    const base = messages.map((m) => m.trim()).filter(Boolean);
    return base.length ? base : FALLBACK;
  }, [messages]);

  /**
   * Alternate by stream position (not source index) so we never get gold|gold.
   * Keep half length even so the loop join is always white → gold.
   */
  const halfItems = useMemo(() => {
    let reps = Math.max(4, Math.ceil(8 / source.length));
    if ((source.length * reps) % 2 === 1) reps += 1;

    const texts: string[] = [];
    for (let r = 0; r < reps; r++) texts.push(...source);

    return texts.map((text, i) => ({
      text,
      gold: i % 2 === 0,
    }));
  }, [source]);

  useLayoutEffect(() => {
    const el = halfRef.current;
    if (!el) return;

    const measure = () => setHalfWidth(el.getBoundingClientRect().width);
    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [halfItems]);

  if (!enabled || !source.length) return null;

  // Do not set animationPlayState: "running" inline — it blocks CSS :hover pause
  const trackStyle = {
    animationDuration: `${speedSec}s`,
    ...(halfWidth === 0 ? { animationPlayState: "paused" as const } : {}),
    ["--marquee-distance"]: halfWidth > 0 ? `${halfWidth}px` : "50%",
  } as CSSProperties;

  return (
    <section
      className="trust-marquee relative z-[1] overflow-hidden bg-[var(--ticker-bg)] text-[var(--ticker-text)]"
      aria-label="Trust highlights"
    >
      <div className="py-3 sm:py-3.5">
        <div className="trust-marquee-track" style={trackStyle}>
          {[0, 1].map((copy) => (
            <MarqueeHalf
              key={copy}
              items={halfItems}
              copy={copy}
              halfRef={copy === 0 ? halfRef : undefined}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
