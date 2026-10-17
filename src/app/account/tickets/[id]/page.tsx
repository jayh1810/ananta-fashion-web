"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ImagePlus,
  Loader2,
  Lock,
  Paperclip,
  Send,
  Video,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { TicketMedia } from "@/components/support/TicketMedia";
import { useCustomerAuth } from "@/lib/customer-auth";
import { useHydrated } from "@/lib/useHydrated";
import {
  IMAGE_MAX_MB,
  VIDEO_MAX_MB,
  fileKind,
  ticketStatusTone,
  uploadTicketProof,
  type TicketAttachment,
  type TicketDetail,
} from "@/lib/support-tickets";

const STEPS = [
  { key: "OPEN", label: "Raised" },
  { key: "IN_PROGRESS", label: "In review" },
  { key: "RESOLVED", label: "Resolved" },
];

function stepIndex(status: string) {
  if (status === "OPEN") return 0;
  if (status === "IN_PROGRESS" || status === "WAITING_CUSTOMER") return 1;
  return 2;
}

function shortTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function MyTicketPage() {
  const params = useParams<{ id: string }>();
  const hydrated = useHydrated();
  const { token } = useCustomerAuth();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [files, setFiles] = useState<{ key: string; name: string; kind: "video" | "image"; preview?: string; progress: number; result?: TicketAttachment; error?: string }[]>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [picker, setPicker] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hydrated || !token || !params.id) return;
    let alive = true;
    api<TicketDetail>(`/support-tickets/me/${params.id}`, { token })
      .then((t) => alive && setTicket(t))
      .catch((e: Error) => alive && setError(e.message || "Ticket not found"));
    return () => {
      alive = false;
    };
  }, [hydrated, token, params.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [ticket?.messages.length]);

  function addFiles(list: FileList | null, expected?: "video" | "image") {
    if (!list || !token) return;
    for (const file of Array.from(list).slice(0, 4)) {
      const key = `${Date.now()}-${Math.random()}`;
      const kind = fileKind(file) || (!file.type && expected ? expected : null);
      const limit = (kind === "video" ? VIDEO_MAX_MB : IMAGE_MAX_MB) * 1024 * 1024;
      if (!kind || file.size > limit) {
        setFiles((p) => [...p, { key, name: file.name, kind: kind || "image", progress: 0, error: kind ? "Too large" : "Unsupported" }]);
        continue;
      }
      const preview = URL.createObjectURL(file);
      setFiles((p) => [...p, { key, name: file.name, kind, preview, progress: 0 }]);
      const { promise } = uploadTicketProof(file, token, (pct) =>
        setFiles((p) => p.map((f) => (f.key === key ? { ...f, progress: pct } : f))),
      );
      promise
        .then((result) => setFiles((p) => p.map((f) => (f.key === key ? { ...f, result, progress: 100 } : f))))
        .catch((e: Error) => setFiles((p) => p.map((f) => (f.key === key ? { ...f, error: e.message } : f))));
    }
    if (photoRef.current) photoRef.current.value = "";
    if (videoRef.current) videoRef.current.value = "";
  }

  const uploading = files.some((f) => !f.result && !f.error);
  const ready = files.filter((f) => f.result).map((f) => f.result as TicketAttachment);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !ticket) return;
    if (!reply.trim() && !ready.length) return;
    setSending(true);
    setSendError("");
    try {
      const next = await api<TicketDetail>(`/support-tickets/me/${ticket.id}/messages`, {
        method: "POST",
        token,
        body: { message: reply.trim(), attachments: ready },
      });
      setTicket(next);
      setReply("");
      files.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
      setFiles([]);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Could not send");
    } finally {
      setSending(false);
    }
  }

  if (!hydrated || (!ticket && !error)) {
    return <p className="text-sm text-[#7A6E62]">Loading ticket…</p>;
  }
  if (error || !ticket) {
    return (
      <div>
        <Link href="/account/tickets" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-[#3F342C]">
          <ArrowLeft size={16} /> Support tickets
        </Link>
        <p className="text-sm text-red-600">{error || "Ticket not found"}</p>
      </div>
    );
  }

  const idx = stepIndex(ticket.status);
  const closedBad = ticket.status === "REJECTED";

  return (
    <div>
      <Link href="/account/tickets" className="mb-5 inline-flex items-center gap-1 text-sm font-semibold text-[#6B5E52] hover:text-[#1C1410]">
        <ArrowLeft size={16} /> Support tickets
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8A7355]">
            Ticket <span className="font-mono">{ticket.ticketNumber}</span> · {ticket.categoryLabel}
          </p>
          <h2 className="mt-1 text-xl font-extrabold tracking-tight text-[#1C1410] sm:text-2xl">{ticket.subject}</h2>
          <p className="mt-1 text-sm text-[#7A6E62]">
            Order{" "}
            <Link href={`/account/orders/${ticket.order.id}`} className="font-semibold text-[#8B4513] hover:underline">
              #{ticket.order.orderNumber}
            </Link>{" "}
            · Raised {shortTime(ticket.createdAt)}
          </p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${ticketStatusTone(ticket.status)}`}>{ticket.statusLabel}</span>
      </div>

      <section className="mb-5 rounded-2xl border border-[#E8E1D6] bg-white p-4 sm:p-5">
        <ol className="flex w-full">
          {STEPS.map((s, i) => {
            const done = idx >= i;
            const label = i === 2 && closedBad ? "Rejected" : i === 2 && ticket.status === "CLOSED" ? "Closed" : s.label;
            return (
              <li key={s.key} className="relative flex min-w-0 flex-1 flex-col items-center">
                {i > 0 ? <span className={`absolute left-0 right-1/2 top-[13px] h-0.5 ${done ? (closedBad ? "bg-red-400" : "bg-emerald-500") : "bg-[#EDE8DF]"}`} /> : null}
                {i < STEPS.length - 1 ? <span className={`absolute left-1/2 right-0 top-[13px] h-0.5 ${idx > i ? (closedBad ? "bg-red-400" : "bg-emerald-500") : "bg-[#EDE8DF]"}`} /> : null}
                <span className={`relative z-[1] grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold ${done ? (closedBad && i === 2 ? "bg-red-500 text-white" : "bg-emerald-600 text-white") : "bg-[#F7F3EC] text-[#B0A090] ring-1 ring-[#E0D5C4]"}`}>
                  {done ? (closedBad && i === 2 ? <X size={13} strokeWidth={3} /> : <Check size={13} strokeWidth={3} />) : i + 1}
                </span>
                <p className={`mt-1.5 text-[11px] ${done ? "font-bold text-[#1C1410]" : "text-[#A89880]"}`}>{label}</p>
              </li>
            );
          })}
        </ol>
        {ticket.status === "WAITING_CUSTOMER" ? (
          <p className="mt-4 rounded-xl bg-orange-50 px-3 py-2 text-[13px] text-orange-900">
            Our team needs more information from you — please reply below.
          </p>
        ) : null}
      </section>

      {ticket.items?.length ? (
        <section className="mb-5 rounded-2xl border border-[#E8E1D6] bg-[#FAF8F4] p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-[#8A7355]">Products</p>
          <ul className="space-y-1 text-sm">
            {ticket.items.map((i) => (
              <li key={i.orderItemId} className="flex justify-between gap-3">
                <span className="truncate font-medium text-[#1C1410]">{i.productTitle}</span>
                <span className="shrink-0 text-[#7A6E62]">Qty {i.quantity}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-2xl border border-[#E8E1D6] bg-white">
        <div className="border-b border-[#F0EBE3] px-4 py-3 sm:px-5">
          <h3 className="text-sm font-bold text-[#1C1410]">Conversation</h3>
        </div>
        <div className="max-h-[600px] space-y-3 overflow-y-auto bg-[#F6F1E8] px-3 py-5 sm:px-5">
          {ticket.messages.map((m) => {
            if (m.authorType === "SYSTEM") {
              return (
                <div key={m.id} className="flex justify-center py-1">
                  <span className="rounded-full bg-white/80 px-3 py-1 text-center text-[11px] font-medium text-[#6B5E52] ring-1 ring-[#E8E1D6]">
                    {m.body} · {shortTime(m.createdAt)}
                  </span>
                </div>
              );
            }
            const mine = m.authorType === "CUSTOMER";
            const text = m.body && m.body !== "(attached files)" ? m.body : "";
            const media = m.attachments?.length ? m.attachments : null;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[86%] rounded-2xl shadow-[0_1px_2px_rgba(28,20,16,0.06)] sm:max-w-[72%] ${
                    mine ? "rounded-br-md border border-[#EAD7B7] bg-[#FDF0DC]" : "rounded-bl-md border border-[#E8E1D6] bg-white"
                  } ${text ? "px-3.5 py-2.5" : "p-2"}`}
                >
                  <p className={`text-[11px] font-bold ${mine ? "text-[#8A6A12]" : "text-[#8B4513]"} ${text ? "" : "px-1 pb-1.5 pt-0.5"}`}>
                    {mine ? "You" : m.authorName || "Support"}
                  </p>
                  {text ? (
                    <p className="mt-0.5 whitespace-pre-line break-words text-sm leading-relaxed text-[#1C1410]">{text}</p>
                  ) : null}
                  {media ? <TicketMedia items={media} className={text ? "mt-2.5" : ""} /> : null}
                  <p className={`mt-1.5 text-right text-[10px] text-[#A08C72] ${text ? "" : "px-1"}`}>{shortTime(m.createdAt)}</p>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        {ticket.canReply ? (
          <form onSubmit={send} className="border-t border-[#F0EBE3] p-3 sm:p-4">
            {files.length ? (
              <div className="mb-3 flex flex-wrap gap-2">
                {files.map((f) => (
                  <div key={f.key} className={`relative h-16 w-16 overflow-hidden rounded-xl ring-1 ${f.error ? "ring-red-300" : "ring-[#E8E1D6]"} bg-[#F4EFE6]`} title={f.error ? `${f.name} · ${f.error}` : f.name}>
                    {f.preview && f.kind === "video" ? (
                      <>
                        <video src={`${f.preview}#t=0.5`} muted playsInline preload="metadata" className="h-full w-full bg-[#1C1410] object-cover" />
                        <Video size={16} className="absolute inset-0 m-auto text-white drop-shadow" />
                      </>
                    ) : f.preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.preview} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="grid h-full w-full place-items-center text-[#8B6B3E]"><Video size={20} /></span>
                    )}
                    {!f.result && !f.error ? (
                      <span className="absolute inset-0 grid place-items-center bg-black/45 text-[11px] font-bold text-white">{f.progress}%</span>
                    ) : null}
                    {f.error ? (
                      <span className="absolute inset-x-0 bottom-0 bg-red-600 px-1 py-0.5 text-center text-[9px] font-bold text-white">{f.error}</span>
                    ) : null}
                    {f.result ? (
                      <span className="absolute left-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-emerald-600 text-white"><Check size={10} strokeWidth={3} /></span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        if (f.preview) URL.revokeObjectURL(f.preview);
                        setFiles((p) => p.filter((x) => x.key !== f.key));
                      }}
                      className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
                      aria-label={`Remove ${f.name}`}
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="flex items-end gap-2">
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setPicker((v) => !v)}
                  className={`grid h-11 w-11 place-items-center rounded-full border transition ${picker ? "border-[#8B6B3E] bg-[#FBF4E6] text-[#8B6B3E]" : "border-[#DDD5C8] text-[#6B5E52] hover:bg-[#F7F3EC]"}`}
                  aria-label="Attach photo or video"
                  aria-expanded={picker}
                >
                  <Paperclip size={17} />
                </button>
                {picker ? (
                  <div className="absolute bottom-full left-0 z-10 mb-2 w-44 overflow-hidden rounded-2xl border border-[#E8E1D6] bg-white p-1 shadow-xl">
                    <button type="button" onClick={() => { setPicker(false); photoRef.current?.click(); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-[#1C1410] hover:bg-[#F7F3EC]">
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#FBF4E6] text-[#8B6B3E]"><ImagePlus size={16} /></span> Photos
                    </button>
                    <button type="button" onClick={() => { setPicker(false); videoRef.current?.click(); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-[#1C1410] hover:bg-[#F7F3EC]">
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#FBF4E6] text-[#8B6B3E]"><Video size={16} /></span> Video
                    </button>
                  </div>
                ) : null}
              </div>
              <input ref={photoRef} type="file" multiple accept="image/*" className="hidden" onChange={(e) => addFiles(e.target.files, "image")} />
              <input ref={videoRef} type="file" accept="video/*" className="hidden" onChange={(e) => addFiles(e.target.files, "video")} />
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value.slice(0, 4000))}
                rows={1}
                placeholder="Write a reply…"
                className="max-h-40 min-h-[44px] flex-1 resize-y rounded-2xl border border-[#DDD5C8] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#8B6B3E] focus:ring-2 focus:ring-[#E9DCC4]"
              />
              <button type="submit" disabled={sending || uploading || (!reply.trim() && !ready.length)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#1C1410] text-white hover:bg-[#3A2D22] disabled:opacity-40" aria-label="Send reply">
                {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
              </button>
            </div>
            {sendError ? <p className="mt-2 text-[13px] text-red-600">{sendError}</p> : null}
            <p className="mt-1.5 flex items-center gap-1 text-[10px] text-[#A89880]">
              <Video size={11} /> You can attach more videos or photos.
            </p>
          </form>
        ) : (
          <p className="flex items-center justify-center gap-2 border-t border-[#F0EBE3] px-4 py-4 text-[13px] text-[#7A6E62]">
            <Lock size={14} /> This ticket is {ticket.statusLabel.toLowerCase()}. Need more help? Raise a new ticket from your order.
          </p>
        )}
      </section>
    </div>
  );
}
