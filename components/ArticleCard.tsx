import Link from "next/link";
import { ContentItem, formatDate, readingTime } from "@/lib/content";

type ArticleCardProps = {
  article: ContentItem;
  featured?: boolean;
};

export function ArticleCard({ article, featured = false }: ArticleCardProps) {
  const category = article.categories[0];
  const image = article.featuredImage?.variants?.card ?? article.featuredImage?.variants?.thumbnail ?? article.featuredImage;

  return (
    <article className={featured ? "article-card article-card-featured" : "article-card"}>
      {image ? (
        <Link className="article-card-image" href={article.pathname} aria-label={article.title}>
          <img src={image.src} width={image.width} height={image.height} alt="" loading="lazy" decoding="async" />
        </Link>
      ) : null}
      {category ? (
        <Link className="eyebrow" href={`/category/${category.slug}/`}>
          {category.name}
        </Link>
      ) : null}
      <h3>
        <Link href={article.pathname}>{article.title}</Link>
      </h3>
      <div className="meta">
        {article.author ? <span>{article.author.name}</span> : null}
        <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>
        <span>{readingTime(article.content.html)} min read</span>
      </div>
    </article>
  );
}
