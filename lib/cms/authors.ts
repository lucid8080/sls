import { randomBytes } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/cms/db/client";
import { articles, authors, type AuthorInsert, type AuthorRow, type AuthorSocials } from "@/lib/cms/db/schema";
import { slugifyTitle, type Author } from "@/lib/cms/schemas";

export type AuthorInput = {
  name: string;
  slug?: string;
  bio?: string | null;
  avatarPath?: string | null;
  socials?: AuthorSocials | null;
};

function normalizeSocials(socials?: AuthorSocials | null): AuthorSocials {
  if (!socials) return {};
  const next: AuthorSocials = {};
  for (const key of ["twitter", "linkedin", "facebook", "website"] as const) {
    const value = socials[key]?.trim();
    if (value) next[key] = value;
  }
  return next;
}

function normalizeAvatarPath(path?: string | null): string | null {
  const trimmed = path?.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function authorRowToExport(row: AuthorRow): Author {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    bio: row.bio ?? undefined,
    avatarPath: row.avatarPath ?? undefined,
    socials: Object.keys(row.socials ?? {}).length > 0 ? row.socials : undefined,
  };
}

export function serializeAuthor(row: AuthorRow) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    bio: row.bio,
    avatarPath: row.avatarPath,
    socials: row.socials ?? {},
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listAuthors(): Promise<AuthorRow[]> {
  await ensureAuthorsSeeded();
  const db = getDb();
  return db.select().from(authors).orderBy(asc(authors.name));
}

export async function getAuthorById(id: string): Promise<AuthorRow | null> {
  const db = getDb();
  const [row] = await db.select().from(authors).where(eq(authors.id, id)).limit(1);
  return row ?? null;
}

export async function getAuthorBySlug(slug: string): Promise<AuthorRow | null> {
  const db = getDb();
  const [row] = await db.select().from(authors).where(eq(authors.slug, slug)).limit(1);
  return row ?? null;
}

export async function createAuthor(input: AuthorInput): Promise<AuthorRow> {
  const name = input.name.trim();
  if (!name) {
    throw new Error("name is required.");
  }

  const slug = (input.slug?.trim() || slugifyTitle(name)).replace(/^-+|-+$/g, "");
  if (!slug) {
    throw new Error("slug is required.");
  }

  const existing = await getAuthorBySlug(slug);
  if (existing) {
    throw new Error(`An author with slug "${slug}" already exists.`);
  }

  const db = getDb();
  const id = `author_${randomBytes(6).toString("hex")}`;
  const [row] = await db
    .insert(authors)
    .values({
      id,
      name,
      slug,
      bio: input.bio?.trim() || null,
      avatarPath: normalizeAvatarPath(input.avatarPath),
      socials: normalizeSocials(input.socials),
    } satisfies AuthorInsert)
    .returning();

  return row;
}

export async function updateAuthor(id: string, input: Partial<AuthorInput>): Promise<AuthorRow> {
  const existing = await getAuthorById(id);
  if (!existing) {
    throw new Error("Author not found.");
  }

  const name = input.name !== undefined ? input.name.trim() : existing.name;
  if (!name) {
    throw new Error("name is required.");
  }

  const slug =
    input.slug !== undefined
      ? (input.slug.trim() || slugifyTitle(name)).replace(/^-+|-+$/g, "")
      : existing.slug;
  if (!slug) {
    throw new Error("slug is required.");
  }

  if (slug !== existing.slug) {
    const conflict = await getAuthorBySlug(slug);
    if (conflict && conflict.id !== id) {
      throw new Error(`An author with slug "${slug}" already exists.`);
    }
  }

  const db = getDb();
  const [row] = await db
    .update(authors)
    .set({
      name,
      slug,
      bio: input.bio === undefined ? existing.bio : input.bio?.trim() || null,
      avatarPath:
        input.avatarPath === undefined ? existing.avatarPath : normalizeAvatarPath(input.avatarPath),
      socials: input.socials === undefined ? existing.socials : normalizeSocials(input.socials),
      updatedAt: new Date(),
    })
    .where(eq(authors.id, id))
    .returning();

  return row;
}

export async function countArticlesReferencingAuthor(authorId: string): Promise<number> {
  const db = getDb();
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(articles)
    .where(sql`${articles.author}->>'id' = ${authorId}`);
  return result[0]?.count ?? 0;
}

export async function deleteAuthor(id: string): Promise<void> {
  const existing = await getAuthorById(id);
  if (!existing) {
    throw new Error("Author not found.");
  }

  const references = await countArticlesReferencingAuthor(id);
  if (references > 0) {
    throw new Error(
      `Cannot delete author "${existing.name}": ${references} CMS article(s) still reference this author. Reassign those articles first.`,
    );
  }

  const db = getDb();
  await db.delete(authors).where(eq(authors.id, id));
}

export async function listAuthorsForExport(): Promise<Author[]> {
  await ensureAuthorsSeeded();
  const rows = await listAuthors();
  return rows.map(authorRowToExport);
}

let seedPromise: Promise<void> | null = null;

export async function ensureAuthorsSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = seedAuthorsFromContentFiles().catch((error) => {
      seedPromise = null;
      throw error;
    });
  }
  await seedPromise;
}

async function seedAuthorsFromContentFiles(): Promise<void> {
  const db = getDb();
  const existing = await db.select({ id: authors.id }).from(authors).limit(1);
  if (existing.length > 0) {
    return;
  }

  const authorsDir = join(process.cwd(), "content", "authors");
  if (!existsSync(authorsDir)) {
    return;
  }

  const files = readdirSync(authorsDir).filter((name) => name.endsWith(".json"));
  const values: AuthorInsert[] = [];

  for (const file of files) {
    try {
      const parsed = JSON.parse(readFileSync(join(authorsDir, file), "utf8")) as {
        id?: string;
        name?: string;
        slug?: string;
      };
      if (!parsed.id || !parsed.name || !parsed.slug) continue;
      values.push({
        id: parsed.id,
        name: parsed.name,
        slug: parsed.slug,
        bio: null,
        avatarPath: null,
        socials: {},
      });
    } catch {
      // Skip unreadable seed files; admin can create authors manually.
    }
  }

  if (values.length === 0) {
    return;
  }

  await db.insert(authors).values(values).onConflictDoNothing();
}
