DO $$ BEGIN
  CREATE TYPE "affiliate_network" AS ENUM ('amazon', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "affiliate_link_source" AS ENUM ('scanned', 'manual', 'both');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "affiliate_tag_status" AS ENUM ('ok', 'missing_tag', 'not_applicable');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "affiliate_live_status" AS ENUM (
    'unchecked',
    'active',
    'dead',
    'redirected',
    'blocked',
    'error'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "affiliate_article_source" AS ENUM ('database', 'recovered', 'catalog');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "affiliate_links" (
  "id" text PRIMARY KEY NOT NULL,
  "url" text NOT NULL,
  "normalized_url" text NOT NULL,
  "network" "affiliate_network" DEFAULT 'other' NOT NULL,
  "asin" text,
  "affiliate_tag" text,
  "label" text,
  "notes" text,
  "source" "affiliate_link_source" DEFAULT 'scanned' NOT NULL,
  "tag_status" "affiliate_tag_status" DEFAULT 'not_applicable' NOT NULL,
  "live_status" "affiliate_live_status" DEFAULT 'unchecked' NOT NULL,
  "live_status_code" integer,
  "live_final_url" text,
  "live_checked_at" timestamp with time zone,
  "live_error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_links_normalized_url_uidx"
  ON "affiliate_links" ("normalized_url");
CREATE INDEX IF NOT EXISTS "affiliate_links_network_idx"
  ON "affiliate_links" ("network");
CREATE INDEX IF NOT EXISTS "affiliate_links_tag_status_idx"
  ON "affiliate_links" ("tag_status");
CREATE INDEX IF NOT EXISTS "affiliate_links_live_status_idx"
  ON "affiliate_links" ("live_status");

CREATE TABLE IF NOT EXISTS "affiliate_link_articles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "link_id" text NOT NULL REFERENCES "affiliate_links"("id") ON DELETE cascade,
  "article_id" text NOT NULL,
  "article_title" text NOT NULL,
  "pathname" text NOT NULL,
  "article_source" "affiliate_article_source" NOT NULL,
  "anchor_text" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_link_articles_link_article_uidx"
  ON "affiliate_link_articles" ("link_id", "article_id", "article_source");
CREATE INDEX IF NOT EXISTS "affiliate_link_articles_link_id_idx"
  ON "affiliate_link_articles" ("link_id");
CREATE INDEX IF NOT EXISTS "affiliate_link_articles_article_id_idx"
  ON "affiliate_link_articles" ("article_id");
