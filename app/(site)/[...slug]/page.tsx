import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleCard } from "@/components/ArticleCard";
import { ArticleRail, AfterArticleAds, ShareLinks } from "@/components/ArticleExtras";
import { HeroTitle } from "@/components/HeroTitle";
import { SafeHtml } from "@/components/SafeHtml";
import { getAdSettingsSafe } from "@/lib/ads/settings";
import {
  extractHeadings,
  formatDate,
  getContentBundle,
  getItemByPathname,
  getRelatedArticles,
  getTrendingArticles,
  pathnameToSegments,
  readingTime,
  siteName,
  siteUrl,
} from "@/lib/content";

type PageProps = {
  params: Promise<{
    slug: string[];
  }>;
};

export function generateStaticParams() {
  return getContentBundle().allPublicItems.map((item) => ({
    slug: pathnameToSegments(item.pathname),
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const item = getItemByPathname(`/${slug.join("/")}/`);

  if (!item) {
    return {};
  }

  const metadataImage = item.featuredImage?.src ?? item.seo.ogImage;
  const resolvedTitle = item.seo.title ?? item.title;

  return {
    title: resolvedTitle,
    description: item.seo.description ?? item.excerpt,
    alternates: {
      canonical: item.seo.canonicalPath,
    },
    openGraph: {
      title: resolvedTitle,
      description: item.seo.description ?? item.excerpt,
      url: `${siteUrl}${item.pathname}`,
      type: item.type === "article" ? "article" : "website",
      images: metadataImage ? [metadataImage] : undefined,
    },
    twitter: {
      card: metadataImage ? "summary_large_image" : "summary",
      title: resolvedTitle,
      description: item.seo.description ?? item.excerpt,
      images: metadataImage ? [metadataImage] : undefined,
    },
  };
}

export default async function ContentPage({ params }: PageProps) {
  const { slug } = await params;
  const item = getItemByPathname(`/${slug.join("/")}/`);

  if (!item) {
    notFound();
  }

  const primaryCategory = item.categories[0];
  const related = item.type === "article" ? getRelatedArticles(item) : [];
  const trending = item.type === "article" ? getTrendingArticles(item) : [];
  const headings = extractHeadings(item.content.html);
  const hasArticleRail = item.type === "article" || headings.length >= 3 || trending.length > 0;
  const hasHeroImage = Boolean(item.featuredImage);
  const adSettings = item.type === "article" ? await getAdSettingsSafe() : undefined;

  const meta = (
    <div className={`meta${hasHeroImage ? " article-meta--below-hero" : ""}`}>
      {item.author ? (
        <Link href={`/author/${item.author.slug}/`} rel="author">
          {item.author.name}
        </Link>
      ) : null}
      <time dateTime={item.publishedAt}>{formatDate(item.publishedAt)}</time>
      {item.modifiedAt ? <span>Updated {formatDate(item.modifiedAt)}</span> : null}
      <span>{readingTime(item.content.html)} min read</span>
    </div>
  );

  return (
    <main id="main" className="content-page">
      <article className="article-layout">
        <header className={`article-header${hasHeroImage ? " article-header--with-hero" : ""}`}>
          {primaryCategory ? (
            <Link className="eyebrow" href={`/category/${primaryCategory.slug}/`}>
              {primaryCategory.name}
            </Link>
          ) : null}
          {!hasHeroImage ? <h1>{item.title}</h1> : null}
          {!hasHeroImage ? meta : null}
        </header>

        {item.featuredImage ? (
          <>
            <figure className="article-hero-image article-hero-image--titled">
              <div className="article-hero-media">
                <img
                  src={item.featuredImage.src}
                  width={item.featuredImage.width}
                  height={item.featuredImage.height}
                  alt={item.featuredImage.alt}
                  loading="eager"
                  decoding="async"
                />
                <div className="article-hero-overlay">
                  <HeroTitle>{item.title}</HeroTitle>
                </div>
              </div>
              {item.featuredImage.caption ? <figcaption>{item.featuredImage.caption}</figcaption> : null}
            </figure>
            {meta}
          </>
        ) : null}

        <div
          className={`article-shell${hasArticleRail ? " article-shell--with-rail" : ""}`}
        >
          <SafeHtml
            html={item.content.html}
            injectAds={item.type === "article"}
            adSettings={adSettings}
          />
          {hasArticleRail ? <ArticleRail headings={headings} trending={trending} /> : null}
        </div>

        {item.type === "article" ? <AfterArticleAds /> : null}

        {item.type === "article" ? <ShareLinks title={item.title} pathname={item.pathname} /> : null}
      </article>

      {related.length > 0 ? (
        <section className="section related" aria-labelledby="related-title">
          <div className="section-heading">
            <p className="eyebrow">{siteName}</p>
            <h2 id="related-title">Related guides</h2>
          </div>
          <div className="card-grid">
            {related.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
