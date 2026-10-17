import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export const BLOGS_CACHE_TAG = "blogs";

function readSecret(req: NextRequest): string {
  const header =
    req.headers.get("x-revalidation-secret") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";
  return header.trim();
}

/**
 * Called by API after Admin blog create/update/delete so /blogs/[slug]
 * stops serving stale ISR/Data Cache HTML.
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
  try {
    const body = (await req.json().catch(() => null)) as {
      slugs?: unknown;
    } | null;
    if (Array.isArray(body?.slugs)) {
      slugs = body!.slugs!
        .map((s) => String(s || "").trim())
        .filter(Boolean)
        .slice(0, 100);
    }
  } catch {
    /* ignore */
  }

  revalidateTag(BLOGS_CACHE_TAG, { expire: 0 });
  revalidatePath("/blogs");
  revalidatePath("/blogs", "layout");
  for (const slug of slugs) {
    revalidateTag(`blog:${slug}`, { expire: 0 });
    revalidatePath(`/blogs/${slug}`);
  }

  return NextResponse.json({
    ok: true,
    revalidated: true,
    tags: [BLOGS_CACHE_TAG, ...slugs.map((s) => `blog:${s}`)],
    paths: ["/blogs", ...slugs.map((s) => `/blogs/${s}`)],
  });
}
