"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowUp,
  ArrowUpRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  ShoppingBag,
  Star,
  ThumbsDown,
  ThumbsUp,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { discountPercent, formatINR, type Product } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { useCustomerAuth } from "@/lib/customer-auth";
import { trackProductClick } from "@/lib/analytics";
import { isUsableImageSrc } from "@/lib/is-usable-image-src";
import { BrandMark } from "./BrandMark";
import { CopilotActions, CopilotOrderCards } from "./CopilotOrders";
import { suggestionIcon } from "./suggestion-icon";
import {
  clearStoredChat,
  copilotErrorMessage,
  loadCopilotHistory,
  onCopilotLogout,
  openCustomerLogin,
  readStoredChat,
  sendCopilotFeedback,
  sendCopilotMessage,
  writeStoredChat,
  type CopilotConfig,
  type CopilotMessage,
} from "./copilot-client";
import {
  copilotSoundEnabled,
  playCopilotChime,
  setCopilotSoundEnabled,
  unlockCopilotSound,
} from "./copilot-sound";

/** Store navy (footer) — saffron comes from the admin brand colour (--bhagva). */
const NAVY = "var(--footer-bg)";

function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <strong key={i} className="font-semibold text-ink">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

/** Plain text with **bold** and "- " bullets — no HTML from the model is ever rendered. */
function MessageText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (!bullets.length) return;
    blocks.push(
      <ul key={`ul${blocks.length}`} className="my-1 space-y-1.5">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--bhagva)]" aria-hidden />
            <span>{renderInline(b)}</span>
          </li>
        ))}
      </ul>,
    );
    bullets = [];
  };
  for (const line of text.split("\n")) {
    const t = line.trim();
    const bullet = t.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (bullet) {
      bullets.push(bullet[1]);
      continue;
    }
    flush();
    if (t) blocks.push(<p key={`p${blocks.length}`}>{renderInline(t)}</p>);
  }
  flush();
  return <div className="space-y-1.5">{blocks}</div>;
}

function Stars({ rating }: { rating: number }) {
  const full = Math.round(rating);
  return (
    <span className="flex" aria-label={`${rating} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-2.5 w-2.5 text-[#E8B923] ${i < full ? "fill-[#E8B923]" : "fill-none"}`}
        />
      ))}
    </span>
  );
}

/** Same visual language as the storefront ProductCard, sized for the chat. */
function CopilotProductCard({ product, onNavigate }: { product: Product; onNavigate: () => void }) {
  const addItem = useCart((s) => s.addItem);
  const image = isUsableImageSrc(product.image) ? product.image! : "";
  const off = product.isFreeProduct ? 0 : discountPercent(product.price, product.compareAt);
  const href = `/products/${product.slug}`;
  const track = () => {
    trackProductClick({ id: product.id, slug: product.slug });
    onNavigate();
  };
  return (
    <article className="flex w-[156px] shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-[#E8E8E8] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
      <Link
        href={href}
        prefetch={false}
        onClick={track}
        className="relative m-1.5 mb-0 block aspect-square overflow-hidden rounded-lg bg-surface-alt"
      >
        {image ? (
          <Image src={image} alt={product.title} fill sizes="156px" className="object-cover" />
        ) : null}
        {product.soldOut ? (
          <span className="absolute inset-0 grid place-items-center bg-black/35 text-xs font-semibold text-white">
            Sold Out
          </span>
        ) : null}
      </Link>
      <div className="flex flex-1 flex-col gap-1 px-2.5 pb-2.5 pt-2">
        <Link
          href={href}
          prefetch={false}
          onClick={track}
          className="line-clamp-2 min-h-[2.5em] font-heading text-[12.5px] font-semibold leading-snug text-black hover:opacity-80"
        >
          {product.title}
        </Link>
        {product.reviews > 0 ? (
          <div className="flex items-center gap-1">
            <Stars rating={product.rating} />
            <span className="text-[10px] text-[#808080]">
              {product.reviews.toLocaleString("en-IN")} reviews
            </span>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-1.5">
          <span className="text-[14px] font-bold tabular-nums text-black">
            {product.isFreeProduct ? "FREE" : formatINR(product.price)}
          </span>
          {product.compareAt > product.price && !product.isFreeProduct ? (
            <span className="text-[11px] text-[#9CA3AF] line-through tabular-nums">
              {formatINR(product.compareAt)}
            </span>
          ) : null}
          {off > 0 ? <span className="text-[10px] font-bold text-[#16A34A]">{off}% OFF</span> : null}
        </div>
        <button
          type="button"
          disabled={product.soldOut}
          onClick={() => addItem(product.isFreeProduct ? { ...product, price: 0 } : product)}
          className="mt-auto inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-black px-2 py-2 text-[10.5px] font-bold uppercase tracking-wide text-white transition-colors hover:bg-[#222] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ShoppingBag className="h-3 w-3" />
          {product.soldOut ? "Sold Out" : "Add to Cart"}
        </button>
      </div>
    </article>
  );
}

function ProductCarousel({ products, onNavigate }: { products: Product[]; onNavigate: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * 168, behavior: "smooth" });
  return (
    <div className="mt-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--bhagva-deep)]">
          Recommended for you
        </p>
        {products.length > 2 ? (
          <div className="hidden gap-1 sm:flex">
            <button
              type="button"
              aria-label="Previous products"
              onClick={() => scroll(-1)}
              className="grid h-6 w-6 place-items-center rounded-full border border-[var(--cream-dark)] bg-white text-ink hover:border-[var(--bhagva)]"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="More products"
              onClick={() => scroll(1)}
              className="grid h-6 w-6 place-items-center rounded-full border border-[var(--cream-dark)] bg-white text-ink hover:border-[var(--bhagva)]"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
      </div>
      <div
        ref={ref}
        className="-mr-3.5 flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1 pr-3.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {products.map((p) => (
          <CopilotProductCard key={p.id} product={p} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
}

export default function CopilotPanel({
  config,
  open,
  onClose,
}: {
  config: CopilotConfig;
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname() || "/";
  const [stored] = useState(readStoredChat);
  const [messages, setMessages] = useState<CopilotMessage[]>(stored.messages);
  const [sessionId, setSessionId] = useState<string | undefined>(stored.sessionId);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [soundOn, setSoundOn] = useState(copilotSoundEnabled);
  const customerToken = useCustomerAuth((s) => s.token);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const hasMessages = messages.length > 0;

  useEffect(() => {
    writeStoredChat({ sessionId, messages });
  }, [sessionId, messages]);

  useEffect(
    () =>
      onCopilotLogout(() => {
        setMessages([]);
        setSessionId(undefined);
      }),
    [],
  );

  useEffect(() => {
    if (!open || hasMessages || !customerToken) return;
    let cancelled = false;
    void loadCopilotHistory().then((chat) => {
      if (cancelled || !chat) return;
      setMessages((current) => (current.length ? current : chat.messages));
      setSessionId((current) => current ?? chat.sessionId);
    });
    return () => {
      cancelled = true;
    };
  }, [open, hasMessages, customerToken]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, sending, open]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      if (window.matchMedia("(min-width: 640px)").matches) inputRef.current?.focus();
    }, 60);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // Full-screen sheet on phones: stop the page behind from scrolling.
  useEffect(() => {
    if (!open || !window.matchMedia("(max-width: 639px)").matches) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim().slice(0, 600);
      if (!message || sending) return;
      unlockCopilotSound();
      setInput("");
      setSending(true);
      setMessages((m) => [...m, { id: `local-${Date.now()}`, role: "user", content: message }]);
      try {
        const res = await sendCopilotMessage({ message, sessionId, pagePath: pathname });
        setSessionId(res.sessionId);
        setMessages((m) => [
          ...m,
          {
            id: res.message.id,
            role: "assistant",
            content: res.message.content,
            products: res.message.products,
            followUps: res.message.followUps,
            sources: res.message.sources,
            orders: res.message.orders,
            actions: res.message.actions,
            retryOnLogin: res.message.actions?.some((a) => a.type === "login") ? message : undefined,
            feedback: null,
          },
        ]);
        playCopilotChime();
      } catch (e) {
        setMessages((m) => [
          ...m,
          { id: `err-${Date.now()}`, role: "assistant", content: copilotErrorMessage(e), error: true },
        ]);
      } finally {
        setSending(false);
      }
    },
    [pathname, sending, sessionId],
  );

  // Shopper tapped "Login" on an order answer: once logged in, ask the same question again.
  const pendingLoginRetry = useRef<string | null>(null);
  useEffect(() => {
    const question = pendingLoginRetry.current;
    if (!customerToken || !question || sending) return;
    pendingLoginRetry.current = null;
    void send(question);
  }, [customerToken, sending, send]);

  const closeOnPhone = useCallback(() => {
    if (window.matchMedia("(max-width: 639px)").matches) onClose();
  }, [onClose]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  const reset = () => {
    clearStoredChat();
    setMessages([]);
    setSessionId(undefined);
    setInput("");
  };

  const rate = (id: string, value: 1 | -1) => {
    const current = messages.find((msg) => msg.id === id)?.feedback;
    const next = current === value ? null : value;
    setMessages((m) => m.map((msg) => (msg.id === id ? { ...msg, feedback: next } : msg)));
    void sendCopilotFeedback(id, next ?? 0);
  };

  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={config.botName}
      className={`fixed z-[55] flex flex-col overflow-hidden bg-[var(--cream)] max-sm:inset-0 max-sm:h-[100dvh] sm:bottom-[5.75rem] sm:right-4 sm:h-[min(640px,calc(100dvh-7.5rem))] sm:w-[400px] sm:rounded-2xl sm:border sm:border-[var(--cream-dark)] sm:shadow-[0_20px_60px_rgba(12,27,84,0.22)] [@media(min-width:640px)_and_(max-height:760px)]:bottom-4 [@media(min-width:640px)_and_(max-height:760px)]:h-[calc(100dvh-2rem)] ${
        open ? "" : "hidden"
      }`}
    >
      <header
        className="relative flex items-center gap-3 border-b-[3px] border-[var(--bhagva)] px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white"
        style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #1b2f7a 100%)` }}
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-2 ring-white/25">
          <BrandMark size={40} className="self-center!" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-[17px] font-bold leading-tight">
            {config.botName}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-white/75">
            <span className="relative flex h-2 w-2" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#4ADE80] opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#4ADE80]" />
            </span>
            {config.subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            const next = !soundOn;
            setSoundOn(next);
            setCopilotSoundEnabled(next);
            if (next) {
              unlockCopilotSound();
              playCopilotChime();
            }
          }}
          aria-label={soundOn ? "Mute reply sound" : "Turn on reply sound"}
          aria-pressed={soundOn}
          title={soundOn ? "Sound on" : "Sound off"}
          className="grid h-9 w-9 place-items-center rounded-full text-white/85 hover:bg-white/10"
        >
          {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={reset}
          aria-label="Start a new chat"
          title="New chat"
          className="grid h-9 w-9 place-items-center rounded-full text-white/85 hover:bg-white/10"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat"
          className="grid h-9 w-9 place-items-center rounded-full text-white/85 hover:bg-white/10"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-3.5 py-4 text-[14px] leading-relaxed text-[#2b2b2b]"
        aria-live="polite"
      >
        <div className="flex gap-2">
          <BrandMark size={26} className="mt-0.5" />
          <div className="max-w-[86%] rounded-2xl rounded-tl-sm border border-[var(--cream-dark)] bg-white px-3.5 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            {config.welcomeMessage}
          </div>
        </div>

        {messages.length === 0 && config.suggestions.length ? (
          <div className="pl-8">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--bhagva-deep)]">
              Popular questions
            </p>
            <div className="grid grid-cols-1 gap-1.5 min-[380px]:grid-cols-2">
              {config.suggestions.map((s) => {
                const Icon = suggestionIcon(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    className="group relative flex min-h-[52px] items-center gap-2.5 rounded-xl border border-[var(--cream-dark)] bg-white py-2 pl-2 pr-6 text-left text-[12.5px] font-medium leading-snug text-ink transition-all hover:-translate-y-px hover:border-[var(--bhagva)] hover:shadow-[0_4px_12px_rgba(12,27,84,0.08)]"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--bhagva-soft)] text-[var(--bhagva-deep)] transition-colors group-hover:bg-[var(--bhagva)] group-hover:text-white">
                      <Icon className="h-4 w-4" strokeWidth={2.2} aria-hidden />
                    </span>
                    <span className="line-clamp-2 min-w-0">{s}</span>
                    <ArrowUpRight
                      className="absolute right-2 top-2 h-3 w-3 text-[var(--bhagva-deep)] opacity-40 transition-opacity group-hover:opacity-100"
                      aria-hidden
                    />
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <div
                className="max-w-[82%] whitespace-pre-wrap break-words rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-white"
                style={{ backgroundColor: NAVY }}
              >
                {m.content}
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex gap-2">
              <BrandMark size={26} className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <div
                  className={`max-w-[94%] break-words rounded-2xl rounded-tl-sm border px-3.5 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${
                    m.error ? "border-[#F5C2C2] bg-[#FFF5F5]" : "border-[var(--cream-dark)] bg-white"
                  }`}
                >
                  <MessageText text={m.content} />
                </div>

                {m.products?.length ? <ProductCarousel products={m.products} onNavigate={closeOnPhone} /> : null}

                {m.orders?.length ? <CopilotOrderCards orders={m.orders} onNavigate={closeOnPhone} /> : null}

                {m.actions?.length && !(customerToken && m.actions.some((a) => a.type === "login")) ? (
                  <CopilotActions
                    actions={m.actions}
                    onLogin={() => {
                      pendingLoginRetry.current = m.retryOnLogin ?? null;
                      openCustomerLogin();
                    }}
                    onNavigate={closeOnPhone}
                  />
                ) : null}

                {m.sources?.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.sources.map((s) => (
                      <Link
                        key={s.url}
                        href={s.url}
                        prefetch={false}
                        onClick={closeOnPhone}
                        className="inline-flex items-center gap-1 rounded-full border border-[var(--cream-dark)] bg-white px-2.5 py-1 text-[11.5px] font-medium text-[var(--bhagva-deep)] hover:border-[var(--bhagva)]"
                      >
                        <BookOpen className="h-3 w-3" />
                        {s.title}
                      </Link>
                    ))}
                  </div>
                ) : null}

                {!m.error ? (
                  <div className="mt-1 flex items-center gap-0.5 text-[#a39a8a]">
                    <span className="mr-1 text-[10.5px]">Was this helpful?</span>
                    <button
                      type="button"
                      onClick={() => rate(m.id, 1)}
                      aria-label="Helpful"
                      aria-pressed={m.feedback === 1}
                      className={`grid h-7 w-7 place-items-center rounded-full hover:bg-white ${m.feedback === 1 ? "text-[#16A34A]" : ""}`}
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => rate(m.id, -1)}
                      aria-label="Not helpful"
                      aria-pressed={m.feedback === -1}
                      className={`grid h-7 w-7 place-items-center rounded-full hover:bg-white ${m.feedback === -1 ? "text-[#DC2626]" : ""}`}
                    >
                      <ThumbsDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : null}

                {m.id === lastAssistantId && !sending && m.followUps?.length ? (
                  <div className="mt-1 flex flex-col items-start gap-1.5">
                    {m.followUps.map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => void send(f)}
                        className="rounded-full border border-[var(--bhagva)]/50 bg-[var(--bhagva-soft)] px-3 py-1.5 text-left text-[12px] font-medium text-[var(--bhagva-deep)] hover:bg-[var(--bhagva)] hover:text-white"
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ),
        )}

        {sending ? (
          <div className="flex gap-2" role="status" aria-label="Typing">
            <BrandMark size={26} className="mt-0.5" />
            <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-[var(--cream-dark)] bg-white px-4 py-3">
              {[0, 150, 300].map((d) => (
                <span
                  key={d}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--bhagva)]"
                  style={{ animationDelay: `${d}ms` }}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <form
        onSubmit={onSubmit}
        className="border-t border-[var(--cream-dark)] bg-white px-3.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-3"
      >
        <div className="flex items-end gap-2 rounded-full border border-[#D9D2C5] bg-white py-1 pl-4 pr-1 focus-within:border-[var(--bhagva)] focus-within:shadow-[0_0_0_3px_var(--bhagva-soft)]">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, 600))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send(input);
              }
            }}
            rows={1}
            placeholder="Ask about products, orders, gifts…"
            aria-label="Message"
            className="max-h-24 min-h-[38px] flex-1 resize-none bg-transparent py-2 text-[16px] text-ink outline-none placeholder:text-[#9a9384] sm:text-[14px]"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            aria-label="Send"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--bhagva)] text-white transition-colors hover:bg-[var(--bhagva-deep)] disabled:bg-[#E5E0D6] disabled:text-[#9a9384]"
          >
            <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10.5px] text-[#9a9384]">
          AI answers can be imperfect · Not medical advice
        </p>
      </form>
    </div>
  );
}
