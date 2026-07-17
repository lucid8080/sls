import Image from "next/image";
import Link from "next/link";
import { getContentBundle, siteName } from "@/lib/content";

const navSlugs = ["smart-cooking", "home-care", "smart-cleaning", "robot-vacuums", "appliances", "travel"];

export function SiteHeader() {
  const categories = getContentBundle().categories.filter((category) => navSlugs.includes(category.slug));

  return (
    <header className="site-header">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="site-header-inner">
        <Link className="brand" href="/" aria-label={`${siteName} home`}>
          <Image
            className="brand-logo"
            src="/branding/logo2.png"
            alt={siteName}
            width={180}
            height={36}
            priority
          />
        </Link>
        <nav aria-label="Primary navigation">
          <ul>
            {categories.map((category) => (
              <li key={category.slug}>
                <Link href={`/category/${category.slug}/`}>{category.name}</Link>
              </li>
            ))}
            <li>
              <Link href="/search/">Search</Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div>
        <p className="footer-brand">{siteName}</p>
        <p>Practical guides for making home life easier, cleaner, and more efficient.</p>
      </div>
      <nav aria-label="Footer navigation">
        <Link href="/search/">Search</Link>
        <Link href="/rss.xml">RSS</Link>
        <Link href="/privacy-policy-2/">Privacy</Link>
        <Link href="/contact-us/">Contact</Link>
      </nav>
      <p className="fine-print">© {year} {siteName}. Rebuilt from validated static content.</p>
    </footer>
  );
}
