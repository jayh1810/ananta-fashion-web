declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (
        siteKey: string,
        options: { action: string },
      ) => Promise<string>;
    };
  }
}

export function recaptchaSiteKey(): string {
  return (process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "").trim();
}

function waitForGrecaptcha(timeoutMs = 8000): Promise<
  NonNullable<Window["grecaptcha"]> | null
> {
  if (typeof window === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      if (window.grecaptcha?.execute) {
        resolve(window.grecaptcha);
        return;
      }
      if (Date.now() - started > timeoutMs) {
        resolve(null);
        return;
      }
      window.setTimeout(tick, 50);
    };
    tick();
  });
}

/** Google only allows A–Z, a–z, / in action names. */
export function recaptchaActionFromPath(path: string): string {
  const p = path.toLowerCase();
  if (p.includes("/auth")) return "login";
  if (p.includes("/contact")) return "contact";
  if (p.includes("/checkout")) return "checkout";
  if (p.includes("/coupon")) return "coupon";
  if (p.includes("/cart")) return "cart";
  if (p.includes("/address")) return "account";
  return "submit";
}

export async function getRecaptchaToken(action = "submit"): Promise<string> {
  const siteKey = recaptchaSiteKey();
  if (!siteKey || typeof window === "undefined") return "";

  const grecaptcha = await waitForGrecaptcha();
  if (!grecaptcha) return "";

  await new Promise<void>((resolve) => {
    try {
      grecaptcha.ready(() => resolve());
    } catch {
      resolve();
    }
  });

  const safeAction = (action || "submit").replace(/[^A-Za-z/]/g, "") || "submit";
  try {
    return await grecaptcha.execute(siteKey, { action: safeAction });
  } catch {
    return "";
  }
}
