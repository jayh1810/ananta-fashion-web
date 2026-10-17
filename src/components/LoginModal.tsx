"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, ShieldCheck, Sparkles, Star, X } from "lucide-react";
import { api, ApiError, BRAND } from "@/lib/api";
import { useCustomerAuth } from "@/lib/customer-auth";
import { useCart } from "@/lib/cart";
import { trackLead } from "@/lib/meta-pixel";
import { SiteLogoImage } from "@/components/SiteLogoImage";
import {
  trackLoginFailed,
  trackLoginOtpSent,
  trackLoginSuccess,
} from "@/lib/analytics";

const OTP_LIMIT_HINT =
  "You have reached the maximum OTP request limit. Please try again after 30 minutes.";

function ErrorBanner({ message }: { message: string }) {
  const isOtpLimit =
    /OTP request limit|try again after 30 minutes/i.test(message) ||
    message === OTP_LIMIT_HINT;
  return (
    <div
      role="alert"
      className={`rounded-xl px-3.5 py-3 text-sm font-medium leading-snug ${
        isOtpLimit
          ? "border border-amber-200 bg-amber-50 text-amber-950"
          : "border border-red-200 bg-red-50 text-red-700"
      }`}
    >
      {message}
    </div>
  );
}

const BENEFITS = [
  {
    title: "Genuine products",
    body: "Shop top fashion and beauty brands with confidence.",
  },
  {
    title: "Exclusive member discounts",
    body: "Login to track orders, save your wishlist and checkout faster.",
  },
];

type Props = {
  /** When true, render as centered page card (no overlay). */
  embedded?: boolean;
  /** Override redirect after login when embedded on /account/login */
  nextPath?: string;
};

type Step = "phone" | "otp";

export function LoginModal({ embedded = false, nextPath }: Props) {
  const router = useRouter();
  const {
    token,
    loginOpen,
    loginNext,
    closeLogin,
    sendOtp,
    verifyOtp,
  } = useCustomerAuth();
  const openCheckout = useCart((s) => s.openCheckout);

  const OTP_LEN = 6;
  const emptyOtpDigits = () => Array.from({ length: OTP_LEN }, () => "");

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [digits, setDigits] = useState<string[]>(emptyOtpDigits);
  const [notify, setNotify] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [brandName, setBrandName] = useState(BRAND);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [staticOtp, setStaticOtp] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // OTP login works on report-link pages so wallet / account stay available.
  const open = embedded || loginOpen;
  const otpValue = digits.join("");
  const phoneValid = /^[6-9]\d{9}$/.test(phone);
  const otpReady = otpValue.length === OTP_LEN;

  useEffect(() => {
    api<{
      siteName?: string;
      logoUrl?: string | null;
      otp?: { staticEnabled?: boolean };
    }>("/settings")
      .then((s) => {
        if (s.siteName) setBrandName(s.siteName);
        if (s.logoUrl) setLogoUrl(s.logoUrl);
        if (typeof s.otp?.staticEnabled === "boolean") {
          setStaticOtp(s.otp.staticEnabled);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    if (token && !embedded) {
      finishAfterLogin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, token]);

  useEffect(() => {
    if (!open) {
      setStep("phone");
      setDigits(emptyOtpDigits());
      setError("");
      setResendIn(0);
      return;
    }
    if (embedded) return;
    const html = document.documentElement;
    const body = document.body;
    // Another overlay (e.g. CartDrawer) already froze the page — leave its lock alone.
    if (body.style.position === "fixed") return;

    const scrollY = window.scrollY;
    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
      bodyPaddingRight: body.style.paddingRight,
    };
    // The page scrollbar lives on <html>, so body overflow alone doesn't stop background scroll.
    const scrollbarGap = Math.max(0, window.innerWidth - html.clientWidth);
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    if (scrollbarGap > 0) body.style.paddingRight = `${scrollbarGap}px`;

    return () => {
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      body.style.position = prev.bodyPosition;
      body.style.top = prev.bodyTop;
      body.style.left = prev.bodyLeft;
      body.style.right = prev.bodyRight;
      body.style.width = prev.bodyWidth;
      body.style.paddingRight = prev.bodyPaddingRight;
      window.scrollTo({ top: scrollY, left: 0, behavior: "instant" });
    };
  }, [open, embedded]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const finishAfterLogin = useCallback(() => {
    const next = nextPath || loginNext || "/";
    closeLogin();
    // Stay on current page (e.g. report checkout → resume payment after OTP)
    if (next === "__stay__") {
      return;
    }
    if (next === "checkout") {
      openCheckout();
      return;
    }
    if (embedded || next.startsWith("/")) {
      router.push(next.startsWith("/") ? next : `/${next}`);
    }
  }, [nextPath, loginNext, closeLogin, openCheckout, router, embedded]);

  async function handleSend(e?: FormEvent) {
    e?.preventDefault();
    if (!phoneValid) {
      setError("Enter a valid 10-digit mobile number");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await sendOtp(phone);
      if (typeof res?.staticMode === "boolean") {
        setStaticOtp(Boolean(res.staticMode));
      }
      try {
        trackLoginOtpSent({
          phone,
          source: loginNext === "checkout" ? "checkout" : "login",
        });
      } catch {
        /* analytics must never break login */
      }
      setStep("otp");
      setDigits(emptyOtpDigits());
      setResendIn(30);
      requestAnimationFrame(() => inputRefs.current[0]?.focus());
    } catch (err: any) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err?.message || "Failed to send OTP";
      setError(msg);
      try {
        trackLoginFailed({
          phone,
          reason: msg,
          source: loginNext === "checkout" ? "checkout" : "login",
        });
      } catch {
        /* ignore */
      }
      // Stay on / return to phone step so the limit message is obvious
      setStep("phone");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e?: FormEvent) {
    e?.preventDefault();
    if (!otpReady) return;
    setLoading(true);
    setError("");
    try {
      const user = await verifyOtp(phone, otpValue);
      try {
        trackLoginSuccess({
          phone,
          userId: user?.id,
          source: loginNext === "checkout" ? "checkout" : "login",
        });
      } catch {
        /* ignore */
      }
      try { trackLead(); } catch {}
      finishAfterLogin();
    } catch (err: any) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err?.message || "Invalid OTP";
      setError(msg);
      try {
        trackLoginFailed({
          phone,
          reason: msg,
          source: loginNext === "checkout" ? "checkout" : "login",
        });
      } catch {
        /* ignore */
      }
      setDigits(emptyOtpDigits());
      requestAnimationFrame(() => inputRefs.current[0]?.focus());
    } finally {
      setLoading(false);
    }
  }

  function onDigitChange(index: number, raw: string) {
    const v = raw.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = v;
    setDigits(next);
    if (v && index < OTP_LEN - 1) inputRefs.current[index + 1]?.focus();
  }

  function onDigitKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function onDigitPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const text = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, OTP_LEN);
    if (!text) return;
    const next = emptyOtpDigits();
    text.split("").forEach((c, i) => {
      next[i] = c;
    });
    setDigits(next);
    inputRefs.current[Math.min(text.length, OTP_LEN - 1)]?.focus();
  }

  if (!open) return null;

  const panel = (
    <div
      className={`relative w-full max-w-[860px] overflow-hidden rounded-2xl bg-white shadow-[0_25px_80px_rgba(0,0,0,0.35)] grid md:grid-cols-[1.05fr_1fr] ${
        embedded ? "mx-auto" : ""
      }`}
    >
      <div className="relative hidden md:flex flex-col bg-gradient-to-br from-brand to-brand-hover text-white p-7 lg:p-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(ellipse at 20% 0%, rgba(255,255,255,0.28), transparent 55%), radial-gradient(ellipse at 90% 100%, rgba(255,255,255,0.14), transparent 45%)",
          }}
        />
        <div className="relative flex items-center gap-2.5 mb-8">
          {logoUrl ? (
            <SiteLogoImage
              src={logoUrl}
              size={36}
              className="h-9 w-9 rounded-full object-cover ring-2 ring-white/60"
            />
          ) : (
            <span className="h-9 w-9 rounded-full bg-white text-brand grid place-items-center font-bold text-sm">
              AF
            </span>
          )}
          <span className="font-semibold text-lg tracking-tight">
            {brandName}
          </span>
        </div>

        <h2 className="relative text-[26px] lg:text-[30px] font-bold leading-tight mb-6">
          Login Now &amp; avail best offers!
        </h2>

        <div className="relative space-y-3 mt-auto">
          {BENEFITS.map((b) => (
            <div
              key={b.title}
              className="rounded-xl bg-white/10 border border-white/20 backdrop-blur-sm px-3.5 py-3 flex gap-3"
            >
              <span className="mt-0.5 h-8 w-8 shrink-0 rounded-full bg-white/20 text-white grid place-items-center">
                <Star size={14} className="fill-current" />
              </span>
              <div>
                <p className="font-semibold text-[14px] leading-snug">
                  {b.title}
                </p>
                <p className="text-[12px] text-white/85 mt-0.5 leading-relaxed">
                  {b.body}
                </p>
              </div>
            </div>
          ))}
        </div>

        <p className="relative mt-6 text-[11px] text-white/75 inline-flex items-center gap-1.5">
          <ShieldCheck size={12} /> Secure login · OTP verified
        </p>
      </div>

      <div className="relative p-6 sm:p-8 flex flex-col">
        {!embedded && (
          <button
            type="button"
            aria-label="Close"
            onClick={closeLogin}
            className="absolute top-3 right-3 h-9 w-9 rounded-full grid place-items-center text-muted hover:bg-surface"
          >
            <X size={18} />
          </button>
        )}

        {step === "phone" && (
          <>
            <div className="md:hidden flex items-center gap-2 mb-5">
              {logoUrl ? (
                <SiteLogoImage
                  src={logoUrl}
                  size={32}
                  className="h-8 w-8 rounded-full object-cover ring-2 ring-[var(--bhagva)]/40"
                />
              ) : (
                <span className="h-8 w-8 rounded-full bg-brand text-white grid place-items-center font-bold text-xs">
                  AF
                </span>
              )}
              <span className="font-semibold">{brandName}</span>
            </div>
            <h3 className="text-[22px] sm:text-[24px] font-bold text-ink leading-snug pr-8">
              Unlock Exclusive Discounts
            </h3>
            <p className="text-sm text-muted mt-1.5 mb-6">
              Enter your mobile number to continue
            </p>

            <form
              onSubmit={handleSend}
              className="space-y-4 flex-1 flex flex-col"
            >
              <label className="block">
                <span className="sr-only">Mobile number</span>
                <div className="flex items-stretch rounded-xl border border-line-strong bg-white focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/10 overflow-hidden">
                  <span className="flex items-center gap-1.5 px-3 border-r border-line text-sm font-semibold text-text bg-surface-alt">
                    <span aria-hidden>🇮🇳</span>
                    +91
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={phone}
                    onChange={(e) =>
                      setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
                    }
                    placeholder="Enter Mobile Number"
                    className="flex-1 px-3.5 py-3.5 text-sm outline-none"
                    autoFocus
                  />
                </div>
              </label>

              <label className="flex items-start gap-2.5 text-[13px] text-text">
                <input
                  type="checkbox"
                  checked={notify}
                  onChange={(e) => setNotify(e.target.checked)}
                  className="mt-0.5 accent-[var(--bhagva)]"
                />
                Notify me for any updates &amp; offers.
              </label>

              {error && <ErrorBanner message={error} />}

              <button
                type="submit"
                disabled={!phoneValid || loading}
                className={`mt-auto w-full rounded-xl py-3.5 text-[15px] font-bold transition ${
                  phoneValid && !loading
                    ? "bg-brand text-white hover:bg-brand-hover shadow-md"
                    : "bg-surface text-subtle cursor-not-allowed"
                }`}
              >
                {loading ? "Sending OTP…" : "Get OTP"}
              </button>

              <p className="text-[11px] text-muted text-center leading-relaxed">
                By continuing you agree to {brandName}&apos;s Privacy Policy
                and T&amp;Cs.
              </p>
            </form>
          </>
        )}

        {step === "otp" && (
          <>
            <h3 className="text-[22px] sm:text-[24px] font-bold text-ink">
              OTP Verification
            </h3>
            <p className="text-sm text-muted mt-2 mb-6">
              We have sent verification code to{" "}
              <strong className="text-ink">+91 {phone}</strong>{" "}
              <button
                type="button"
                onClick={() => {
                  setStep("phone");
                  setError("");
                }}
                className="text-brand font-semibold hover:underline"
              >
                [Edit]
              </button>
            </p>

            <form
              onSubmit={handleVerifyOtp}
              className="space-y-5 flex-1 flex flex-col"
            >
              <div
                className="flex justify-between gap-1.5 sm:gap-2"
                onPaste={onDigitPaste}
              >
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      inputRefs.current[i] = el;
                    }}
                    type="tel"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    onChange={(e) => onDigitChange(i, e.target.value)}
                    onKeyDown={(e) => onDigitKeyDown(i, e)}
                    className="h-12 w-11 sm:h-14 sm:w-12 rounded-xl border border-line-strong text-center text-lg sm:text-xl font-bold outline-none focus:border-brand focus:ring-2 focus:ring-brand/10"
                    aria-label={`OTP digit ${i + 1}`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-1.5 text-sm text-muted">
                <Clock size={14} />
                {resendIn > 0 ? (
                  <span>Resend OTP in {resendIn} Sec</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSend()}
                    disabled={loading}
                    className="font-semibold text-brand hover:underline"
                  >
                    Resend OTP
                  </button>
                )}
              </div>

              {error && <ErrorBanner message={error} />}

              {/* {staticOtp && (
                <p className="text-[11px] text-subtle">
                  Static OTP mode: use <strong>123456</strong>
                </p>
              )} */}

              <button
                type="submit"
                disabled={!otpReady || loading}
                className={`mt-auto w-full rounded-xl py-3.5 text-[15px] font-bold transition ${
                  otpReady && !loading
                    ? "bg-brand text-white hover:bg-brand-hover shadow-md"
                    : "bg-surface text-subtle cursor-not-allowed"
                }`}
              >
                {loading ? "Verifying…" : "Login"}
              </button>

              <a
                href="https://wa.me/911234567890"
                className="text-center text-sm text-brand hover:underline"
              >
                Trouble logging in?
              </a>
            </form>
          </>
        )}

        <div className="mt-5 flex items-center justify-center gap-4 text-[10px] text-subtle">
          <span className="inline-flex items-center gap-1">
            <Check size={11} className="text-emerald-600" /> Secure
          </span>
          <span className="inline-flex items-center gap-1">
            <Sparkles size={11} className="text-amber-500" /> Fast checkout
          </span>
        </div>
      </div>
    </div>
  );

  if (embedded) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-3 py-10 bg-[radial-gradient(ellipse_at_top,_#fff7ed_0%,_#f8f6f1_45%,_#eee8df_100%)]">
        {panel}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[80] flex overflow-y-auto overscroll-contain p-3 sm:p-6">
      <button
        type="button"
        aria-label="Close login"
        className="fixed inset-0 bg-black/55 backdrop-blur-[3px]"
        onClick={closeLogin}
      />
      <div className="relative z-10 m-auto w-full flex justify-center animate-login-modal">
        {panel}
      </div>
    </div>
  );
}
