import Link from "next/link";
import type { Author } from "@/lib/content";

type AuthorBioProps = {
  author: Author;
  /** `profile` = archive about card; `socials` = icon row only (bio already shown in byline). */
  variant?: "profile" | "socials";
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function socialLinks(author: Author) {
  return [
    { key: "twitter", label: "X", href: author.socials?.twitter },
    { key: "linkedin", label: "LinkedIn", href: author.socials?.linkedin },
    { key: "facebook", label: "Facebook", href: author.socials?.facebook },
    { key: "website", label: "Website", href: author.socials?.website },
  ].filter((item): item is { key: string; label: string; href: string } => Boolean(item.href));
}

export function AuthorBio({ author, variant = "profile" }: AuthorBioProps) {
  const socials = socialLinks(author);
  const bio = author.bio?.trim();

  if (variant === "socials") {
    if (socials.length === 0) return null;
    return (
      <ul className="author-bio__socials author-bio__socials--standalone" aria-label="Author on social media">
        {socials.map((social) => (
          <li key={social.key}>
            <a href={social.href} target="_blank" rel="noopener noreferrer">
              <SocialIcon name={social.key} />
              <span className="visually-hidden">{social.label}</span>
            </a>
          </li>
        ))}
      </ul>
    );
  }

  if (!bio && socials.length === 0) {
    return null;
  }

  return (
    <section className="author-bio" aria-labelledby={`author-bio-${author.slug}`}>
      <div className="author-bio__media">
        {author.avatarPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="author-bio__avatar"
            src={author.avatarPath}
            alt=""
            width={88}
            height={88}
          />
        ) : (
          <span className="author-bio__avatar author-bio__avatar--fallback" aria-hidden>
            {initials(author.name)}
          </span>
        )}
      </div>
      <div className="author-bio__body">
        <h2 id={`author-bio-${author.slug}`} className="author-bio__title">
          About{" "}
          <Link href={`/author/${author.slug}/`} rel="author">
            {author.name}
          </Link>
        </h2>
        {bio ? <p className="author-bio__text">{bio}</p> : null}
        {socials.length > 0 ? (
          <ul className="author-bio__socials">
            {socials.map((social) => (
              <li key={social.key}>
                <a href={social.href} target="_blank" rel="noopener noreferrer">
                  <SocialIcon name={social.key} />
                  <span className="visually-hidden">{social.label}</span>
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

function SocialIcon({ name }: { name: string }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "currentColor",
    "aria-hidden": true as const,
  };

  if (name === "twitter") {
    return (
      <svg {...common}>
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.924L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
      </svg>
    );
  }

  if (name === "linkedin") {
    return (
      <svg {...common}>
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    );
  }

  if (name === "facebook") {
    return (
      <svg {...common}>
        <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
    </svg>
  );
}
