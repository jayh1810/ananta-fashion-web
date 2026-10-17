export function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function shortPlainText(
  raw: string | null | undefined,
  max = 160,
): string {
  const text = stripHtml(String(raw || ""));
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max).replace(/\s+\S*$/, "").trim()}…`;
}

export function extractFaqPairsFromHtml(
  body: string,
): { question: string; answer: string }[] {
  const pairs: { question: string; answer: string }[] = [];
  const samePara = [
    ...body.matchAll(
      /<p[^>]*>\s*<strong[^>]*>([\s\S]*?)<\/strong>\s*(?:<br\s*\/?>)+\s*([\s\S]*?)<\/p>/gi,
    ),
  ];
  for (const m of samePara) {
    const question = stripHtml(m[1] || "").replace(
      /^Q(?:uestion)?\s*[:.)-]?\s*/i,
      "",
    );
    const answer = stripHtml(m[2] || "");
    if (question.length >= 8 && answer.length >= 8) {
      pairs.push({ question, answer });
    }
  }
  if (pairs.length) return pairs.slice(0, 12);

  const strongBlocks = [
    ...body.matchAll(
      /<p[^>]*>\s*(?:<strong[^>]*>|<b[^>]*>)\s*(?:Q(?:uestion)?\s*[:.)-]?\s*)?([^<]{8,180}?)\s*(?:<\/strong>|<\/b>)\s*<\/p>\s*<p[^>]*>([\s\S]*?)<\/p>/gi,
    ),
  ];
  for (const m of strongBlocks) {
    const question = stripHtml(m[1] || "").replace(
      /^Q(?:uestion)?\s*[:.)-]?\s*/i,
      "",
    );
    const answer = stripHtml(m[2] || "");
    if (question.length >= 8 && answer.length >= 8) {
      pairs.push({ question, answer });
    }
  }
  return pairs.slice(0, 12);
}
