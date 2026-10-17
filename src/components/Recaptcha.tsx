"use client";

import Script from "next/script";
import { recaptchaSiteKey } from "@/lib/recaptcha";

export function Recaptcha() {
  const siteKey = recaptchaSiteKey();
  if (!siteKey) return null;

  return (
    <Script
      src={`https://www.google.com/recaptcha/api.js?render=${siteKey}`}
      strategy="afterInteractive"
    />
  );
}
