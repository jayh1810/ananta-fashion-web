"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Download, Play, X } from "lucide-react";
import { mediaUrl } from "@/lib/api";
import type { TicketAttachment } from "@/lib/support-tickets";

function Thumb({ item }: { item: TicketAttachment }) {
  const src = mediaUrl(item.url);
  if (item.kind === "video") {
    return (
      <>
        <video src={`${src}#t=0.5`} preload="metadata" muted playsInline className="h-full w-full bg-[#2A211B] object-cover" />
        <span className="absolute inset-0 grid place-items-center bg-black/20">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-white/95 text-[#1C1410] shadow-md">
            <Play size={14} className="ml-0.5" fill="currentColor" />
          </span>
        </span>
      </>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={item.name} loading="lazy" className="h-full w-full object-cover" />;
}

function Viewer({
  items,
  start,
  onClose,
}: {
  items: TicketAttachment[];
  start: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(start);
  const item = items[index];
  const src = mediaUrl(item.url);
  const many = items.length > 1;
  const go = useCallback(
    (step: number) => setIndex((i) => (i + step + items.length) % items.length),
    [items.length],
  );

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && many) go(1);
      if (e.key === "ArrowLeft" && many) go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, go, many]);

  return createPortal(
    <div className="fixed inset-0 z-[130] flex flex-col bg-[#0F0B08]/95" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-white" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-semibold">
          {item.kind === "video" ? "Video" : "Photo"}
          {many ? <span className="ml-1.5 text-white/60">{index + 1} / {items.length}</span> : null}
        </p>
        <div className="flex items-center gap-1.5">
          <a href={src} download target="_blank" rel="noopener noreferrer" className="grid h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Download">
            <Download size={16} />
          </a>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Close">
            <X size={19} />
          </button>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-3 pb-4 sm:px-16">
        {item.kind === "video" ? (
          <video key={src} src={src} controls autoPlay playsInline className="max-h-full max-w-full rounded-xl bg-black" onClick={(e) => e.stopPropagation()} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={src} src={src} alt={item.name} className="max-h-full max-w-full rounded-xl object-contain" onClick={(e) => e.stopPropagation()} />
        )}
        {many ? (
          <>
            <button type="button" onClick={(e) => { e.stopPropagation(); go(-1); }} className="absolute left-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/25 sm:left-4" aria-label="Previous">
              <ChevronLeft size={22} />
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); go(1); }} className="absolute right-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/25 sm:right-4" aria-label="Next">
              <ChevronRight size={22} />
            </button>
          </>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

/** Small square thumbnails; tap opens a full-screen viewer. */
export function TicketMedia({
  items,
  tone = "light",
  className = "",
}: {
  items?: TicketAttachment[] | null;
  tone?: "light" | "dark";
  className?: string;
}) {
  const [open, setOpen] = useState<number | null>(null);
  if (!items?.length) return null;
  const ordered = [...items.filter((a) => a.kind === "video"), ...items.filter((a) => a.kind !== "video")];
  return (
    <>
      <div className={`flex flex-wrap gap-1.5 ${className}`}>
        {ordered.map((a, i) => (
          <button
            key={a.url}
            type="button"
            onClick={() => setOpen(i)}
            aria-label={`Open ${a.kind === "video" ? "video" : "photo"}`}
            className={`relative h-[76px] w-[76px] shrink-0 overflow-hidden rounded-xl transition sm:h-[88px] sm:w-[88px] ${
              tone === "dark" ? "ring-1 ring-white/15 hover:ring-white/50" : "ring-1 ring-[#E8E1D6] hover:ring-[#B8A688]"
            }`}
          >
            <Thumb item={a} />
          </button>
        ))}
      </div>
      {open != null ? <Viewer items={ordered} start={open} onClose={() => setOpen(null)} /> : null}
    </>
  );
}
