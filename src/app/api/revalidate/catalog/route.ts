import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import {
  CATALOG_CACHE_TAG,
  FREE_PRODUCTS_CACHE_TAG,
} from "@/lib/catalog-cache";

function readSecret(req: NextRequest): string {
  const header =
    req.headers.get("x-revalidation-secret") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";
  return header.trim();
}

/**
 * Called by API after Admin free-product list changes so PDP / search / cards
 * stop showing FREE immediately (ISR + fetch Data Cache).
 */
export async function POST(req: NextRequest) {
  const expected = process.env.REVALIDATION_SECRET?.trim();
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "REVALIDATION_SECRET is not configured on web" },
      { status: 503 },
    );
  }

  if (readSecret(req) !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let slugs: string[] = [];
  let collections: string[] = [];
  try {
    const body = (await req.json().catch(() => null)) as {
      slugs?: unknown;
      collections?: unknown;
    } | null;
    if (Array.isArray(body?.slugs)) {
      slugs = body!.slugs!
        .map((s) => String(s || "").trim())
        .filter(Boolean)
        .slice(0, 200);
    }
    if (Array.isArray(body?.collections)) {
      collections = body!.collections!
        .map((s) => String(s || "").trim())
        .filter(Boolean)
        .slice(0, 200);
    }
  } catch {
    /* ignore body parse */
  }

  revalidateTag(CATALOG_CACHE_TAG, { expire: 0 });
  revalidateTag(FREE_PRODUCTS_CACHE_TAG, { expire: 0 });
  revalidatePath("/", "layout");
  revalidatePath("/");
  revalidatePath("/search");
  revalidatePath("/collections", "layout");
  revalidatePath("/products", "layout");
  revalidatePath("/brands", "layout");
  for (const slug of slugs) {
    revalidatePath(`/products/${slug}`);
  }
  for (const slug of collections) {
    revalidatePath(`/collections/${slug}`);
  }

  return NextResponse.json({
    ok: true,
    revalidated: true,
    tags: [CATALOG_CACHE_TAG, FREE_PRODUCTS_CACHE_TAG],
    paths: [
      ...slugs.map((s) => `/products/${s}`),
      ...collections.map((s) => `/collections/${s}`),
    ],
  });
}
