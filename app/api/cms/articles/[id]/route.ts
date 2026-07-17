import { auth } from "@/lib/auth";
import { getArticleById, listRevisions, updateArticle } from "@/lib/cms/articles";
import { isDatabaseConfigured } from "@/lib/cms/db/client";
import { jsonError, jsonOk, readJsonBody } from "@/lib/cms/http";
import { sanitizeCmsHtml } from "@/lib/cms/sanitize";
import { serializeArticle } from "@/lib/cms/serialize";
import { pathnameFromSlug } from "@/lib/cms/schemas";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  if (!isDatabaseConfigured()) {
    return jsonError("DATABASE_URL is not configured.", 503);
  }

  const session = await auth();
  if (!session) {
    return jsonError("Unauthorized.", 401);
  }

  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  if (searchParams.get("revisions") === "1") {
    const revisions = await listRevisions(id);
    return jsonOk({ revisions });
  }

  const row = await getArticleById(id);
  if (!row) {
    return jsonError("Article not found.", 404);
  }

  return jsonOk({ article: serializeArticle(row) });
}

export async function PATCH(request: Request, context: RouteContext) {
  if (!isDatabaseConfigured()) {
    return jsonError("DATABASE_URL is not configured.", 503);
  }

  const session = await auth();
  if (!session) {
    return jsonError("Unauthorized.", 401);
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
    session.user?.email ?? "admin",
  );

  return jsonOk({ article: row ? serializeArticle(row) : null });
}
