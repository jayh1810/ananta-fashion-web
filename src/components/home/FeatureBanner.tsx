import { BannerCard } from "@/components/home/BannerCard";
import { Container } from "@/components/ui";
import { SectionTitle } from "@/components/HomePromoSections";

/** One wide lifestyle banner under the deal row. */
export function FeatureBanner({
  href,
  imageUrl,
  imageAlt,
  title,
  subtitle,
  heading,
}: {
  href: string;
  imageUrl?: string | null;
  imageAlt?: string | null;
  title?: string | null;
  subtitle?: string | null;
  heading?: string;
}) {
  if (!imageUrl && !title) return null;
  return (
    <section className="py-4 sm:py-6">
      <Container>
        {heading ? <SectionTitle title={heading} center /> : null}
        <BannerCard
          href={href}
          imageUrl={imageUrl}
          imageAlt={imageAlt}
          title={title}
          subtitle={subtitle}
          sizes="(max-width:640px) 100vw, 1200px"
          className="aspect-[16/8] w-full sm:aspect-[21/8]"
        />
      </Container>
    </section>
  );
}
