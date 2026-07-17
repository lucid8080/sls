import Link from "next/link";
import { listArticles } from "@/lib/cms/articles";
import { isDatabaseConfigured } from "@/lib/cms/db/client";
import { listPendingAgentJobs } from "@/lib/cms/articles";

export default async function AdminDashboardPage() {
  if (!isDatabaseConfigured()) {
    return (
      <div className="admin-grid">
        <section className="admin-card">
          <h1>CMS Dashboard</h1>
          <p>
            Configure <code>DATABASE_URL</code> and run <code>npm run db:push</code> to enable the editorial CMS.
          </p>
        </section>
      </div>
    );
  }

  const [drafts, inReview, published, jobs] = await Promise.all([
    listArticles({ status: "draft", limit: 5 }),
    listArticles({ status: "in_review", limit: 5 }),
    listArticles({ status: "published", limit: 5 }),
    listPendingAgentJobs(5),
  ]);

  return (
    <div className="admin-grid">
      <section className="admin-card">
        <h1>CMS Dashboard</h1>
        <p>Manage articles, calendar slots, agent jobs, and autopilot publishing.</p>
        <p>
          <Link className="admin-button" href="/admin/articles/new">
            New article
          </Link>
        </p>
      </section>

      <div className="admin-grid two">
        <section className="admin-card">
          <h2>Drafts</h2>
          <ul>
            {drafts.map((article) => (
              <li key={article.id}>
                <Link href={`/admin/articles/${article.id}`}>{article.title}</Link>
              </li>
            ))}
          </ul>
        </section>
        <section className="admin-card">
          <h2>In review</h2>
          <ul>
            {inReview.map((article) => (
              <li key={article.id}>
                <Link href={`/admin/articles/${article.id}`}>{article.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="admin-grid two">
        <section className="admin-card">
          <h2>Recently published</h2>
          <ul>
            {published.map((article) => (
              <li key={article.id}>
                <Link href={`/admin/articles/${article.id}`}>{article.title}</Link>
              </li>
            ))}
          </ul>
        </section>
        <section className="admin-card">
          <h2>Pending agent jobs</h2>
          <ul>
            {jobs.map((job) => (
              <li key={job.id}>
                {job.type} — {String((job.payload as { topic?: string }).topic ?? job.id)}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
