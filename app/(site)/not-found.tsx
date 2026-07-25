import Link from "next/link";
import { getContentBundle } from "@/lib/content";

export default async function NotFound() {
  const bundle = await getContentBundle();
  const categories = bundle.categories.slice(0, 6);

  return (
    <main id="main" className="not-found">
      <p className="eyebrow">404</p>
      <h1>That guide was not found</h1>
      <p>
        The rebuilt site does not redirect missing pages to the homepage. Search or browse a reviewed topic
        instead.
      </p>
      <div className="hero-actions">
        <Link className="button" href="/search/">
          Search guides
        </Link>
        <Link className="button button-secondary" href="/">
          Go home
        </Link>
      </div>
      <div className="topic-grid compact">
        {categories.map((category) => (
          <Link className="topic-card" key={category.slug} href={`/category/${category.slug}/`}>
            <span>{category.name}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
