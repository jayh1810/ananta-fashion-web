import { NextResponse, type NextRequest } from "next/server";
import { productGoneHtml } from "@/lib/seo/gone-html";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3003/api/v1"
).replace(/\/$/, "");

type ResolveSlugResponse =
  | { status: "ok" }
  | { status: "redirect"; slug: string }
  | { status: "gone" }
  | { status: "not_found" };

/**
 * Resolves renamed/deleted product slugs at the edge so old links 301 to the
 * current product (or return 410 when permanently removed) instead of
 * hard-404ing. Only ever intervenes for slugs that are NOT a live product —
 * it never touches normal product traffic beyond one lightweight lookup.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const match = pathname.match(/^\/products\/([^/]+)\/?$/);
  if (!match) return NextResponse.next();

  const slug = decodeURIComponent(match[1]);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(
      `${API_URL}/products/resolve-slug/${encodeURIComponent(slug)}`,
      { signal: controller.signal, next: { revalidate: 300 } },
    );
    clearTimeout(timeout);

    if (!res.ok) return NextResponse.next();
    const data = (await res.json()) as ResolveSlugResponse;

    if (data.status === "redirect" && data.slug) {
      const url = request.nextUrl.clone();
      url.pathname = `/products/${data.slug}`;
      return NextResponse.redirect(url, 301);
    }

    if (data.status === "gone") {
      return new NextResponse(productGoneHtml(), {
        status: 410,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
          "X-Robots-Tag": "noindex, nofollow",
        },
      });
    }

    return NextResponse.next();
  } catch {
    // Never block the page over a redirect-resolution hiccup.
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/products/:slug"],
};
