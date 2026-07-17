import { verifyAgentRequest } from "@/lib/cms/agent-auth";
import { searchInternalArticles } from "@/lib/cms/articles";
import { getContentBundle } from "@/lib/content";
import { jsonError, jsonOk } from "@/lib/cms/http";

export async function GET(request: Request) {
  const authResult = await verifyAgentRequest(request.headers.get("authorization"), "agent:read");
  if (!authResult.ok) {
    return jsonError(authResult.error, authResult.status);
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  if (!query) {
    return jsonError("q is required.");
  }

  const cmsResults = await searchInternalArticles(query, 20);
  const staticResults = getContentBundle()
    .articles.filter((article) => {
      const haystack = `${article.title} ${article.slug} ${article.pathname}`.toLowerCase();
      return haystack.includes(query.toLowerCase());
    })
    .slice(0, 20)
    .map((article) => ({
      id: article.id,
      title: article.title,
      slug: article.slug,
      pathname: article.pathname,
      status: "published" as const,
      source: "static" as const,
    }));

  return jsonOk({
    results: [
      ...cmsResults.map((item) => ({ ...item, source: "cms" as const })),
      ...staticResults,
    ],
  });
}
