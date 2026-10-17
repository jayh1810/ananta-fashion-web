import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-5 py-20 text-center">
      <h1 className="section-title mb-2">Page not found</h1>
      <p className="text-muted text-sm mb-6">
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link href="/" className="btn-primary px-6 py-3 text-sm inline-block">
        Go home
      </Link>
    </div>
  );
}
