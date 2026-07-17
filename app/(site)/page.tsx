import Link from "next/link";
import { ArticleCard } from "@/components/ArticleCard";
import { NewsletterCta, TopicLink } from "@/components/ArticleExtras";
import { getContentBundle } from "@/lib/content";

export default function HomePage() {
  const { articles } = getContentBundle();
  const [featured, ...latest] = articles;

  return (
    <main id="main">
      <section className="hero">
        <div>
          <p className="eyebrow">Practical home intelligence</p>
          <h1>Make your home easier to cook in, clean, manage, and enjoy.</h1>
          <p>
            Simple Life Saver brings together tested, straightforward guides for smart cooking, cleaning,
            appliances, robot vacuums, and everyday home decisions.
          </p>
          <div className="hero-actions">
            <Link className="button" href="/search/">
              Search guides
            </Link>
            <Link className="button button-secondary" href="/category/home-care/">
              Browse home care
            </Link>
          </div>
        </div>
        {featured ? <ArticleCard article={featured} featured /> : null}
      </section>

      <section className="section" aria-labelledby="topics-title">
        <div className="section-heading">
          <p className="eyebrow">Start with a topic</p>
          <h2 id="topics-title">Find the right guide faster</h2>
        </div>
        <div className="topic-grid">
          <TopicLink href="/category/smart-cooking/" title="Smart Cooking" description="Instant Pot, kitchen tools, and practical meal shortcuts." />
          <TopicLink href="/category/home-care/" title="Home Care" description="Maintenance, organization, and home problem solving." />
          <TopicLink href="/category/smart-cleaning/" title="Smart Cleaning" description="Cleaning tools, routines, floor care, and robot vacuums." />
          <TopicLink href="/category/robot-vacuums/" title="Robot Vacuums" description="Buying, setup, troubleshooting, and maintenance guides." />
          <TopicLink href="/category/appliances/" title="Appliances" description="Helpful guides for choosing and using home appliances." />
          <TopicLink href="/category/travel/" title="Travel" description="Packing, luggage, and practical preparation advice." />
        </div>
      </section>

      <section className="section" aria-labelledby="latest-title">
        <div className="section-heading">
          <p className="eyebrow">Latest guides</p>
          <h2 id="latest-title">Fresh practical advice</h2>
        </div>
        <div className="card-grid">
          {latest.slice(0, 9).map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      </section>

      <NewsletterCta />
    </main>
  );
}
