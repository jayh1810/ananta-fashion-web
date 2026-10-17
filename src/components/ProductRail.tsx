import { ProductCarousel } from "@/components/ProductCarousel";
import { Container, SectionHeader } from "@/components/ui";
import type { Product } from "@/lib/api";

export function ProductRail({
  title,
  products,
  href,
  limit = 8,
}: {
  title: string;
  products: Product[];
  href?: string;
  limit?: number;
}) {
  if (!products?.length) return null;
  return (
    <section className="py-6 sm:py-8">
      <Container>
        <SectionHeader title={title} href={href} />
        <ProductCarousel products={products.slice(0, limit)} eagerFirst />
      </Container>
    </section>
  );
}
