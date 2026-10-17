"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Headphones,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Send,
  ShieldCheck,
} from "lucide-react";
import { api, BRAND } from "@/lib/api";
import { trackContact } from "@/lib/meta-pixel";
import { BrandLogo } from "@/components/BrandLogo";
import { toast } from "@/components/Toast";

export type ContactPageProps = {
  title?: string;
  body?: string;
  email?: string;
  phone?: string;
  address?: string;
  supportHours?: string;
  whatsapp?: string;
  siteName?: string;
};

const TOPICS = [
  "Order help",
  "Product question",
  "Shipping & delivery",
  "Returns & refunds",
  "Wholesale / bulk",
  "Other",
] as const;

const STEPS = [
  {
    title: "We read every message",
    text: "A support team member reviews your note and matches it to the right order or product expert.",
  },
  {
    title: "Clear next steps",
    text: "You get a reply with tracking help, product guidance, or return instructions — usually the same day on weekdays.",
  },
  {
    title: "Stay in the loop",
    text: "For open tickets we follow up until your issue is resolved. You can also track orders anytime from your account.",
  },
];

type FormFields = {
  name: string;
  email: string;
  phone: string;
  topic: string;
  message: string;
};

type FieldErrors = Partial<Record<keyof FormFields, string>>;

const emptyForm: FormFields = {
  name: "",
  email: "",
  phone: "",
  topic: "",
  message: "",
};

function digitsOnly(value?: string | null) {
  return String(value || "").replace(/\D/g, "");
}

function normalizePhone(raw: string) {
  const digits = digitsOnly(raw);
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return "";
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateForm(values: FormFields): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.name.trim() || values.name.trim().length < 2) {
    errors.name = "Name is required (min 2 characters).";
  }
  if (!values.email.trim() || !isValidEmail(values.email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  if (!normalizePhone(values.phone)) {
    errors.phone = "Enter a valid 10-digit phone number.";
  }
  if (!values.topic.trim()) {
    errors.topic = "Please choose a topic.";
  }
  if (!values.message.trim() || values.message.trim().length < 10) {
    errors.message = "Message is required (min 10 characters).";
  }
  return errors;
}

const fieldBase =
  "mt-1.5 w-full rounded-xl border bg-[#FAF8F4] px-3.5 py-2.5 text-sm text-[#1C1410] outline-none transition placeholder:text-[#B0A090] focus:bg-white";

export function ContactPage({
  title = "Contact Us",
  body = "Our support team is available Monday to Saturday, 10AM – 7PM. Reach out via email or phone for order-related queries.",
  email = "",
  phone = "+91 12345 67890",
  address = "",
  supportHours = "Monday to Saturday, 10AM – 7PM",
  whatsapp,
  siteName = BRAND,
}: ContactPageProps) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState<FormFields>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState("");

  const waDigits = useMemo(() => {
    const fromWa = digitsOnly(whatsapp);
    if (fromWa) return fromWa;
    const fromPhone = digitsOnly(phone);
    if (fromPhone.length >= 10) {
      return fromPhone.length === 10 ? `91${fromPhone}` : fromPhone;
    }
    return "";
  }, [whatsapp, phone]);

  const phoneHref = digitsOnly(phone);

  function setField<K extends keyof FormFields>(key: K, value: FormFields[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const errors = validateForm(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      toast(
        Object.values(errors)[0] || "Please fill all required fields.",
        "error",
      );
      return;
    }

    setSending(true);
    try {
      await api("/contact/inquiries", {
        method: "POST",
        body: {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          topic: form.topic.trim(),
          message: form.message.trim(),
        },
      });
      try {
        trackContact();
      } catch {
        /* ignore */
      }
      setSent(true);
      setForm(emptyForm);
      setFieldErrors({});
      toast("Message sent successfully. Our team will reply soon.", "success");
    } catch (err: any) {
      const msg =
        err?.message ||
        err?.errors?.[0] ||
        "Could not send your message. Please try again.";
      setError(String(msg));
      toast(String(msg), "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="relative overflow-x-clip">
      {/* Atmosphere */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(ellipse_at_top,_rgba(255,122,26,0.12),_transparent_55%),linear-gradient(180deg,#fff8f1_0%,#ffffff_72%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 top-24 h-56 w-56 rounded-full bg-[radial-gradient(circle,_rgba(16,132,116,0.12),_transparent_70%)] blur-2xl"
      />

      <div className="relative mx-auto max-w-6xl px-3 pb-16 pt-8 sm:px-5 sm:pt-10">
        <nav className="mb-6 text-xs text-muted">
          <Link href="/" className="hover:text-ink">
            Home
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-ink">Contact Us</span>
        </nav>

        {/* Hero — brand logo + Outfit wordmark */}
        <header className="mb-10 max-w-3xl sm:mb-12">
          <BrandLogo
            name={siteName || BRAND}
            tagline="Fashion & Beauty"
            size="lg"
            href={null}
          />
          <h1 className="mt-4 font-sans text-xl font-bold tracking-tight text-[#3F342C] sm:text-2xl">
            {title || "Contact Us"}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#6B5E52] sm:text-[15px]">
            {body}
          </p>
        </header>

        {/* Contact channels */}
        <section className="mb-10 grid grid-cols-1 gap-3 sm:mb-12 sm:grid-cols-2 lg:grid-cols-4">
          {phone ? (
            <a
              href={`tel:${phoneHref}`}
              className="group rounded-2xl border border-[#EDE4D8] bg-white/90 p-4 shadow-[0_8px_28px_rgba(28,20,16,0.04)] transition hover:-translate-y-0.5 hover:border-[#F0C9A0] hover:shadow-[0_12px_32px_rgba(232,93,4,0.08)]"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-[var(--bhagva-deep)] transition group-hover:bg-[var(--bhagva)] group-hover:text-white">
                <Phone size={18} strokeWidth={1.75} />
              </span>
              <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8A7355]">
                Phone
              </p>
              <p className="mt-1 text-sm font-bold text-[#1C1410]">{phone}</p>
              <p className="mt-1 text-xs text-[#8A7355]">Order & delivery help</p>
            </a>
          ) : (
            <div className="rounded-2xl border border-[#EDE4D8] bg-white/90 p-4 shadow-[0_8px_28px_rgba(28,20,16,0.04)]">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-[var(--bhagva-deep)]">
                <Phone size={18} strokeWidth={1.75} />
              </span>
              <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8A7355]">
                Phone
              </p>
              <p className="mt-1 text-sm font-bold text-[#1C1410]">Call support</p>
            </div>
          )}

          {email ? (
            <a
              href={`mailto:${email}`}
              className="group rounded-2xl border border-[#EDE4D8] bg-white/90 p-4 shadow-[0_8px_28px_rgba(28,20,16,0.04)] transition hover:-translate-y-0.5 hover:border-[#F0C9A0] hover:shadow-[0_12px_32px_rgba(232,93,4,0.08)]"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-[var(--bhagva-deep)] transition group-hover:bg-[var(--bhagva)] group-hover:text-white">
                <Mail size={18} strokeWidth={1.75} />
              </span>
              <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8A7355]">
                Email
              </p>
              <p className="mt-1 break-all text-sm font-bold text-[#1C1410]">
                {email}
              </p>
              <p className="mt-1 text-xs text-[#8A7355]">We reply Mon–Sat</p>
            </a>
          ) : (
            <div className="rounded-2xl border border-[#EDE4D8] bg-white/90 p-4 shadow-[0_8px_28px_rgba(28,20,16,0.04)]">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-[var(--bhagva-deep)]">
                <Mail size={18} strokeWidth={1.75} />
              </span>
              <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8A7355]">
                Email
              </p>
              <p className="mt-1 text-sm font-bold text-[#1C1410]">Write to us</p>
            </div>
          )}

          <div className="rounded-2xl border border-[#EDE4D8] bg-white/90 p-4 shadow-[0_8px_28px_rgba(28,20,16,0.04)]">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#EEF7F5] text-[var(--teal)]">
              <Clock3 size={18} strokeWidth={1.75} />
            </span>
            <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8A7355]">
              Support hours
            </p>
            <p className="mt-1 text-sm font-bold text-[#1C1410]">
              {supportHours}
            </p>
            <p className="mt-1 text-xs text-[#8A7355]">IST · India</p>
          </div>

          <div className="rounded-2xl border border-[#EDE4D8] bg-white/90 p-4 shadow-[0_8px_28px_rgba(28,20,16,0.04)]">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#EEF7F5] text-[var(--teal)]">
              <MapPin size={18} strokeWidth={1.75} />
            </span>
            <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8A7355]">
              {address ? "Visit us" : "Shipping from"}
            </p>
            <p className="mt-1 text-sm font-bold leading-snug text-[#1C1410]">
              {address || "Pan-India delivery from our fulfilment partners"}
            </p>
          </div>
        </section>

        {/* Form + process */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-8">
          <div className="rounded-2xl border border-[#EDE4D8] bg-white p-4 shadow-[0_10px_36px_rgba(28,20,16,0.05)] sm:p-6">
            <div className="mb-5 flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#1C1410] text-white">
                <Headphones size={18} strokeWidth={1.75} />
              </span>
              <div>
                <h2 className="text-lg font-bold text-[#1C1410] sm:text-xl">
                  Get in touch
                </h2>
                <p className="mt-1 text-sm text-[#6B5E52]">
                  Tell us how we can help — orders, products, returns, or
                  wholesale.
                </p>
              </div>
            </div>

            {sent ? (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-5 text-sm text-emerald-950">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2
                    size={18}
                    className="mt-0.5 shrink-0 text-emerald-700"
                  />
                  <div>
                    <p className="font-bold">Message sent</p>
                    <p className="mt-1 text-emerald-900/80">
                      Thanks for reaching out. Our support team has received
                      your inquiry and will reply soon.
                    </p>
                    <button
                      type="button"
                      onClick={() => setSent(false)}
                      className="mt-3 text-xs font-bold text-emerald-900 underline"
                    >
                      Send another message
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <form className="space-y-3.5" onSubmit={onSubmit} noValidate>
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <label className="block text-xs font-semibold text-[#5C534A]">
                    Name *
                    <input
                      name="name"
                      value={form.name}
                      onChange={(e) => setField("name", e.target.value)}
                      autoComplete="name"
                      placeholder="Your full name"
                      className={`${fieldBase} ${fieldErrors.name ? "border-rose-400" : "border-[#E0D5C4] focus:border-[var(--bhagva)]"}`}
                    />
                    {fieldErrors.name ? (
                      <span className="mt-1 block text-[11px] font-medium text-rose-700">
                        {fieldErrors.name}
                      </span>
                    ) : null}
                  </label>
                  <label className="block text-xs font-semibold text-[#5C534A]">
                    Email *
                    <input
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setField("email", e.target.value)}
                      autoComplete="email"
                      placeholder="you@email.com"
                      className={`${fieldBase} ${fieldErrors.email ? "border-rose-400" : "border-[#E0D5C4] focus:border-[var(--bhagva)]"}`}
                    />
                    {fieldErrors.email ? (
                      <span className="mt-1 block text-[11px] font-medium text-rose-700">
                        {fieldErrors.email}
                      </span>
                    ) : null}
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <label className="block text-xs font-semibold text-[#5C534A]">
                    Phone number *
                    <input
                      name="phone"
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setField("phone", e.target.value)}
                      autoComplete="tel"
                      placeholder="+91 …"
                      className={`${fieldBase} ${fieldErrors.phone ? "border-rose-400" : "border-[#E0D5C4] focus:border-[var(--bhagva)]"}`}
                    />
                    {fieldErrors.phone ? (
                      <span className="mt-1 block text-[11px] font-medium text-rose-700">
                        {fieldErrors.phone}
                      </span>
                    ) : null}
                  </label>
                  <label className="block text-xs font-semibold text-[#5C534A]">
                    How can we help? *
                    <select
                      name="topic"
                      value={form.topic}
                      onChange={(e) => setField("topic", e.target.value)}
                      className={`${fieldBase} ${fieldErrors.topic ? "border-rose-400" : "border-[#E0D5C4] focus:border-[var(--bhagva)]"}`}
                    >
                      <option value="" disabled>
                        Choose a topic
                      </option>
                      {TOPICS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.topic ? (
                      <span className="mt-1 block text-[11px] font-medium text-rose-700">
                        {fieldErrors.topic}
                      </span>
                    ) : null}
                  </label>
                </div>

                <label className="block text-xs font-semibold text-[#5C534A]">
                  Message *
                  <textarea
                    name="message"
                    value={form.message}
                    onChange={(e) => setField("message", e.target.value)}
                    rows={5}
                    placeholder="Share your order number, product name, or question…"
                    className={`${fieldBase} resize-y ${fieldErrors.message ? "border-rose-400" : "border-[#E0D5C4] focus:border-[var(--bhagva)]"}`}
                  />
                  {fieldErrors.message ? (
                    <span className="mt-1 block text-[11px] font-medium text-rose-700">
                      {fieldErrors.message}
                    </span>
                  ) : null}
                </label>

                {error ? (
                  <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">
                    {error}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={sending}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,var(--bhagva),var(--bhagva-deep))] px-5 py-3 text-sm font-bold text-white shadow-[0_8px_20px_rgba(232,93,4,0.28)] transition hover:brightness-105 disabled:opacity-60 sm:w-auto"
                >
                  <Send size={15} strokeWidth={2.25} />
                  {sending ? "Sending…" : "Send message"}
                </button>
              </form>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-[#EDE4D8] bg-[#FAF8F4] p-5 sm:p-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8A7355]">
                What happens next
              </p>
              <h2 className="mt-1.5 text-lg font-bold text-[#1C1410]">
                After you contact us
              </h2>
              <ol className="mt-5 space-y-4">
                {STEPS.map((step, i) => (
                  <li key={step.title} className="flex gap-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#1C1410] text-[11px] font-bold text-white">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-[#1C1410]">
                        {step.title}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-[#6B5E52] sm:text-[13px]">
                        {step.text}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-2xl border border-[#EDE4D8] bg-white p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#EEF7F5] text-[var(--teal)]">
                  <ShieldCheck size={17} />
                </span>
                <div>
                  <p className="text-sm font-bold text-[#1C1410]">
                    Genuine products
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[#6B5E52] sm:text-[13px]">
                    {siteName} stocks products from trusted brands — and our
                    team is here when you need help with an order.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 sm:flex-row lg:flex-col">
              {waDigits ? (
                <a
                  href={`https://wa.me/${waDigits}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => {
                    try {
                      trackContact();
                    } catch {
                      /* ignore */
                    }
                  }}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-bold text-white hover:brightness-105"
                >
                  <MessageCircle size={16} />
                  Chat on WhatsApp
                </a>
              ) : null}
              <Link
                href="/pages/track-order"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#E0D5C4] bg-white px-4 py-3 text-sm font-bold text-[#1C1410] hover:bg-[#FAF8F4]"
              >
                Track an order
              </Link>
            </div>
          </aside>
        </section>

        {/* Bottom strip */}
        <section className="mt-10 overflow-hidden rounded-2xl bg-[#1C1410] px-5 py-7 text-center sm:mt-12 sm:px-8 sm:py-9">
          <p className="font-sans text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            Need help with an order?
          </p>
          <p className="mx-auto mt-2 max-w-lg text-sm text-white/70">
            Share your order number and we will guide you through shipping,
            delivery, or returns — quickly and clearly.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            {email ? (
              <a
                href={`mailto:${email}`}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--bhagva)] px-5 py-2.5 text-sm font-bold text-white hover:bg-[var(--bhagva-deep)]"
              >
                Email support
              </a>
            ) : null}
            {phoneHref ? (
              <a
                href={`tel:${phoneHref}`}
                className="inline-flex items-center gap-2 rounded-xl border border-white/25 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/10"
              >
                Call us
              </a>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
