import { verifyAgentRequest } from "@/lib/cms/agent-auth";
import { createArticle, listArticles } from "@/lib/cms/articles";
import { jsonError, jsonOk, readJsonBody } from "@/lib/cms/http";
import { sanitizeCmsHtml } from "@/lib/cms/sanitize";
import { serializeArticle } from "@/lib/cms/serialize";
import { pathnameFromSlug, slugifyTitle } from "@/lib/cms/schemas";

type CreateArticleBody = {
  title: string;
  slug?: string;
  excerpt?: string;
  html: string;
  status?: "draft" | "in_review" | "scheduled" | "published" | "archived";
  author?: { id: string; name: string; slug: string };
  categories?: Array<{ id: string; name: string; slug: string }>;
  tags?: Array<{ id: string; name: string; slug: string }>;
  featuredImage?: Record<string, unknown>;
  seo?: {
    title?: string;
    description?: string;
    canonicalPath?: string;
    ogImage?: string;
    noindex?: boolean;
  };
};

export async function GET(request: Request) {
  const authResult = await verifyAgentRequest(request.headers.get("authorization"), "agent:read");
  if (!authResult.ok) {
    return jsonError(authResult.error, authResult.status);
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as CreateArticleBody["status"] | null;
  const search = searchParams.get("search") ?? undefined;
  const rows = await listArticles({ status: status ?? undefined, search });
  return jsonOk({ articles: rows.map(serializeArticle) });
}

export async function POST(request: Request) {
  const authResult = await verifyAgentRequest(request.headers.get("authorization"), "agent:write");
  if (!authResult.ok) {
    return jsonError(authResult.error, authResult.status);
  }

  const body = await readJsonBody<CreateArticleBody>(request);
  if (!body?.title || !body.html) {
    return jsonError("title and html are required.");
  }

  const slug = body.slug ?? slugifyTitle(body.title);
  const pathname = pathnameFromSlug(slug);
  const sanitized = sanitizeCmsHtml(body.html, { title: body.title, pathname });

  const row = await createArticle({
    title: body.title,
    slug,
    excerpt: body.excerpt,
    html: sanitized.html,
    status: body.status ?? "draft",
    author: body.author,
    categories: body.categories,
    tags: body.tags,
    featuredImage: body.featuredImage,
    seo: {
      canonicalPath: body.seo?.canonicalPath ?? pathname,
      title: body.seo?.title,
      description: body.seo?.description,
      ogImage: body.seo?.ogImage,
      noindex: body.seo?.noindex ?? body.status !== "published",
    },
    createdBy: `agent:${authResult.label}`,
  });

  return jsonOk({ article: serializeArticle(row), sanitizeReports: sanitized.reports }, { status: 201 });
}
