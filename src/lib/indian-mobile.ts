/** Strip non-digits, optional +91 prefix, cap at 10 digits for typing. */
export function sanitizeMobileInput(raw: string): string {
  let digits = String(raw || "").replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length > 10) {
    digits = digits.slice(2);
  }
  return digits.slice(0, 10);
}

/** Valid 10-digit Indian mobile, or empty when input is incomplete/invalid. */
export function normalizeMobile(raw: string): string {
  const digits = sanitizeMobileInput(raw);
  return digits.length === 10 ? digits : "";
}

/** Indian mobile: 10 digits starting with 6–9. */
export function isValidIndianMobile(raw: string): boolean {
  const digits = normalizeMobile(raw);
  return /^[6-9]\d{9}$/.test(digits);
}

/** Per-unit mobile report pricing: one charge per row in the list (minimum 1). */
export function mobileListUnitCount(nums: string[] | undefined | null): number {
  return Math.max(1, (nums || []).length || 1);
}

export function formatRupeeFromPaise(paise: number): string {
  return `₹${Math.round(paise / 100)}`;
}
