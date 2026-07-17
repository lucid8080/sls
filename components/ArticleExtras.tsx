import Link from "next/link";
import type { ContentItem } from "@/lib/content";
import { EzoicAd } from "@/components/ads/EzoicAd";

export function TableOfContents({ headings }: { headings: Array<{ id: string; text: string }> }) {
  if (headings.length < 3) {
    return null;
  }

  return (
    <nav className="toc" aria-label="Table of contents">
      <p>In this guide</p>
      <ol>
        {headings.map((heading) => (
          <li key={heading.id}>
            <a href={`#${heading.id}`}>{heading.text}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function AdPlaceholder() {
  return <EzoicAd placementKey="sidebar_primary" className="article-ad" />;
}

export function SidebarBottomAd() {
  return <EzoicAd placementKey="sidebar_bottom" className="article-ad" />;
}

export function AfterArticleAds() {
  return (
    <div className="article-after-ads">
      <EzoicAd placementKey="after_content" className="article-ad article-ad--wide" />
      <EzoicAd placementKey="native_bottom" className="article-ad article-ad--wide" />
    </div>
  );
}

export function TrendingArticles({ articles }: { articles: ContentItem[] }) {
  if (articles.length === 0) {
    return null;
  }

  return (
    <section className="article-trending" aria-labelledby="trending-title">
      <p id="trending-title">Trending</p>
      <ol>
        {articles.map((article) => (
          <li key={article.id}>
            <Link href={article.pathname}>{article.title}</Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ArticleRail({
  headings,
  trending,
}: {
  headings: Array<{ id: string; text: string }>;
  trending: ContentItem[];
}) {
  const hasToc = headings.length >= 3;
  const hasTrending = trending.length > 0;

  return (
    <aside className="article-rail" aria-label="Article sidebar">
      <TableOfContents headings={headings} />
      <AdPlaceholder />
      {hasToc || hasTrending ? <SidebarBottomAd /> : null}
      <TrendingArticles articles={trending} />
    </aside>
  );
}

export function ShareLinks({ title, pathname }: { title: string; pathname: string }) {
  const encodedTitle = encodeURIComponent(title);
  const encodedPath = encodeURIComponent(`https://simplelifesaver.com${pathname}`);

  return (
    <div className="share-links" aria-label="Share this article">
      <span>Share</span>
      <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodedPath}`} rel="noopener noreferrer">
        Facebook
      </a>
      <a href={`https://twitter.com/intent/tweet?url=${encodedPath}&text=${encodedTitle}`} rel="noopener noreferrer">
        X
      </a>
      <a href={`mailto:?subject=${encodedTitle}&body=${encodedPath}`}>Email</a>
    </div>
  );
}

export function NewsletterCta() {
  return (
    <section className="newsletter" aria-labelledby="newsletter-title">
      <div>
        <p className="eyebrow">Coming Soon</p>
        <h2 id="newsletter-title">Get practical guides in your inbox</h2>
        <p>This placeholder is disabled until an email provider and privacy language are configured.</p>
      </div>
      <form aria-label="Newsletter placeholder">
        <label htmlFor="newsletter-email">Email address</label>
        <input id="newsletter-email" type="email" placeholder="you@example.com" disabled />
        <button type="button" disabled>
          Not configured
        </button>
      </form>
    </section>
  );
}

export function TopicLink({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link className="topic-card" href={href}>
      <span>{title}</span>
      <p>{description}</p>
    </Link>
  );
}
