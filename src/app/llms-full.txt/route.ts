import {
  fetchLlmsCatalog,
  llmsTextResponse,
  renderLlmsFullTxt,
} from "@/lib/llms";

export const revalidate = 300;

export async function GET() {
  const data = await fetchLlmsCatalog();
  return llmsTextResponse(renderLlmsFullTxt(data));
}
