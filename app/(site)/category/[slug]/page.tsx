import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleCard } from "@/components/ArticleCard";
import { getArticlesByCategory, getCategory, getContentBundle, siteName } from "@/lib/content";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

/** Category archives can appear after CMS publish without a full redeploy. */
export const dynamicParams = true;

export async function generateStaticParams() {
  const bundle = await getContentBundle();
  return bundle.categories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);

  if (!category) {
    return {};
  }

  return {
    title: `${category.name} Guides`,
    description: `Practical ${category.name.toLowerCase()} guides from ${siteName}.`,
  };
}

export default async function CategoryPage({ params }: PageProps) {
  const { slug } = await params;
  const category = await getCategory(slug);

  if (!category) {
    notFound();
  }

  const articles = await getArticlesByCategory(category.slug);

  return (
    <main id="main">
      <section className="archive-header">
        <h1>{category.name}</h1>
        <p>{articles.length} practical guides for this topic.</p>
      </section>
      <section className="section">
        <div className="card-grid">
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      </section>
    </main>
  );
}
