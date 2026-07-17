import type { Metadata } from "next";
import { ArticleCard } from "@/components/ArticleCard";
import { searchContent } from "@/lib/content";

export const metadata: Metadata = {
  title: "Search",
  description: "Search recovered Simple Life Saver guides.",
};

type SearchPageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q = "" } = await searchParams;
  const results = searchContent(q);

  return (
    <main id="main">
      <section className="archive-header">
        <p className="eyebrow">Search</p>
        <h1>Find practical guides</h1>
        <form className="search-form" action="/search/">
          <label htmlFor="q">Search articles</label>
          <div>
            <input id="q" name="q" type="search" defaultValue={q} placeholder="Try robot vacuum or Instant Pot" />
            <button type="submit">Search</button>
          </div>
        </form>
      </section>

      {q ? (
        <section className="section" aria-live="polite">
          <div className="section-heading">
            <p className="eyebrow">{results.length} results</p>
            <h2>Results for “{q}”</h2>
          </div>
          {results.length > 0 ? (
            <div className="card-grid">
              {results.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          ) : (
            <p>No matching guides found. Try a broader home, cleaning, cooking, or appliance topic.</p>
          )}
        </section>
      ) : null}
    </main>
  );
}
