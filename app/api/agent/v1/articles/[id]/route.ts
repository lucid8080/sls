import { verifyAgentRequest } from "@/lib/cms/agent-auth";
import { getArticleById, updateArticle } from "@/lib/cms/articles";
import { jsonError, jsonOk, headWithJsonBody, readJsonBody } from "@/lib/cms/http";
import { sanitizeCmsHtml } from "@/lib/cms/sanitize";
import { serializeArticle } from "@/lib/cms/serialize";
import { pathnameFromSlug } from "@/lib/cms/schemas";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const authResult = await verifyAgentRequest(request.headers.get("authorization"), "agent:read");
  if (!authResult.ok) {
    return jsonError(authResult.error, authResult.status);
  }

  const { id } = await context.params;
  const row = await getArticleById(id);
  if (!row) {
    return jsonError("Article not found.", 404);
  }

  return jsonOk({ article: serializeArticle(row) });
}

export async function HEAD(request: Request, context: RouteContext) {
  return headWithJsonBody(await GET(request, context));
}

export async function PATCH(request: Request, context: RouteContext) {
  const authResult = await verifyAgentRequest(request.headers.get("authorization"), "agent:write");
  if (!authResult.ok) {
    return jsonError(authResult.error, authResult.status);
  }

  const { id } = await context.params;
  const body = await readJsonBody<{
    title?: string;
    slug?: string;
    excerpt?: string;
    html?: string;
    status?: "draft" | "in_review" | "scheduled" | "published" | "archived";
    author?: { id: string; name: string; slug: string } | null;
    categories?: Array<{ id: string; name: string; slug: string }>;
    tags?: Array<{ id: string; name: string; slug: string }>;
    featuredImage?: Record<string, unknown> | null;
    seo?: Record<string, unknown>;
  }>(request);

  if (!body) {
    return jsonError("Invalid JSON body.");
  }

  const existing = await getArticleById(id);
  if (!existing) {
    return jsonError("Article not found.", 404);
  }

  const slug = body.slug ?? existing.slug;
  const pathname = pathnameFromSlug(slug);
  const html = body.html
    ? sanitizeCmsHtml(body.html, { id, title: body.title ?? existing.title, pathname }).html
    : undefined;

  const row = await updateArticle(
    id,
    {
      title: body.title,
      slug: body.slug,
      excerpt: body.excerpt,
      html,
      status: body.status,
      author: body.author === undefined ? undefined : body.author,
      categories: body.categories,
      tags: body.tags,
      featuredImage: body.featuredImage === undefined ? undefined : body.featuredImage,
      seo: body.seo as never,
    },
    `agent:${authResult.label}`,
  );

  return jsonOk({ article: row ? serializeArticle(row) : null });
}
