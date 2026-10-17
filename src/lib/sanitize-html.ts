/** Strip unsafe bits from product description HTML before rendering on the storefront. */
export function sanitizeProductHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/<\/?(iframe|object|embed|form|input|button)[^>]*>/gi, "");
}

export function looksLikeHtml(s: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test((s || "").trim());
}
