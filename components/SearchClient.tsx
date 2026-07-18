"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { searchIndex, type SearchIndexEntry } from "@/lib/search-index";

function formatDate(value?: string): string {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

type SearchClientProps = {
  index: SearchIndexEntry[];
};

export function SearchClient({ index }: SearchClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryFromUrl = searchParams.get("q") ?? "";
  const [draft, setDraft] = useState(queryFromUrl);

  useEffect(() => {
    setDraft(queryFromUrl);
  }, [queryFromUrl]);

  const results = useMemo(() => searchIndex(queryFromUrl, index), [index, queryFromUrl]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = draft.trim();
    const href = nextQuery ? `/search/?q=${encodeURIComponent(nextQuery)}` : "/search/";
    router.replace(href);
  }

  return (
    <>
      <section className="archive-header">
        <p className="eyebrow">Search</p>
        <h1>Find practical guides</h1>
        <form className="search-form" action="/search/" onSubmit={onSubmit}>
          <label htmlFor="q">Search articles</label>
          <div>
            <input
              id="q"
              name="q"
              type="search"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Try robot vacuum or Instant Pot"
            />
            <button type="submit">Search</button>
          </div>
        </form>
      </section>

      {queryFromUrl ? (
        <section className="section" aria-live="polite">
          <div className="section-heading">
            <p className="eyebrow">{results.length} results</p>
            <h2>Results for “{queryFromUrl}”</h2>
          </div>
          {results.length > 0 ? (
            <div className="card-grid">
              {results.map((article) => (
                <SearchResultCard key={article.id} article={article} />
              ))}
            </div>
          ) : (
            <p>No matching guides found. Try a broader home, cleaning, cooking, or appliance topic.</p>
          )}
        </section>
      ) : null}
    </>
  );
}

function SearchResultCard({ article }: { article: SearchIndexEntry }) {
  return (
    <article className="article-card">
      {article.imageSrc ? (
        <Link
          className="article-card-image"
          href={article.pathname}
          aria-label={article.title}
          prefetch={false}
        >
          <img
            src={article.imageSrc}
            width={article.imageWidth}
            height={article.imageHeight}
            alt=""
            loading="lazy"
            decoding="async"
          />
        </Link>
      ) : null}
      {article.categorySlug && article.categoryName ? (
        <Link className="eyebrow" href={`/category/${article.categorySlug}/`} prefetch={false}>
          {article.categoryName}
        </Link>
      ) : null}
      <h3>
        <Link href={article.pathname} prefetch={false}>
          {article.title}
        </Link>
      </h3>
      <div className="meta">
        {article.authorName ? <span>{article.authorName}</span> : null}
        <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>
        <span>{article.readingMinutes} min read</span>
      </div>
    </article>
  );
}
