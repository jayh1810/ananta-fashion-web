import { notFound } from "next/navigation";
import {
  fetchLlmsProduct,
  llmsTextResponse,
  renderLlmsProductDetailTxt,
} from "@/lib/llms";
import { SITE_URL } from "@/lib/seo";

export const revalidate = 300;

function cleanSlug(raw: string) {
  return decodeURIComponent(raw).replace(/\.txt$/i, "").trim();
}

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const slug = cleanSlug((await ctx.params).slug || "");
  if (!slug) notFound();
  const product = await fetchLlmsProduct(slug);
  if (!product) notFound();
  return llmsTextResponse(renderLlmsProductDetailTxt(product, SITE_URL));
}
