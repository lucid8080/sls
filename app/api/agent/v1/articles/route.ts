import { verifyAgentRequest } from "@/lib/cms/agent-auth";
import { createArticle, listArticles } from "@/lib/cms/articles";
import { agentJsonError, agentJsonOk, headWithJsonBody, readJsonBody } from "@/lib/cms/http";
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
    return agentJsonError(authResult.error, authResult.status);
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as CreateArticleBody["status"] | null;
  const search = searchParams.get("search") ?? undefined;
  const rows = await listArticles({ status: status ?? undefined, search });
  return agentJsonOk({ articles: rows.map(serializeArticle) });
}

export async function HEAD(request: Request) {
  return headWithJsonBody(await GET(request));
}

export async function OPTIONS() {
  return agentJsonOk({
    ok: true,
    endpoint: "/api/agent/v1/articles",
    methods: ["GET", "POST", "HEAD", "OPTIONS"],
  });
}

export async function POST(request: Request) {
  const authResult = await verifyAgentRequest(request.headers.get("authorization"), "agent:write");
  if (!authResult.ok) {
    return agentJsonError(authResult.error, authResult.status);
  }

  const body = await readJsonBody<CreateArticleBody>(request);
  if (!body?.title || !body.html) {
    return agentJsonError("title and html are required.");
  }

  if (body.status === "published") {
    return agentJsonError(
      "Cannot create articles as published. Create as draft/in_review, then POST /articles/{id}/publish.",
      422,
    );
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
      noindex: body.seo?.noindex ?? true,
    },
    createdBy: `agent:${authResult.label}`,
  });

  return agentJsonOk({ article: serializeArticle(row), sanitizeReports: sanitized.reports }, { status: 201 });
}
