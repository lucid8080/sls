import Link from "next/link";
import { notFound } from "next/navigation";
import { isDatabaseConfigured } from "@/lib/cms/db/client";
import { listTopicActivity } from "@/lib/cms/topics/activity-service";
import { getTopicWithSources } from "@/lib/cms/topics/repository";
import { topicIdSchema } from "@/lib/cms/topics/route-utils";
import { SourceFetchActions } from "../_components/source-fetch-actions";
import { TopicReviewForm } from "../_components/topic-review-form";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function TopicDetailPage({ params }: PageProps) {
  const { id } = await params;
  if (!topicIdSchema.safeParse(id).success) notFound();

  if (!isDatabaseConfigured()) {
    return (
      <section className="admin-card">
        <p className="admin-error">DATABASE_URL is not configured.</p>
      </section>
    );
  }

  const topic = await getTopicWithSources(id);
  if (!topic) notFound();
  const [topicActivity, sourceActivity] = await Promise.all([
    listTopicActivity({ topicId: id }),
    topic.primarySourceId
      ? listTopicActivity({ sourceId: topic.primarySourceId })
      : Promise.resolve([]),
  ]);
  const activity = [...new Map(
    [...topicActivity, ...sourceActivity].map((entry) => [entry.id, entry]),
  ).values()].sort((a, b) => b.createdAt.valueOf() - a.createdAt.valueOf());

  return (
    <div className="admin-grid topic-review-page">
      <header className="topic-page-header">
        <div>
          <Link href="/admin/topics">← Topic Inbox</Link>
          <h1>{topic.workingTitle || topic.title}</h1>
        </div>
      </header>

      <TopicReviewForm
        topic={{
          id: topic.id,
          title: topic.title,
          workingTitle: topic.workingTitle,
          summary: topic.summary,
          angle: topic.angle,
          readerProblem: topic.readerProblem,
          targetAudience: topic.targetAudience,
          category: topic.category,
          primaryKeyword: topic.primaryKeyword,
          secondaryKeywords: topic.secondaryKeywords,
          searchIntent: topic.searchIntent,
          relevanceScore: topic.relevanceScore,
          freshnessScore: topic.freshnessScore,
          evergreenScore: topic.evergreenScore,
          confidenceScore: topic.confidenceScore,
          priority: topic.priority,
          status: topic.status,
          editorNotes: topic.editorNotes,
          rejectionReason: topic.rejectionReason,
          articleId: topic.articleId,
          calendarEntryId: topic.calendarEntryId,
          updatedAt: topic.updatedAt.toISOString(),
        }}
      />

      <section className="admin-card">
        <h2>Original source</h2>
        {topic.primarySource ? (
          <dl className="topic-source-details">
            <div>
              <dt>Type</dt>
              <dd className="topic-capitalize">{topic.primarySource.sourceType}</dd>
            </div>
            <div>
              <dt>Fetch status</dt>
              <dd>
                <span className={`admin-status ${topic.primarySource.fetchStatus}`}>
                {topic.primarySource.fetchStatus.replaceAll("_", " ")}
                </span>
              </dd>
            </div>
            {topic.primarySource.fetchStatus === "limited" ? (
              <div className="topic-source-notice">
                <dt>Limited source details were available.</dt>
                <dd>
                  Add a note describing what interested you about this link, or retry fetching
                  its details.
                </dd>
              </div>
            ) : null}
            {topic.primarySource.fetchStatus === "failed" ? (
              <div className="topic-source-notice error">
                <dt>Source fetch failed</dt>
                <dd>
                  {topic.primarySource.fetchErrorMessage ||
                    "The source details could not be retrieved safely."}
                  {" "}
                  <a href="#topic-overview">Continue manually</a>
                </dd>
              </div>
            ) : null}
            {topic.primarySource.sourceUrl ? (
              <div>
                <dt>Original URL</dt>
                <dd>
                  <a href={topic.primarySource.sourceUrl} target="_blank" rel="noreferrer">
                    {topic.primarySource.sourceUrl} (opens externally)
                  </a>
                </dd>
              </div>
            ) : null}
            {topic.primarySource.pageTitle ? (
              <div>
                <dt>Page title</dt>
                <dd>{topic.primarySource.pageTitle}</dd>
              </div>
            ) : null}
            {topic.primarySource.pageDescription ? (
              <div>
                <dt>Description</dt>
                <dd>{topic.primarySource.pageDescription}</dd>
              </div>
            ) : null}
            {topic.primarySource.authorName ? (
              <div>
                <dt>Author</dt>
                <dd>{topic.primarySource.authorName}</dd>
              </div>
            ) : null}
            {topic.primarySource.publishedAt ? (
              <div>
                <dt>Published</dt>
                <dd>{topic.primarySource.publishedAt.toLocaleDateString()}</dd>
              </div>
            ) : null}
            {topic.primarySource.thumbnailUrl ? (
              <div>
                <dt>Source thumbnail</dt>
                <dd>
                  <a href={topic.primarySource.thumbnailUrl} target="_blank" rel="noreferrer">
                    Open thumbnail externally
                  </a>
                </dd>
              </div>
            ) : null}
            <div>
              <dt>Original text</dt>
              <dd>{topic.primarySource.originalText || topic.primarySource.inputValue}</dd>
            </div>
            {topic.primarySource.editorNotes ? (
              <div>
                <dt>Source notes</dt>
                <dd>{topic.primarySource.editorNotes}</dd>
              </div>
            ) : null}
            {topic.primarySource.extractedText ? (
              <div>
                <dt>Extracted text preview</dt>
                <dd className="topic-source-text-preview">
                  {topic.primarySource.extractedText.slice(0, 3000)}
                  {topic.primarySource.extractedText.length > 3000 ? "…" : ""}
                </dd>
              </div>
            ) : null}
            {topic.primarySource.sourceUrl ? (
              <div>
                <dt>Source actions</dt>
                <dd>
                  <SourceFetchActions
                    sourceId={topic.primarySource.id}
                    fetchStatus={topic.primarySource.fetchStatus}
                    sourceUrl={topic.primarySource.sourceUrl}
                  />
                </dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p>No Topic Source is linked.</p>
        )}
      </section>

      <section className="admin-card">
        <h2>Activity</h2>
        {activity.length ? (
          <ol className="topic-activity-list">
            {activity.map((entry) => (
              <li key={entry.id}>
                <div>
                  <strong>{entry.eventType.replaceAll("_", " ")}</strong>
                  <time dateTime={entry.createdAt.toISOString()}>
                    {entry.createdAt.toLocaleString()}
                  </time>
                </div>
                {entry.actorId ? <span>By {entry.actorId}</span> : null}
              </li>
            ))}
          </ol>
        ) : (
          <p>No activity recorded yet.</p>
        )}
      </section>
    </div>
  );
}
