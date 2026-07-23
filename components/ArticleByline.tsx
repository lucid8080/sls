import Link from "next/link";
import { formatPublishedLabel, type Author } from "@/lib/content";

type ArticleBylineProps = {
  author?: Pick<Author, "id" | "name" | "slug" | "avatarPath" | "bio"> | null;
  publishedAt: string;
  readingMinutes?: number;
  className?: string;
};

function GenericAvatar() {
  return (
    <span className="article-byline__avatar article-byline__avatar--generic" aria-hidden>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
        <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v1.2h19.2v-1.2c0-3.2-6.4-4.8-9.6-4.8z" />
      </svg>
    </span>
  );
}

export function ArticleByline({
  author,
  publishedAt,
  readingMinutes,
  className = "",
}: ArticleBylineProps) {
  const publishedLabel = formatPublishedLabel(publishedAt);
  const bio = author?.bio?.trim();

  return (
    <div className={`article-byline${className ? ` ${className}` : ""}`}>
      <div className="article-byline__row">
        {author ? (
          author.avatarPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="article-byline__avatar"
              src={author.avatarPath}
              alt=""
              width={40}
              height={40}
            />
          ) : (
            <GenericAvatar />
          )
        ) : (
          <GenericAvatar />
        )}

        <p className="article-byline__meta">
          {author ? (
            <>
              <span className="article-byline__by">By </span>
              <Link href={`/author/${author.slug}/`} rel="author" className="article-byline__name">
                {author.name}
              </Link>
              <span className="article-byline__sep" aria-hidden>
                {" "}
                —{" "}
              </span>
            </>
          ) : null}
          <time className="article-byline__date" dateTime={publishedAt}>
            {publishedLabel}
          </time>
          {typeof readingMinutes === "number" ? (
            <>
              <span className="article-byline__sep" aria-hidden>
                {" "}
                —{" "}
              </span>
              <span className="article-byline__read">{readingMinutes} min read</span>
            </>
          ) : null}
        </p>
      </div>
      {bio ? <p className="article-byline__bio">{bio}</p> : null}
    </div>
  );
}
