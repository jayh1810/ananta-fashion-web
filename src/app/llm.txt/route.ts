import {
  fetchLlmsCatalog,
  llmsTextResponse,
  renderLlmsTxt,
} from "@/lib/llms";

export const revalidate = 300;

/** Alias of /llms.txt for agents that request /llm.txt */
export async function GET() {
  const data = await fetchLlmsCatalog();
  return llmsTextResponse(renderLlmsTxt(data));
}
