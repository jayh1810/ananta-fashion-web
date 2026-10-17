import Link from "next/link";
import clsx from "clsx";
import { ChevronRight } from "lucide-react";

export type SectionHeaderProps = {
  title: string;
  subtitle?: string | null;
  href?: string | null;
  actionLabel?: string;
  as?: "h1" | "h2" | "h3";
  align?: "left" | "center";
  className?: string;
};

export function SectionHeader({
  title,
  subtitle,
  href,
  actionLabel = "View all",
  as: Heading = "h2",
  align = "left",
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={clsx(
        "mb-3 sm:mb-4 flex items-end gap-3",
        align === "center" ? "flex-col items-center text-center" : "justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <Heading className="section-title">{title}</Heading>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {href && (
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-0.5 text-sm font-semibold text-brand hover:text-brand-hover"
        >
          {actionLabel}
          <ChevronRight size={16} aria-hidden />
        </Link>
      )}
    </div>
  );
}
