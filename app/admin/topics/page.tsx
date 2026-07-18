import Link from "next/link";
import { isDatabaseConfigured } from "@/lib/cms/db/client";
import { TOPIC_PRIORITIES, TOPIC_STATUSES, TOPIC_STATUS_LABELS } from "@/lib/cms/topics/constants";
import { countTopicsByStatus, listTopics } from "@/lib/cms/topics/repository";
import { topicListFiltersSchema } from "@/lib/cms/topics/schemas";
import { TopicCaptureForm } from "./_components/topic-capture-form";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const views = [
  ["", "All"],
  ["inbox", "Inbox"],
  ["processing", "Processing"],
  ["needs_review", "Needs Review"],
  ["approved", "Approved"],
  ["scheduled", "Scheduled"],
  ["published", "Published"],
  ["archived", "Archived"],
] as const;

function queryHref(
  current: Record<string, string | string[] | undefined>,
  changes: Record<string, string | undefined>,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    if (typeof value === "string" && value) params.set(key, value);
  }
  for (const [key, value] of Object.entries(changes)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  return `/admin/topics${params.size ? `?${params}` : ""}`;
}

export default async function TopicsPage({ searchParams }: PageProps) {
  const rawParams = await searchParams;
  const flatParams = Object.fromEntries(
    Object.entries(rawParams).flatMap(([key, value]) =>
      typeof value === "string" ? [[key, value]] : [],
    ),
  );
  const parsed = topicListFiltersSchema.safeParse(flatParams);
  const filters = parsed.success ? parsed.data : topicListFiltersSchema.parse({});
  const configured = isDatabaseConfigured();
  const data = configured
    ? await Promise.all([listTopics(filters), countTopicsByStatus()])
    : null;
  const result = data?.[0];
  const counts = data?.[1];
  const totalPages = result ? Math.max(Math.ceil(result.total / result.pageSize), 1) : 1;

  return (
    <div className="admin-grid topic-inbox">
      <header className="topic-page-header">
        <div>
          <h1>Topic Inbox</h1>
          <p>Capture, research, organize, and convert ideas into articles.</p>
        </div>
        <a className="admin-button" href="#add-topic">
          Add Topic
        </a>
      </header>

      {!configured ? (
        <section className="admin-card">
          <p className="admin-error" role="alert">
            DATABASE_URL is not configured. Run the Topic Inbox schema deployment before using
            this page.
          </p>
        </section>
      ) : (
        <>
          <section className="topic-summary-grid" aria-label="Topic status summary">
            {(["inbox", "processing", "needs_review", "approved", "scheduled"] as const).map(
              (status) => (
                <Link
                  className="admin-card topic-summary-card"
                  href={queryHref(rawParams, { status, page: undefined })}
                  key={status}
                >
                  <span>{TOPIC_STATUS_LABELS[status]}</span>
                  <strong>{counts?.[status] ?? 0}</strong>
                </Link>
              ),
            )}
          </section>

          <div id="add-topic">
            <TopicCaptureForm />
          </div>

          <section className="admin-card">
            <nav className="topic-view-tabs" aria-label="Topic Inbox views">
              {views.map(([status, label]) => (
                <Link
                  key={label}
                  className={(filters.status ?? "") === status ? "active" : ""}
                  href={queryHref(rawParams, { status: status || undefined, page: undefined })}
                >
                  {label}
                </Link>
              ))}
            </nav>

            <form className="topic-filter-bar" method="get">
              <label>
                Search
                <input
                  className="admin-input"
                  name="search"
                  defaultValue={filters.search}
                  placeholder="Title, keyword, or summary"
                />
              </label>
              <label>
                Status
                <select className="admin-select" name="status" defaultValue={filters.status ?? ""}>
                  <option value="">All statuses</option>
                  {TOPIC_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {TOPIC_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Category
                <input className="admin-input" name="category" defaultValue={filters.category} />
              </label>
              <label>
                Source platform
                <select
                  className="admin-select"
                  name="platform"
                  defaultValue={filters.platform ?? ""}
                >
                  <option value="">All platforms</option>
                  <option value="generic_web">Web</option>
                  <option value="youtube">YouTube</option>
                  <option value="x">X</option>
                  <option value="twitter">Twitter</option>
                  <option value="instagram">Instagram</option>
                  <option value="tiktok">TikTok</option>
                  <option value="reddit">Reddit</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="facebook">Facebook</option>
                  <option value="threads">Threads</option>
                </select>
              </label>
              <label>
                Priority
                <select
                  className="admin-select"
                  name="priority"
                  defaultValue={filters.priority ?? ""}
                >
                  <option value="">All priorities</option>
                  {TOPIC_PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority[0].toUpperCase() + priority.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Sort
                <select className="admin-select" name="sort" defaultValue={filters.sort}>
                  <option value="updated_at">Last updated</option>
                  <option value="created_at">Date added</option>
                  <option value="priority">Priority</option>
                  <option value="status">Status</option>
                  <option value="title">Title</option>
                </select>
              </label>
              <button className="admin-button secondary" type="submit">
                Apply filters
              </button>
            </form>

            {result?.items.length ? (
              <div className="topic-table-wrap">
                <table className="admin-table topic-table">
                  <thead>
                    <tr>
                      <th scope="col">Topic</th>
                      <th scope="col">Source</th>
                      <th scope="col">Status</th>
                      <th scope="col">Category</th>
                      <th scope="col">Keyword</th>
                      <th scope="col">Priority</th>
                      <th scope="col">Score</th>
                      <th scope="col">Updated</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.items.map((topic) => (
                      <tr key={topic.id}>
                        <td>
                          <Link className="topic-title-link" href={`/admin/topics/${topic.id}`}>
                            {topic.workingTitle || topic.title}
                          </Link>
                          {topic.angle ? <small>{topic.angle}</small> : null}
                        </td>
                        <td>
                          {topic.primarySource?.platform ||
                            topic.primarySource?.sourceType ||
                            "Manual"}
                          {topic.primarySource?.domain ? (
                            <small>{topic.primarySource.domain}</small>
                          ) : null}
                          {topic.primarySource?.sourceUrl ? (
                            <small>
                              Source: {topic.primarySource.fetchStatus.replaceAll("_", " ")}
                            </small>
                          ) : null}
                        </td>
                        <td>
                          <span className={`admin-status ${topic.status}`}>
                            {TOPIC_STATUS_LABELS[topic.status]}
                          </span>
                        </td>
                        <td>{topic.category || "—"}</td>
                        <td>{topic.primaryKeyword || "—"}</td>
                        <td className="topic-capitalize">{topic.priority}</td>
                        <td>{topic.relevanceScore ?? "—"}</td>
                        <td>{new Date(topic.updatedAt).toLocaleDateString()}</td>
                        <td>
                          <Link href={`/admin/topics/${topic.id}`}>Review</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="topic-empty-state">
                {Object.keys(flatParams).length ? (
                  <>
                    <h2>No topics match these filters.</h2>
                    <Link href="/admin/topics">Clear filters</Link>
                  </>
                ) : (
                  <>
                    <h2>Your Topic Inbox is empty.</h2>
                    <p>
                      Add a rough idea or keyword. You can organize and refine it later.
                    </p>
                  </>
                )}
              </div>
            )}

            {result && result.total > 0 ? (
              <nav className="topic-pagination" aria-label="Topic list pagination">
                <Link
                  aria-disabled={filters.page <= 1}
                  className={filters.page <= 1 ? "disabled" : ""}
                  href={queryHref(rawParams, {
                    page: String(Math.max(filters.page - 1, 1)),
                  })}
                >
                  Previous
                </Link>
                <span>
                  Page {filters.page} of {totalPages} · {result.total} topics
                </span>
                <Link
                  aria-disabled={filters.page >= totalPages}
                  className={filters.page >= totalPages ? "disabled" : ""}
                  href={queryHref(rawParams, {
                    page: String(Math.min(filters.page + 1, totalPages)),
                  })}
                >
                  Next
                </Link>
              </nav>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
