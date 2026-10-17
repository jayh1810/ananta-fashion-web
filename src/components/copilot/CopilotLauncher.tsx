"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import { useCart } from "@/lib/cart";
import { BrandMark } from "./BrandMark";
import { loadCopilotConfig, onCopilotLogout, type CopilotConfig } from "./copilot-client";

const loadPanel = () => import("./CopilotPanel");
const CopilotPanel = dynamic(loadPanel, { ssr: false });

/** Floating AI chat button; its label appears on hover. The chat panel JS loads only on first open. */
export function CopilotLauncher() {
  const pathname = usePathname() || "/";
  const checkoutOpen = useCart((s) => s.checkoutOpen);
  const [config, setConfig] = useState<CopilotConfig | null>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => onCopilotLogout(), []);

  useEffect(() => {
    let cancelled = false;
    // Idle so the config request never competes with LCP.
    const run = () =>
      void loadCopilotConfig().then((c) => {
        if (!cancelled) setConfig(c);
      });
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const id = w.requestIdleCallback
      ? w.requestIdleCallback(run, { timeout: 3000 })
      : window.setTimeout(run, 1500);
    return () => {
      cancelled = true;
      if (w.cancelIdleCallback) w.cancelIdleCallback(id);
      else window.clearTimeout(id);
    };
  }, []);

  const hidden =
    !config?.enabled ||
    checkoutOpen ||
    config.hideOnPaths.some((p) => p && pathname.startsWith(p));
  if (hidden) return null;

  const onProductPage = pathname.startsWith("/products/");
  const toggle = () => {
    setMounted(true);
    setOpen((o) => !o);
  };

  return (
    <>
      {mounted ? (
        <CopilotPanel config={config} open={open} onClose={() => setOpen(false)} />
      ) : null}

      {/* Bottom-right corner; WhatsApp sits bottom-left at the same height. */}
      <div
        className={`group fixed right-4 z-[46] flex items-center ${
          open ? "max-sm:hidden [@media(max-height:760px)]:hidden" : ""
        } ${
          onProductPage
            ? "bottom-[calc(8.75rem+env(safe-area-inset-bottom))] md:bottom-5"
            : "bottom-[max(1rem,env(safe-area-inset-bottom))] md:bottom-5"
        }`}
      >
        {!open ? (
          <span
            aria-hidden
            className="pointer-events-none absolute right-full mr-2.5 hidden translate-x-2 items-center gap-1.5 whitespace-nowrap rounded-full bg-[var(--footer-bg)] py-1.5 pl-3 pr-3.5 text-[12.5px] font-semibold text-white opacity-0 shadow-[0_6px_18px_rgba(12,27,84,0.28)] transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-has-[:focus-visible]:translate-x-0 group-has-[:focus-visible]:opacity-100 [@media(hover:hover)]:inline-flex"
          >
            <Sparkles className="h-3.5 w-3.5 text-[var(--bhagva)]" />
            {config.launcherLabel}
          </span>
        ) : null}
        <button
          type="button"
          onClick={toggle}
          onPointerEnter={() => void loadPanel()}
          onTouchStart={() => void loadPanel()}
          aria-label={open ? `Close ${config.botName}` : `Open ${config.botName}`}
          aria-expanded={open}
          className={`relative grid h-11 w-11 place-items-center rounded-full transition-transform hover:scale-105 active:scale-95 sm:h-14 sm:w-14 ${
            open
              ? "bg-[var(--footer-bg)] text-white shadow-[0_6px_20px_rgba(12,27,84,0.35)]"
              : "bg-[var(--bhagva)] shadow-[0_6px_20px_rgba(232,93,4,0.40)] ring-[3px] ring-white"
          }`}
        >
          {open ? (
            <X className="h-5 w-5 sm:h-6 sm:w-6" />
          ) : (
            <>
              <span className="grid h-9 w-9 place-items-center sm:hidden">
                <BrandMark size={36} />
              </span>
              <span className="hidden h-11 w-11 place-items-center sm:grid">
                <BrandMark size={44} />
              </span>
              <span className="absolute -right-0.5 -top-0.5 grid h-4 w-4 place-items-center rounded-full bg-[var(--footer-bg)] text-white ring-2 ring-white sm:h-5 sm:w-5">
                <Sparkles className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              </span>
            </>
          )}
        </button>
      </div>
    </>
  );
}
