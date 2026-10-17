import { BRAND } from "@/lib/api";
import { ENTITY, fetchPublicFaqs, SITE_URL } from "@/lib/seo";

export async function SiteFaqJsonLd() {
  const faqs = await fetchPublicFaqs();
  if (!faqs.length) return null;

  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.slice(0, 20).map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.answer,
      },
    })),
    about: {
      "@type": "Organization",
      "@id": ENTITY.organization,
      name: BRAND,
      url: SITE_URL,
    },
    url: `${SITE_URL}/#faqs`,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
