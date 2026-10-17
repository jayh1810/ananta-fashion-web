import {
  fetchLlmsCatalog,
  llmsTextResponse,
  renderLlmsProductsTxt,
} from "@/lib/llms";

export const revalidate = 300;

export async function GET() {
  const data = await fetchLlmsCatalog();
  return llmsTextResponse(renderLlmsProductsTxt(data));
}
