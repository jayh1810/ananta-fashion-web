"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Mail, Phone } from "lucide-react";
import { api, BRAND } from "@/lib/api";
import { DEFAULT_THEME, type ThemeLink } from "@/lib/theme";
import { ThemeIcon } from "@/components/ThemeIcon";

const FALLBACK_MESSAGES = [`Welcome to ${BRAND}`];

const STRIP_CLASS =
  "relative z-50 bg-[linear-gradient(90deg,var(--strip-from)_0%,var(--strip-to)_50%,var(--strip-from)_100%)] text-[var(--strip-text)]";

export type AnnouncementBarInitial = {
  enabled?: boolean;
  messages?: string[];
  intervalMs?: number;
  phoneHref?: string;
  email?: string;
};

function normalizeMessages(list?: string[] | null) {
  if (!Array.isArray(list)) return [];
  return list
    .map((m) => (typeof m === "string" ? m.trim() : ""))
    .filter(Boolean);
}

export function AnnouncementBar({
  initial,
  topLinks = DEFAULT_THEME.topLinks,
}: {
  initial?: AnnouncementBarInitial | null;
  topLinks?: ThemeLink[];
}) {
  const initialMessages = normalizeMessages(initial?.messages);
  const hasServerSeed = initialMessages.length > 0;

  const [messages, setMessages] = useState<string[]>(
    hasServerSeed ? initialMessages : [],
  );
  const [enabled, setEnabled] = useState(initial?.enabled !== false);
  const [intervalMs, setIntervalMs] = useState(
    initial?.intervalMs && initial.intervalMs >= 1000
      ? initial.intervalMs
      : 4500,
  );
  const [index, setIndex] = useState(0);
  const [phoneHref, setPhoneHref] = useState(
    initial?.phoneHref || "tel:+911234567890",
  );
  const [email, setEmail] = useState(initial?.email || "");
  const [ready, setReady] = useState(hasServerSeed);

  useEffect(() => {
    if (hasServerSeed) return;
    api<{
      announcements?: {
        enabled?: boolean;
        messages?: string[];
        intervalMs?: number;
      };
      store?: {
        phoneHref?: string;
        email?: string;
      };
    }>("/settings")
      .then((s) => {
        const a = s.announcements;
        if (a) {
          setEnabled(a.enabled !== false);
          const next = normalizeMessages(a.messages);
          if (next.length) setMessages(next);
          else if (!hasServerSeed) setMessages(FALLBACK_MESSAGES);
          if (a.intervalMs && a.intervalMs >= 1000) setIntervalMs(a.intervalMs);
        } else if (!hasServerSeed) {
          setMessages(FALLBACK_MESSAGES);
        }
        if (s.store?.phoneHref) setPhoneHref(s.store.phoneHref);
        if (s.store?.email) setEmail(s.store.email);
      })
      .catch(() => {
        if (!hasServerSeed) setMessages(FALLBACK_MESSAGES);
      })
      .finally(() => setReady(true));
  }, [hasServerSeed]);

  useEffect(() => {
    if (messages.length <= 1) return;
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % messages.length);
    }, intervalMs);
    return () => clearInterval(t);
  }, [messages.length, intervalMs]);

  useEffect(() => {
    setIndex(0);
  }, [messages]);


  if (!ready) {
    return (
      <div className={`${STRIP_CLASS} text-[11px] sm:text-[13px]`} aria-hidden>
        <div className="mx-auto min-h-8 max-w-[1440px] px-3 py-1 sm:px-4 lg:px-6" />
      </div>
    );
  }

  if (!enabled || !messages.length) return null;

  const current = messages[index % messages.length];
  const utilLink =
    "inline-flex items-center gap-1.5 whitespace-nowrap transition-opacity hover:opacity-70";

  return (
    <div className={`${STRIP_CLASS} text-[11px] sm:text-xs`}>
      <div className="mx-auto flex min-h-8 max-w-[1440px] items-center gap-3 px-3 py-1 sm:px-4 lg:px-6">
        <div className="flex min-w-0 flex-1 items-center justify-center gap-1 lg:justify-start">
          {messages.length > 1 && (
            <button
              type="button"
              aria-label="Previous announcement"
              className="shrink-0 p-1 opacity-70 hover:opacity-100"
              onClick={() =>
                setIndex((i) => (i - 1 + messages.length) % messages.length)
              }
            >
              <ChevronLeft size={15} />
            </button>
          )}
          <p className="min-w-0 break-words text-center font-semibold uppercase leading-snug tracking-wide lg:text-left">
            {current}
          </p>
          {messages.length > 1 && (
            <button
              type="button"
              aria-label="Next announcement"
              className="shrink-0 p-1 opacity-70 hover:opacity-100"
              onClick={() => setIndex((i) => (i + 1) % messages.length)}
            >
              <ChevronRight size={15} />
            </button>
          )}
        </div>
        <nav
          aria-label="Help links"
          className="hidden shrink-0 items-center divide-x divide-current/40 text-[13px] font-medium md:flex [&>*]:px-3 [&>*:last-child]:pr-0"
        >
          {topLinks.map((link) =>
            link.href.startsWith("/") ? (
              <Link key={link.label + link.href} href={link.href} className={utilLink}>
                <ThemeIcon name={link.icon} />
                {link.label}
              </Link>
            ) : (
              <a
                key={link.label + link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className={utilLink}
              >
                <ThemeIcon name={link.icon} />
                {link.label}
              </a>
            ),
          )}
          <a href={phoneHref} aria-label="Call" className={utilLink}>
            <Phone size={14} strokeWidth={1.75} aria-hidden />
            <span className="hidden lg:inline">Call us</span>
          </a>
          {email ? (
            <a href={`mailto:${email}`} aria-label="Email" className={utilLink}>
              <Mail size={14} strokeWidth={1.75} aria-hidden />
            </a>
          ) : null}
        </nav>
      </div>
    </div>
  );
}
