import { NextRequest } from "next/server";
import {
  decodeOgSourceToken,
  respondShareImage,
  respondShareImageHead,
} from "@/lib/seo/share-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Path-based OG image: /og/<base64url>.jpg
 * Chat apps fetch this more reliably than long ?u= query URLs.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  return respondShareImage(decodeOgSourceToken(token));
}

export async function HEAD(
  _req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  return respondShareImageHead(decodeOgSourceToken(token));
}
