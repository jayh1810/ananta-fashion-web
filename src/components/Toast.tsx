"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, X, XCircle } from "lucide-react";

type ToastKind = "success" | "error";

type ToastState = {
  id: number;
  kind: ToastKind;
  message: string;
} | null;

let pushToast: ((kind: ToastKind, message: string) => void) | null = null;

export function toast(message: string, kind: ToastKind = "success") {
  if (pushToast) pushToast(kind, message);
}

export function ToastHost() {
  const [item, setItem] = useState<ToastState>(null);

  useEffect(() => {
    pushToast = (kind, message) => {
      setItem({ id: Date.now(), kind, message });
    };
    return () => {
      pushToast = null;
    };
  }, []);

  useEffect(() => {
    if (!item) return;
    const t = window.setTimeout(() => setItem(null), 4200);
    return () => window.clearTimeout(t);
  }, [item]);

  if (!item) return null;

  const ok = item.kind === "success";

  return (
    <div
      role="status"
      className="fixed left-1/2 top-4 z-[80] w-[min(92vw,24rem)] -translate-x-1/2 animate-[fadeIn_0.25s_ease]"
    >
      <div
        className={`flex items-start gap-2.5 rounded-2xl border px-3.5 py-3 shadow-[0_12px_40px_rgba(28,20,16,0.16)] ${
          ok
            ? "border-emerald-100 bg-white text-emerald-950"
            : "border-rose-100 bg-white text-rose-950"
        }`}
      >
        {ok ? (
          <CheckCircle2
            size={18}
            className="mt-0.5 shrink-0 text-emerald-600"
          />
        ) : (
          <XCircle size={18} className="mt-0.5 shrink-0 text-rose-600" />
        )}
        <p className="flex-1 text-sm font-semibold leading-snug">{item.message}</p>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => setItem(null)}
          className="shrink-0 rounded-lg p-1 text-[#8A7355] hover:bg-[#F7F3EC]"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
