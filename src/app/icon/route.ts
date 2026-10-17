import { NextResponse } from "next/server";

export const runtime = "nodejs";
/** Always re-check settings so a missing favicon does not stick for an hour. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3003/api/v1"
).replace(/\/$/, "");

/**
 * Same-origin favicon for crawlers (Google prefers /favicon.ico on the site host).
 * Proxies the brand favicon from Admin → Settings.
 */
export async function GET() {
  try {
    const res = await fetch(`${API_URL}/settings`, {
      cache: "no-store",
    });
    if (!res.ok) {
      return new NextResponse("Favicon not configured", {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
    }
    const settings = (await res.json()) as { faviconUrl?: string | null };
    const faviconUrl = settings.faviconUrl?.trim();
    if (!faviconUrl) {
      // Fall back to packaged brand icon when Admin has no custom favicon.
      const { readFile } = await import("fs/promises");
      const { join } = await import("path");
      const file = await readFile(
        join(process.cwd(), "public", "android-icon-192x192.png"),
      );
      return new NextResponse(file, {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        },
      });
    }

    const img = await fetch(faviconUrl, { cache: "no-store" });
    if (!img.ok || !img.body) {
      return new NextResponse("Favicon fetch failed", {
        status: 502,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const contentType = img.headers.get("content-type") || "image/png";
    return new NextResponse(img.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
      },
    });
  } catch {
    return new NextResponse("Favicon unavailable", {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
