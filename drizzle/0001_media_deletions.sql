CREATE TABLE IF NOT EXISTS "media_deletions" (
  "public_path" text PRIMARY KEY NOT NULL,
  "deleted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_by" text
);
