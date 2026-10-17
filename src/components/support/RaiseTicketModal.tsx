"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  HelpCircle,
  ImagePlus,
  Loader2,
  Minus,
  PackageX,
  Plus,
  RefreshCcw,
  Repeat,
  ShieldAlert,
  Sparkles,
  Undo2,
  Video,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import {
  IMAGE_MAX_MB,
  RESOLUTION_OPTIONS,
  TICKET_CATEGORIES,
  VIDEO_MAX_MB,
  fileKind,
  uploadTicketProof,
  type TicketAttachment,
  type TicketDetail,
} from "@/lib/support-tickets";

type OrderLite = {
  id: string;
  orderNumber: string;
  phone?: string;
  email?: string;
  shippingAddress?: Record<string, string>;
  items?: { id: string; productTitle: string; variantTitle?: string; quantity: number }[];
};

type UploadTile = {
  key: string;
  name: string;
  size: number;
  kind: "video" | "image";
  preview?: string;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
  result?: TicketAttachment;
  abort?: () => void;
};

const CATEGORY_ICONS: Record<string, typeof ShieldAlert> = {
  DAMAGED: ShieldAlert,
  WRONG_ITEM: RefreshCcw,
  MISSING_ITEM: PackageX,
  QUALITY: Sparkles,
  RETURN: Undo2,
  REPLACEMENT: Repeat,
  QUERY: HelpCircle,
};

const MAX_FILES = 8;

let tileSeq = 0;
function tileKey() {
  tileSeq += 1;
  return `tile-${tileSeq}`;
}

export function RaiseTicketModal({
  order,
  token,
  deliveredAt,
  onClose,
  onCreated,
}: {
  order: OrderLite;
  token: string;
  deliveredAt?: string | null;
  onClose: () => void;
  onCreated: (ticket: TicketDetail) => void;
}) {
  const addr = order.shippingAddress || {};
  const [category, setCategory] = useState<string>("");
  const [qty, setQty] = useState<Record<string, number>>(() =>
    order.items?.length === 1 ? { [order.items[0].id]: order.items[0].quantity } : {},
  );
  const [resolution, setResolution] = useState<string>("");
  const [name, setName] = useState(addr.name || "");
  const [phone, setPhone] = useState(
    (order.phone || addr.phone || "").replace(/\D/g, "").slice(-10),
  );
  const [email, setEmail] = useState(order.email || "");
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [tiles, setTiles] = useState<UploadTile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<TicketDetail | null>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const tilesRef = useRef(tiles);
  useEffect(() => {
    tilesRef.current = tiles;
  }, [tiles]);

  const cat = TICKET_CATEGORIES.find((c) => c.id === category);
  const proofRequired = cat ? cat.proof : true;
  const isQuery = category === "QUERY";
  const uploading = tiles.some((t) => t.status === "uploading");
  const doneFiles = tiles.filter((t) => t.status === "done" && t.result);
  const hasVideo = doneFiles.some((t) => t.kind === "video");
  const hasPhoto = doneFiles.some((t) => t.kind === "image");
  const selectedItems = Object.entries(qty).filter(([, q]) => q > 0);

  const [daysSinceDelivery] = useState(() => {
    if (!deliveredAt) return null;
    const d = new Date(deliveredAt).getTime();
    return Number.isNaN(d) ? null : Math.floor((Date.now() - d) / 86_400_000);
  });

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, submitting]);

  useEffect(
    () => () => {
      for (const t of tilesRef.current) {
        t.abort?.();
        if (t.preview) URL.revokeObjectURL(t.preview);
      }
    },
    [],
  );

  function addFiles(list: FileList | null, expected?: "video" | "image") {
    if (!list?.length) return;
    setError("");
    const room = MAX_FILES - tiles.length;
    const files = Array.from(list).slice(0, Math.max(0, room));
    if (list.length > room) setError(`You can attach up to ${MAX_FILES} files.`);
    for (const file of files) {
      // Some Android galleries hand over files without a MIME type.
      const kind = fileKind(file) || (!file.type && expected ? expected : null);
      const key = tileKey();
      const limit = (kind === "video" ? VIDEO_MAX_MB : IMAGE_MAX_MB) * 1024 * 1024;
      if (!kind || file.size > limit) {
        setTiles((prev) => [
          ...prev,
          {
            key,
            name: file.name,
            size: file.size,
            kind: kind || expected || "image",
            progress: 0,
            status: "error",
            error: !kind
              ? "Unsupported file"
              : `Too large (max ${kind === "video" ? VIDEO_MAX_MB : IMAGE_MAX_MB} MB)`,
          },
        ]);
        continue;
      }
      const preview = URL.createObjectURL(file);
      const { promise, abort } = uploadTicketProof(file, token, (pct) =>
        setTiles((prev) => prev.map((t) => (t.key === key ? { ...t, progress: pct } : t))),
      );
      setTiles((prev) => [
        ...prev,
        { key, name: file.name, size: file.size, kind, preview, progress: 0, status: "uploading", abort },
      ]);
      promise
        .then((result) =>
          setTiles((prev) =>
            prev.map((t) => (t.key === key ? { ...t, status: "done", progress: 100, result, abort: undefined } : t)),
          ),
        )
        .catch((e: Error) =>
          setTiles((prev) =>
            prev.map((t) =>
              t.key === key ? { ...t, status: "error", error: e.message, abort: undefined } : t,
            ),
          ),
        );
    }
    if (videoRef.current) videoRef.current.value = "";
    if (photoRef.current) photoRef.current.value = "";
  }

  function removeTile(key: string) {
    setTiles((prev) => {
      const t = prev.find((x) => x.key === key);
      t?.abort?.();
      if (t?.preview) URL.revokeObjectURL(t.preview);
      return prev.filter((x) => x.key !== key);
    });
  }

  function validate(): string {
    if (!category) return "Choose what your ticket is about.";
    if (!isQuery && !selectedItems.length) return "Select the product(s) this is about.";
    if (uploading) return "Please wait for uploads to finish.";
    if (proofRequired && !hasVideo) return "Please add your unboxing video.";
    if (proofRequired && !hasPhoto) return "Please add at least one photo of the product.";
    if (name.trim().length < 2) return "Enter your name.";
    if (!/^[6-9]\d{9}$/.test(phone)) return "Enter a valid 10-digit mobile number.";
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Enter a valid email address.";
    if (message.trim().length < 15) return "Please describe the issue (at least 15 characters).";
    if (proofRequired && !confirm) return "Please confirm the video/photos are of this order.";
    return "";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const ticket = await api<TicketDetail>("/support-tickets", {
        method: "POST",
        token,
        body: {
          orderId: order.id,
          category,
          message: message.trim(),
          contactName: name.trim(),
          contactPhone: phone,
          contactEmail: email.trim() || undefined,
          preferredResolution: isQuery ? "INFO" : resolution || undefined,
          items: selectedItems.map(([orderItemId, quantity]) => ({ orderItemId, quantity })),
          attachments: doneFiles.map((t) => t.result),
          confirmProof: confirm,
        },
      });
      setCreated(ticket);
      onCreated(ticket);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the ticket");
    } finally {
      setSubmitting(false);
    }
  }

  const label = "block text-[13px] font-bold text-[#1C1410]";
  const input =
    "mt-1.5 w-full rounded-xl border border-[#DDD5C8] bg-white px-3.5 py-2.5 text-sm text-[#1C1410] outline-none transition placeholder:text-[#B0A494] focus:border-[#8B6B3E] focus:ring-2 focus:ring-[#E9DCC4]";

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="raise-ticket-title">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-[#1C1410]/55 backdrop-blur-[2px]" onClick={() => !submitting && onClose()} />

      <div className="relative flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-3xl bg-[#FFFDF9] shadow-2xl sm:max-w-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-[#EDE6DA] bg-white px-5 py-4 sm:px-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8A7355]">
              Order #{order.orderNumber}
            </p>
            <h2 id="raise-ticket-title" className="mt-0.5 text-lg font-extrabold text-[#1C1410] sm:text-xl">
              {created ? "Ticket raised" : "Raise a ticket"}
            </h2>
          </div>
          <button type="button" onClick={onClose} disabled={submitting} className="grid h-9 w-9 place-items-center rounded-full border border-[#E8E1D6] text-[#6B5E52] hover:bg-[#F7F3EC] disabled:opacity-50" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {created ? (
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/60">
              <CheckCircle2 size={34} />
            </span>
            <h3 className="mt-5 text-xl font-extrabold text-[#1C1410]">We&apos;ve got your request</h3>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-[#5C534A]">
              Your ticket number is{" "}
              <strong className="font-mono text-[#1C1410]">{created.ticketNumber}</strong>. Our team
              usually replies within 24–48 hours. You can track updates and reply anytime.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Link href={`/account/tickets/${created.id}`} className="rounded-full bg-[#1C1410] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#3A2D22]">
                View ticket
              </Link>
              <button type="button" onClick={onClose} className="rounded-full border border-[#D4C4B0] bg-white px-5 py-2.5 text-sm font-bold text-[#3F342C] hover:bg-[#FFFCF7]">
                Back to order
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
              {daysSinceDelivery != null && daysSinceDelivery > 7 ? (
                <div className="flex gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[13px] leading-relaxed text-amber-950">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <span>
                    This order was delivered {daysSinceDelivery} days ago. Returns and replacements are
                    usually accepted within 7 days of delivery — our team will still review your request.
                  </span>
                </div>
              ) : null}

              <section>
                <p className={label}>
                  1. What do you need help with? <span className="text-red-600">*</span>
                </p>
                <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {TICKET_CATEGORIES.map((c) => {
                    const Icon = CATEGORY_ICONS[c.id] || HelpCircle;
                    const active = category === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setCategory(c.id);
                          setError("");
                        }}
                        aria-pressed={active}
                        className={`relative rounded-2xl border p-3 text-left transition ${
                          active
                            ? "border-[#8B6B3E] bg-[#FBF4E6] shadow-[0_0_0_3px_rgba(139,107,62,0.15)]"
                            : "border-[#E8E1D6] bg-white hover:border-[#CDBB9F]"
                        }`}
                      >
                        {active ? (
                          <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-[#8B6B3E] text-white">
                            <Check size={12} strokeWidth={3} />
                          </span>
                        ) : null}
                        <Icon size={18} className={active ? "text-[#8B6B3E]" : "text-[#8A7355]"} />
                        <p className="mt-2 text-[13px] font-bold text-[#1C1410]">{c.label}</p>
                        <p className="mt-0.5 text-[11px] leading-snug text-[#7A6E62]">{c.hint}</p>
                      </button>
                    );
                  })}
                </div>
              </section>

              {order.items?.length ? (
                <section>
                  <p className={label}>
                    2. Which product?{" "}
                    {isQuery ? <span className="font-medium text-[#8A7355]">(optional)</span> : <span className="text-red-600">*</span>}
                  </p>
                  <ul className="mt-2.5 space-y-2">
                    {order.items.map((item) => {
                      const q = qty[item.id] || 0;
                      const on = q > 0;
                      return (
                        <li key={item.id} className={`flex items-center gap-3 rounded-2xl border px-3.5 py-3 transition ${on ? "border-[#8B6B3E] bg-[#FBF4E6]" : "border-[#E8E1D6] bg-white"}`}>
                          <button
                            type="button"
                            onClick={() => setQty((p) => ({ ...p, [item.id]: on ? 0 : item.quantity }))}
                            className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${on ? "border-[#8B6B3E] bg-[#8B6B3E] text-white" : "border-[#CDBB9F] bg-white"}`}
                            aria-label={on ? `Unselect ${item.productTitle}` : `Select ${item.productTitle}`}
                          >
                            {on ? <Check size={13} strokeWidth={3} /> : null}
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-[#1C1410]">{item.productTitle}</p>
                            <p className="text-[11px] text-[#8A7355]">
                              {item.variantTitle ? `${item.variantTitle} · ` : ""}Ordered {item.quantity}
                            </p>
                          </div>
                          {on && item.quantity > 1 ? (
                            <div className="flex items-center gap-1 rounded-full border border-[#DDD5C8] bg-white p-0.5">
                              <button type="button" onClick={() => setQty((p) => ({ ...p, [item.id]: Math.max(1, q - 1) }))} className="grid h-7 w-7 place-items-center rounded-full hover:bg-[#F7F3EC]" aria-label="Decrease quantity">
                                <Minus size={13} />
                              </button>
                              <span className="w-5 text-center text-sm font-bold tabular-nums">{q}</span>
                              <button type="button" onClick={() => setQty((p) => ({ ...p, [item.id]: Math.min(item.quantity, q + 1) }))} className="grid h-7 w-7 place-items-center rounded-full hover:bg-[#F7F3EC]" aria-label="Increase quantity">
                                <Plus size={13} />
                              </button>
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ) : null}

              {category && !isQuery ? (
                <section>
                  <p className={label}>3. What would you like?</p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {RESOLUTION_OPTIONS.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setResolution(resolution === r.id ? "" : r.id)}
                        className={`rounded-full border px-4 py-2 text-[13px] font-semibold transition ${
                          resolution === r.id ? "border-[#1C1410] bg-[#1C1410] text-white" : "border-[#DDD5C8] bg-white text-[#3F342C] hover:border-[#B8A688]"
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              <section>
                <p className={label}>
                  {isQuery ? "3" : "4"}. Unboxing video &amp; photos{" "}
                  {proofRequired ? <span className="text-red-600">*</span> : <span className="font-medium text-[#8A7355]">(optional)</span>}
                </p>
                {proofRequired ? (
                  <p className="mt-1 text-xs leading-relaxed text-[#6B5E52]">
                    Both are required: an <strong>unboxing video</strong> showing the sealed package being opened, and
                    at least one clear <strong>photo</strong> of the issue. You can pick them from your gallery.
                  </p>
                ) : null}

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {(["video", "image"] as const).map((kind) => {
                    const isVideo = kind === "video";
                    const list = tiles.filter((t) => t.kind === kind);
                    const ok = isVideo ? hasVideo : hasPhoto;
                    const Icon = isVideo ? Video : ImagePlus;
                    return (
                      <div
                        key={kind}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          addFiles(e.dataTransfer.files, kind);
                        }}
                        className={`rounded-2xl border p-3 transition ${
                          ok ? "border-emerald-300 bg-emerald-50/50" : "border-[#E2D6C3] bg-[#FBF8F2]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="flex items-center gap-2 text-[13px] font-bold text-[#1C1410]">
                            <span className={`grid h-8 w-8 place-items-center rounded-xl ${ok ? "bg-emerald-600 text-white" : "bg-white text-[#8B6B3E] ring-1 ring-[#E2D6C3]"}`}>
                              {ok ? <Check size={15} strokeWidth={3} /> : <Icon size={16} />}
                            </span>
                            <span>
                              {isVideo ? "Unboxing video" : "Photos"}
                              {proofRequired ? <span className="text-red-600"> *</span> : null}
                              <span className="block text-[10px] font-medium text-[#8A7355]">
                                {isVideo ? `MP4 / MOV · up to ${VIDEO_MAX_MB} MB` : `JPG / PNG / HEIC · up to ${IMAGE_MAX_MB} MB each`}
                              </span>
                            </span>
                          </p>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {list.map((t) => (
                            <div key={t.key} className={`relative h-[72px] w-[72px] overflow-hidden rounded-xl ring-1 ${t.status === "error" ? "ring-red-300" : "ring-[#E2D6C3]"}`}>
                              {t.preview ? (
                                isVideo ? (
                                  <video src={`${t.preview}#t=0.5`} muted playsInline preload="metadata" className="h-full w-full bg-[#1C1410] object-cover" />
                                ) : (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={t.preview} alt="" className="h-full w-full object-cover" />
                                )
                              ) : (
                                <span className="grid h-full w-full place-items-center bg-[#1C1410] text-white">
                                  <Video size={20} />
                                </span>
                              )}
                              {isVideo && t.status === "done" ? (
                                <span className="absolute inset-0 grid place-items-center">
                                  <span className="grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white">
                                    <Video size={13} />
                                  </span>
                                </span>
                              ) : null}
                              {t.status === "uploading" ? (
                                <span className="absolute inset-0 grid place-items-center bg-black/55 text-xs font-bold text-white">
                                  {t.progress}%
                                </span>
                              ) : null}
                              {t.status === "done" ? (
                                <span className="absolute bottom-1 left-1 grid h-4 w-4 place-items-center rounded-full bg-emerald-600 text-white">
                                  <Check size={10} strokeWidth={3} />
                                </span>
                              ) : null}
                              {t.status === "error" ? (
                                <span className="absolute inset-x-0 bottom-0 bg-red-600 px-1 py-0.5 text-center text-[9px] font-semibold leading-tight text-white" title={t.error}>
                                  Failed
                                </span>
                              ) : null}
                              <button type="button" onClick={() => removeTile(t.key)} className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white" aria-label={`Remove ${t.name}`}>
                                <X size={11} />
                              </button>
                            </div>
                          ))}
                          {tiles.length < MAX_FILES ? (
                            <button
                              type="button"
                              onClick={() => (isVideo ? videoRef : photoRef).current?.click()}
                              className="grid h-[72px] w-[72px] place-items-center rounded-xl border-2 border-dashed border-[#CDBB9F] bg-white text-[#8B6B3E] transition hover:border-[#8B6B3E] hover:bg-[#FFFCF7]"
                            >
                              <span className="flex flex-col items-center gap-1 text-[10px] font-bold">
                                <Plus size={16} /> {list.length ? "Add more" : isVideo ? "Add video" : "Add photos"}
                              </span>
                            </button>
                          ) : null}
                        </div>
                        {list.some((t) => t.status === "error") ? (
                          <p className="mt-2 text-[11px] text-red-600">
                            {list.find((t) => t.status === "error")?.error}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                <input ref={videoRef} type="file" accept="video/*" className="hidden" onChange={(e) => addFiles(e.target.files, "video")} />
                <input ref={photoRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addFiles(e.target.files, "image")} />
                <p className="mt-2 text-[11px] text-[#8A7355]">Up to {MAX_FILES} files in total{tiles.length ? ` · ${tiles.length} added` : ""}.</p>
              </section>

              <section className="grid gap-3 sm:grid-cols-2">
                <p className={`${label} sm:col-span-2`}>{isQuery ? "4" : "5"}. Your details</p>
                <label className="block text-xs font-semibold text-[#5C534A]">
                  Full name <span className="text-red-600">*</span>
                  <input className={input} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} />
                </label>
                <label className="block text-xs font-semibold text-[#5C534A]">
                  Mobile number <span className="text-red-600">*</span>
                  <input className={input} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" autoComplete="tel-national" placeholder="10-digit number" />
                </label>
                <label className="block text-xs font-semibold text-[#5C534A] sm:col-span-2">
                  Email <span className="font-medium text-[#8A7355]">(optional)</span>
                  <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={120} placeholder="you@example.com" />
                </label>
              </section>

              <section>
                <label className={label} htmlFor="ticket-message">
                  {isQuery ? "5" : "6"}. Describe the issue <span className="text-red-600">*</span>
                </label>
                <textarea
                  id="ticket-message"
                  className={`${input} min-h-[110px] resize-y`}
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, 4000))}
                  placeholder={isQuery ? "Ask us anything about your order or product…" : "What happened? e.g. the bead was cracked when I opened the sealed box…"}
                />
                <p className="mt-1 text-right text-[10px] text-[#A89880]">{message.length}/4000</p>
              </section>

              {proofRequired ? (
                <label className="flex cursor-pointer items-start gap-2.5 rounded-2xl border border-[#E8E1D6] bg-white px-3.5 py-3 text-[13px] text-[#3F342C]">
                  <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#8B6B3E]" />
                  <span>I confirm the video/photos are of this order and the product is unused, in its original packaging.</span>
                </label>
              ) : null}
            </div>

            <div className="border-t border-[#EDE6DA] bg-white px-5 py-3.5 sm:px-6">
              {error ? (
                <p role="alert" className="mb-2.5 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-700">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {error}
                </p>
              ) : null}
              <div className="flex items-center justify-between gap-3">
                <p className="hidden text-[11px] text-[#8A7355] sm:block">We reply within 24–48 hours.</p>
                <div className="flex flex-1 justify-end gap-2 sm:flex-none">
                  <button type="button" onClick={onClose} disabled={submitting} className="rounded-full border border-[#D4C4B0] bg-white px-4 py-2.5 text-sm font-bold text-[#3F342C] hover:bg-[#FFFCF7] disabled:opacity-50">
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting || uploading} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#1C1410] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#3A2D22] disabled:opacity-60 sm:flex-none">
                    {submitting || uploading ? <Loader2 size={15} className="animate-spin" /> : null}
                    {uploading ? "Uploading…" : submitting ? "Submitting…" : "Submit ticket"}
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
