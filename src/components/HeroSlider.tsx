"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { BRAND } from "@/lib/api";
import {
  HOME_HERO_QUALITY,
  HOME_HERO_SIZES,
} from "@/lib/home-hero-image";

export type HeroSlide = {
  id: string;
  title?: string | null;
  imageUrl?: string | null;
  mobileImageUrl?: string | null;
  linkUrl?: string | null;
};

function slideHref(url?: string | null) {
  const href = (url || "").trim();
  if (!href) return null;
  if (href.startsWith("/") || /^https?:\/\//i.test(href)) return href;
  return `/${href.replace(/^\/+/, "")}`;
}

function HeroSlideImage({
  src,
  alt,
  priority,
  eager,
  className,
}: {
  src: string;
  alt: string;
  priority?: boolean;
  /** Eager without priority preload (desktop first slide). */
  eager?: boolean;
  className?: string;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      priority={priority}
      fetchPriority={priority ? "high" : "auto"}
      loading={priority ? undefined : eager ? "eager" : "lazy"}
      sizes={HOME_HERO_SIZES}
      quality={HOME_HERO_QUALITY}
      className={className}
      draggable={false}
    />
  );
}

/**
 * Full-width banner (compact on desktop, portrait on mobile).
 * Upload: Desktop 1920×640 · Mobile 1080×1440
 */
export function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [paused, setPaused] = useState(false);
  const list = (slides || []).filter(
    (s): s is HeroSlide & { imageUrl: string } => Boolean(s?.imageUrl),
  );

  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const lockAxis = useRef<"x" | "y" | null>(null);
  /** Ignore link click after a horizontal swipe */
  const didSwipe = useRef(false);

  useEffect(() => {
    if (list.length <= 1 || paused) return;
    const t = setInterval(() => {
      changeTo((i) => (i + 1) % list.length, 1);
    }, 5500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.length, paused]);

  useEffect(() => {
    setIndex(0);
    setDir(1);
  }, [list.length]);

  function changeTo(
    nextOrFn: number | ((i: number) => number),
    direction: 1 | -1,
  ) {
    setDir(direction);
    setIndex((i) =>
      typeof nextOrFn === "function" ? nextOrFn(i) : nextOrFn,
    );
  }

  function onTouchStart(e: React.TouchEvent) {
    setPaused(true);
    const t = e.touches[0];
    if (!t) return;
    touchStart.current = { x: t.clientX, y: t.clientY };
    lockAxis.current = null;
    didSwipe.current = false;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!touchStart.current || lockAxis.current) return;
    const t = e.touches[0];
    if (!t) return;
    const dx = Math.abs(t.clientX - touchStart.current.x);
    const dy = Math.abs(t.clientY - touchStart.current.y);
    if (dx < 10 && dy < 10) return;
    lockAxis.current = dy > dx ? "y" : "x";
  }

  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current;
    const axis = lockAxis.current;
    touchStart.current = null;
    lockAxis.current = null;

    if (!start || axis === "y" || list.length <= 1) return;

    const endX = e.changedTouches[0]?.clientX ?? start.x;
    const dx = endX - start.x;
    if (Math.abs(dx) < 40) return;

    didSwipe.current = true;
    changeTo(
      (i) =>
        dx < 0
          ? (i + 1) % list.length
          : (i - 1 + list.length) % list.length,
      dx < 0 ? 1 : -1,
    );
  }

  function goTo(i: number) {
    setPaused(true);
    if (i === index) return;
    changeTo(i, i > index ? 1 : -1);
  }

  function step(stepDir: -1 | 1) {
    setPaused(true);
    changeTo(
      (i) => (i + stepDir + list.length) % list.length,
      stepDir === 1 ? 1 : -1,
    );
  }

  if (!list.length) return null;

  const enterClass =
    dir === 1 ? "hero-slide-enter-next" : "hero-slide-enter-prev";

  return (
    <section className="relative w-full overflow-hidden bg-surface">
      {/* Mobile — full width, portrait 1080×1440 (matches mobile uploads) */}
      <div
        className="relative w-full overflow-hidden touch-pan-y md:hidden"
        style={{ aspectRatio: "1080 / 1440" }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={() => {
          touchStart.current = null;
          lockAxis.current = null;
        }}
      >
        {list.map((s, i) => {
          const isActive = i === index;
          const href = slideHref(s.linkUrl);
          const shouldLoad = isActive || i === 0;
          const className = `absolute inset-0 overflow-hidden transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isActive
              ? `opacity-100 z-[1] ${enterClass}`
              : "opacity-0 z-0 pointer-events-none"
          }`;
          const inner = (
            <>
              {shouldLoad ? (
                <HeroSlideImage
                  src={s.mobileImageUrl || s.imageUrl}
                  alt={s.title || BRAND}
                  priority={i === 0}
                  className="object-cover object-center pointer-events-none select-none"
                />
              ) : (
                <div className="absolute inset-0 bg-surface" aria-hidden />
              )}
            </>
          );
          return href ? (
            <Link
              key={`m-${s.id}`}
              href={href}
              className={className}
              aria-hidden={!isActive}
              tabIndex={isActive ? 0 : -1}
              aria-label={s.title || "View product"}
              onClick={(e) => {
                if (didSwipe.current) {
                  e.preventDefault();
                  didSwipe.current = false;
                }
              }}
            >
              {inner}
            </Link>
          ) : (
            <div
              key={`m-${s.id}`}
              className={className}
              aria-hidden={!isActive}
            >
              {inner}
            </div>
          );
        })}
        <Nav count={list.length} index={index} onStep={step} onDot={goTo} compact />
      </div>

      {/* Desktop — full width, compact 1920×640 */}
      <div
        className="relative hidden w-full touch-pan-y overflow-hidden md:block"
        style={{ aspectRatio: "1920 / 640" }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {list.map((s, i) => {
          const isActive = i === index;
          const href = slideHref(s.linkUrl);
          const shouldLoad = isActive || i === 0;
          const className = `absolute inset-0 overflow-hidden transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isActive
              ? `opacity-100 z-[1] ${enterClass}`
              : "opacity-0 z-0 pointer-events-none"
          }`;
          const style = !isActive
            ? {
                transform:
                  dir === 1 ? "translateX(-2.5%)" : "translateX(2.5%)",
              }
            : undefined;
          const inner = (
            <>
              <div className="relative h-full w-full">
                {shouldLoad ? (
                  <HeroSlideImage
                    src={s.imageUrl}
                    alt={s.title || BRAND}
                    priority={false}
                    eager={i === 0}
                    className="object-cover object-center select-none"
                  />
                ) : (
                  <div className="absolute inset-0 bg-surface" aria-hidden />
                )}
              </div>
            </>
          );
          return href ? (
            <Link
              key={`d-${s.id}`}
              href={href}
              className={className}
              style={style}
              aria-hidden={!isActive}
              tabIndex={isActive ? 0 : -1}
              aria-label={s.title || "View product"}
            >
              {inner}
            </Link>
          ) : (
            <div
              key={`d-${s.id}`}
              className={className}
              style={style}
              aria-hidden={!isActive}
            >
              {inner}
            </div>
          );
        })}

        <Nav count={list.length} index={index} onStep={step} onDot={goTo} />
      </div>
    </section>
  );
}

function Nav({
  count,
  index,
  onStep,
  onDot,
  compact,
}: {
  count: number;
  index: number;
  onStep: (d: -1 | 1) => void;
  onDot: (i: number) => void;
  compact?: boolean;
}) {
  if (count <= 1) return null;
  return (
    <>
      <button
        type="button"
        aria-label="Previous slide"
        className={`absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-1.5 text-ink shadow-md hover:bg-white hover:text-brand ${
          compact ? "sm:p-2" : "p-2"
        }`}
        onClick={() => onStep(-1)}
      >
        <ChevronLeft size={compact ? 18 : 22} />
      </button>
      <button
        type="button"
        aria-label="Next slide"
        className={`absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-1.5 text-ink shadow-md hover:bg-white hover:text-brand ${
          compact ? "sm:p-2" : "p-2"
        }`}
        onClick={() => onStep(1)}
      >
        <ChevronRight size={compact ? 18 : 22} />
      </button>
      <div
        className={`absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5 ${
          compact ? "bottom-2" : ""
        }`}
      >
        {Array.from({ length: count }).map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => onDot(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === index ? "w-5 bg-brand" : "w-1.5 bg-white/80"
            }`}
          />
        ))}
      </div>
    </>
  );
}
