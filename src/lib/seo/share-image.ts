import { NextResponse } from "next/server";
import { SITE_URL } from "@/lib/seo/constants";
import { decodeOgSourceToken } from "@/lib/seo/share-image-url";

export { decodeOgSourceToken, encodeOgSourceToken, buildShareOgPath } from "@/lib/seo/share-image-url";

const ALLOWED_HOSTS = new Set([
  "sin1.contabostorage.com",
  "eu2.contabostorage.com",
  "usc1.contabostorage.com",
  "cdn.shopify.com",
]);

function isAllowedSource(raw: string): URL | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    const host = u.hostname.toLowerCase();
    if (ALLOWED_HOSTS.has(host)) return u;
    try {
      const site = new URL(SITE_URL);
      if (host === site.hostname) return u;
    } catch {
      /* ignore */
    }
    if (host === "localhost" || host === "127.0.0.1") return u;
    return null;
  } catch {
    return null;
  }
}

async function buildShareJpeg(sourceUrl: string): Promise<Buffer> {
  const source = isAllowedSource(sourceUrl);
  if (!source) {
    throw Object.assign(new Error("Host not allowed"), { status: 400 });
  }

  const upstream = await fetch(source.toString(), {
    headers: { "User-Agent": "StorefrontShareImage/1.0" },
    next: { revalidate: 86400 },
  });
  if (!upstream.ok) {
    throw Object.assign(new Error(`Upstream ${upstream.status}`), {
      status: 502,
    });
  }

  const input = Buffer.from(await upstream.arrayBuffer());
  const sharp = (await import("sharp")).default;
  // Baseline (non-progressive) JPEG — WhatsApp / some chat previews reject progressive.
  return sharp(input)
    .rotate()
    .resize(1200, 630, {
      fit: "cover",
      position: "centre",
      withoutEnlargement: false,
    })
    .jpeg({
      quality: 80,
      mozjpeg: true,
      progressive: false,
      chromaSubsampling: "4:2:0",
    })
    .toBuffer();
}

function jpegResponse(buf: Buffer) {
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(buf.length),
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export async function respondShareImage(sourceUrl: string | null | undefined) {
  if (!sourceUrl?.trim()) {
    return NextResponse.json(
      {
        error: "Missing image source",
        hint: "Use the full og:image URL from the page HTML (/og/<token>.jpg), or /share-image?u=<https-image-url>",
      },
      { status: 400 },
    );
  }
  try {
    const buf = await buildShareJpeg(sourceUrl.trim());
    return jpegResponse(buf);
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    return NextResponse.json(
      { error: e?.message || "Failed to build share image" },
      { status },
    );
  }
}

export async function respondShareImageHead(
  sourceUrl: string | null | undefined,
) {
  const res = await respondShareImage(sourceUrl);
  if (res.status !== 200) return res;
  return new NextResponse(null, { status: 200, headers: res.headers });
}
