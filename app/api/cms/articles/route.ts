import { auth } from "@/lib/auth";
import { listAdminArticles } from "@/lib/cms/admin-articles";
import { createArticle } from "@/lib/cms/articles";
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
  const status = searchParams.get("status") as Parameters<typeof listAdminArticles>[0] extends infer T
    ? T extends { status?: infer S }
      ? S
      : never
    : never;
  const search = searchParams.get("search") ?? undefined;
  const rows = await listAdminArticles({ status: status ?? undefined, search });
  return jsonOk({
    articles: rows.map(({ id, title, slug, status: articleStatus, updatedAt, source }) => ({
      id,
      title,
      slug,
      status: articleStatus,
      updatedAt,
      source,
    })),
  });
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
    featuredImage?: Record<string, unknown> | null;
    seo?: { title?: string; description?: string; ogImage?: string; noindex?: boolean };
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
    featuredImage: body.featuredImage ?? null,
    seo: {
      canonicalPath: pathname,
      noindex: true,
      ...(body.seo?.title ? { title: body.seo.title } : {}),
      ...(body.seo?.description ? { description: body.seo.description } : {}),
      ...(body.seo?.ogImage ? { ogImage: body.seo.ogImage } : {}),
    },
    createdBy: session.user?.email ?? "admin",
  });

  return jsonOk({ article: serializeArticle(row) }, { status: 201 });
}
