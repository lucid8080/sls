import { auth } from "@/lib/auth";
import { createArticle, listArticles } from "@/lib/cms/articles";
import { isDatabaseConfigured } from "@/lib/cms/db/client";
import { jsonError, jsonOk, readJsonBody } from "@/lib/cms/http";
import { sanitizeCmsHtml } from "@/lib/cms/sanitize";
import { serializeArticle } from "@/lib/cms/serialize";
import { pathnameFromSlug, slugifyTitle } from "@/lib/cms/schemas";

export async function GET(request: Request) {
  if (!isDatabaseConfigured()) {
    return jsonError("DATABASE_URL is not configured.", 503);
  }

  const session = await auth();
  if (!session) {
    return jsonError("Unauthorized.", 401);
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as Parameters<typeof listArticles>[0] extends infer T
    ? T extends { status?: infer S }
      ? S
      : never
    : never;
  const search = searchParams.get("search") ?? undefined;
  const rows = await listArticles({ status: status ?? undefined, search });
  return jsonOk({ articles: rows.map(serializeArticle) });
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return jsonError("DATABASE_URL is not configured.", 503);
  }

  const session = await auth();
  if (!session) {
    return jsonError("Unauthorized.", 401);
  }

  const body = await readJsonBody<{
    title: string;
    slug?: string;
    excerpt?: string;
    html?: string;
    status?: "draft" | "in_review" | "scheduled" | "published" | "archived";
  }>(request);

  if (!body?.title) {
    return jsonError("title is required.");
  }

  const slug = body.slug ?? slugifyTitle(body.title);
  const pathname = pathnameFromSlug(slug);
  const html = sanitizeCmsHtml(body.html ?? "<p></p>", { title: body.title, pathname }).html;

  const row = await createArticle({
    title: body.title,
    slug,
    excerpt: body.excerpt,
    html,
    status: body.status ?? "draft",
    seo: {
      canonicalPath: pathname,
      noindex: true,
    },
    createdBy: session.user?.email ?? "admin",
  });

  return jsonOk({ article: serializeArticle(row) }, { status: 201 });
}
