"use client";

import { useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";

type Props = {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  loading = false,
  onConfirm,
  onClose,
}: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, loading, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        disabled={loading}
        onClick={() => {
          if (!loading) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className="relative z-10 w-full max-w-md rounded-2xl bg-white p-5 sm:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.25)]"
      >
        <button
          type="button"
          disabled={loading}
          onClick={onClose}
          className="absolute top-3 right-3 h-8 w-8 rounded-full grid place-items-center text-[#666] hover:bg-[#f3f3f3] disabled:opacity-50"
        >
          <X size={16} />
        </button>

        <div className="flex gap-3.5">
          <div className="h-11 w-11 rounded-xl grid place-items-center shrink-0 bg-red-50 text-red-600">
            <AlertTriangle size={20} />
          </div>
          <div className="min-w-0 pr-6">
            <h3
              id="confirm-modal-title"
              className="text-base font-bold text-[#111]"
            >
              {title}
            </h3>
            {message && (
              <p className="text-sm text-[#666] mt-1.5 leading-relaxed">
                {message}
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="w-full sm:w-auto rounded-xl border border-[#ddd] px-4 py-2.5 text-sm font-semibold text-[#333] hover:bg-[#f7f7f7] disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className="w-full sm:w-auto rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {loading ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
