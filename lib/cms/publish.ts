import { eq } from "drizzle-orm";
import { getDb } from "@/lib/cms/db/client";
import { articles, publishLog } from "@/lib/cms/db/schema";
import { getArticleById, updateArticle } from "@/lib/cms/articles";
import { articleRowToExport, validatePublishedArticle } from "@/lib/cms/validate";
import { revalidateCmsContent } from "@/lib/cms/revalidate-content";
import { sanitizeCmsHtml } from "@/lib/cms/sanitize";
import { notifyTelegram } from "@/lib/cms/telegram";

export type PublishResult = {
  ok: boolean;
  articleId?: string;
  issues?: Array<{ code: string; message: string; severity: string }>;
  revalidated?: boolean;
  error?: string;
};

export async function publishArticle(articleId: string, actor: string): Promise<PublishResult> {
  const row = await getArticleById(articleId);
  if (!row) {
    return { ok: false, error: "Article not found." };
  }

  const sanitized = sanitizeCmsHtml(row.html, {
    id: row.id,
    title: row.title,
    pathname: row.pathname,
  });

  const updated = await updateArticle(
    articleId,
    {
      html: sanitized.html,
      status: "published",
    },
    actor,
  );

  if (!updated) {
    return { ok: false, error: "Failed to update article." };
  }

  const now = new Date();
  const db = getDb();
  const [published] = await db
    .update(articles)
    .set({
      status: "published",
      publishedAt: now,
      modifiedAt: now,
      updatedAt: now,
      seo: {
        ...updated.seo,
        noindex: false,
        canonicalPath: updated.pathname,
      },
    })
    .where(eq(articles.id, articleId))
    .returning();

  const exportArticle = articleRowToExport(published);
  const validation = await validatePublishedArticle(exportArticle);

  if (!validation.ok) {
    await updateArticle(articleId, { status: "in_review" }, actor);
    await logPublish(articleId, actor, "publish_failed", validation.issues);
    return {
      ok: false,
      articleId,
      issues: validation.issues,
      error: "Quality gates failed.",
    };
  }

  revalidateCmsContent({
    pathname: published.pathname,
    categorySlugs: (published.categories ?? []).map((category) => category.slug),
    authorSlug: published.author?.slug ?? null,
  });

  await logPublish(articleId, actor, "published", validation.issues, "revalidate");

  await notifyTelegram(
    `Published: *${published.title}*\n${published.pathname}\nPublic pages revalidated.`,
  );

  return {
    ok: true,
    articleId,
    issues: validation.issues,
    revalidated: true,
  };
}

export async function submitForReview(articleId: string, actor: string): Promise<PublishResult> {
  const row = await getArticleById(articleId);
  if (!row) {
    return { ok: false, error: "Article not found." };
  }

  const sanitized = sanitizeCmsHtml(row.html, {
    id: row.id,
    title: row.title,
    pathname: row.pathname,
  });

  await updateArticle(articleId, { html: sanitized.html, status: "in_review" }, actor);
  await logPublish(articleId, actor, "submitted_for_review", []);

  const previewUrl = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/admin/preview/${articleId}`;
  await notifyTelegram(`Draft ready for review: *${row.title}*\n${previewUrl}`);

  return { ok: true, articleId };
}

async function logPublish(
  articleId: string,
  actor: string,
  action: string,
  validationReport: unknown,
  deployId?: string,
): Promise<void> {
  const db = getDb();
  await db.insert(publishLog).values({
    articleId,
    actor,
    action,
    validationReport: validationReport as Record<string, unknown>,
    deployId,
  });
}
