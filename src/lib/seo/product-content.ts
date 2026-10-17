import type { Product } from "@/lib/api";
import { stripHtml } from "@/lib/seo";

export type ProductContentSection = {
  id: string;
  title: string;
  body: string;
  html?: boolean;
};

function hasText(v?: string | null) {
  return stripHtml(v || "").length >= 12;
}

/** Build server-rendered product content sections from DB fields only. */
export function buildProductContentSections(
  product: Product,
): ProductContentSection[] {
  const sections: ProductContentSection[] = [];

  const summary = stripHtml(
    product.shortDescription || product.metaDescription || "",
  );
  if (summary.length >= 20) {
    sections.push({ id: "summary", title: "Product summary", body: summary });
  }

  const description = stripHtml(product.description || "");
  if (description.length >= 40) {
    sections.push({
      id: "details",
      title: "Product details",
      body: description,
      html: looksLikeHtml(product.description),
    });
  }

  const crystals = (product.crystals || []).filter((c) => c?.name?.trim());
  if (crystals.length) {
    const body = crystals
      .map((c) =>
        c.benefit?.trim()
          ? `${c.name.trim()} — ${c.benefit.trim()}`
          : c.name.trim(),
      )
      .join("\n");
    sections.push({
      id: "stones",
      title: "Highlights",
      body,
    });
  }

  if (product.benefits?.length) {
    sections.push({
      id: "benefits",
      title: "Benefits & traditional associations",
      body: product.benefits.join("\n"),
    });
  } else if (product.benefitBlocks?.length) {
    sections.push({
      id: "benefits",
      title: "Why choose this product",
      body: product.benefitBlocks
        .filter((b) => b?.title)
        .map((b) => (b.body ? `${b.title}: ${b.body}` : b.title))
        .join("\n"),
    });
  }

  if (hasText(product.howToWear)) {
    sections.push({
      id: "how-to-use",
      title: "How to wear or use",
      body: product.howToWear!.trim(),
      html: looksLikeHtml(product.howToWear),
    });
  }

  if (hasText(product.bestDayToWear)) {
    sections.push({
      id: "best-day",
      title: "Best day to wear",
      body: product.bestDayToWear!.trim(),
      html: looksLikeHtml(product.bestDayToWear),
    });
  }

  if (hasText(product.productSpec)) {
    sections.push({
      id: "specifications",
      title: "Specifications",
      body: product.productSpec!.trim(),
      html: looksLikeHtml(product.productSpec),
    });
  }

  if (hasText(product.authenticityText)) {
    sections.push({
      id: "authenticity",
      title: "Authenticity",
      body: product.authenticityText!.trim(),
      html: looksLikeHtml(product.authenticityText),
    });
  }

  if (product.offerGiftText?.trim()) {
    sections.push({
      id: "included",
      title: "What's included",
      body: product.offerGiftText.trim(),
    });
  }

  const faqs =
    product.pdpAccordions
      ?.find((a) => /^faq/i.test(a.title.trim()))
      ?.body ||
    product.seo?.suggestedFaqs
      ?.map((f) => `${f.question}\n${f.answer}`)
      .join("\n\n") ||
    "";
  if (stripHtml(faqs).length >= 24) {
    sections.push({
      id: "faqs",
      title: "Frequently asked questions",
      body: faqs,
      html: looksLikeHtml(faqs),
    });
  } else if (product.seo?.suggestedFaqs?.length) {
    sections.push({
      id: "faqs",
      title: "Frequently asked questions",
      body: product.seo.suggestedFaqs
        .map((f) => `Q: ${f.question}\nA: ${f.answer}`)
        .join("\n\n"),
    });
  }

  return sections;
}

function looksLikeHtml(raw?: string | null) {
  return /<[a-z][\s\S]*>/i.test(String(raw || ""));
}
