import { auth } from "@/lib/auth";
import { createAuthor, listAuthors, serializeAuthor } from "@/lib/cms/authors";
import { isDatabaseConfigured } from "@/lib/cms/db/client";
import { jsonError, jsonOk, readJsonBody } from "@/lib/cms/http";
import { revalidateCmsContent } from "@/lib/cms/revalidate-content";
import type { AuthorSocials } from "@/lib/cms/db/schema";

export async function GET() {
  if (!isDatabaseConfigured()) {
    return jsonError("DATABASE_URL is not configured.", 503);
  }

  const session = await auth();
  if (!session) {
    return jsonError("Unauthorized.", 401);
  }

  try {
    const rows = await listAuthors();
    return jsonOk({ authors: rows.map(serializeAuthor) });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to list authors.", 500);
  }
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return jsonError("DATABASE_URL is not configured.", 503);
  }

  const session = await auth();
  if (!session) {
    return jsonError("Unauthorized.", 401);
  }

  const body = await readJsonBody<{
    name: string;
    slug?: string;
    bio?: string | null;
    avatarPath?: string | null;
    socials?: AuthorSocials | null;
  }>(request);

  if (!body?.name) {
    return jsonError("name is required.");
  }

  try {
    const row = await createAuthor(body);
    revalidateCmsContent({ authorSlug: row.slug });
    return jsonOk(
      {
        author: serializeAuthor(row),
        revalidated: true,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create author.";
    const status = message.includes("already exists") ? 409 : 400;
    return jsonError(message, status);
  }
}
