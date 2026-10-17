import { NextRequest } from "next/server";
import {
  respondShareImage,
  respondShareImageHead,
} from "@/lib/seo/share-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Legacy: /share-image?u=<absolute-url> — prefer /og/<token>.jpg */
export async function GET(req: NextRequest) {
  return respondShareImage(req.nextUrl.searchParams.get("u"));
}

export async function HEAD(req: NextRequest) {
  return respondShareImageHead(req.nextUrl.searchParams.get("u"));
}
