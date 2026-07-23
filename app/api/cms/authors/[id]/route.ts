import { auth } from "@/lib/auth";
import {
  deleteAuthor,
  getAuthorById,
  serializeAuthor,
  updateAuthor,
} from "@/lib/cms/authors";
import { isDatabaseConfigured } from "@/lib/cms/db/client";
import type { AuthorSocials } from "@/lib/cms/db/schema";
import { exportCmsBundle } from "@/lib/cms/export";
import { jsonError, jsonOk, readJsonBody } from "@/lib/cms/http";
import { triggerDeployHook } from "@/lib/cms/publish";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  if (!isDatabaseConfigured()) {
    return jsonError("DATABASE_URL is not configured.", 503);
  }

  const session = await auth();
  if (!session) {
    return jsonError("Unauthorized.", 401);
  }

  const { id } = await context.params;
  const row = await getAuthorById(id);
  if (!row) {
    return jsonError("Author not found.", 404);
  }

  return jsonOk({ author: serializeAuthor(row) });
}

export async function PATCH(request: Request, context: RouteContext) {
  if (!isDatabaseConfigured()) {
    return jsonError("DATABASE_URL is not configured.", 503);
  }

  const session = await auth();
  if (!session) {
    return jsonError("Unauthorized.", 401);
  }

  const { id } = await context.params;
  const body = await readJsonBody<{
    name?: string;
    slug?: string;
    bio?: string | null;
    avatarPath?: string | null;
    socials?: AuthorSocials | null;
  }>(request);

  if (!body) {
    return jsonError("Invalid JSON body.");
  }

  try {
    const row = await updateAuthor(id, body);
    const exported = await exportCmsBundle();
    const deployTriggered = await triggerDeployHook();
    return jsonOk({
      author: serializeAuthor(row),
      exportCount: exported.count,
      deployTriggered,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update author.";
    if (message === "Author not found.") {
      return jsonError(message, 404);
    }
    const status = message.includes("already exists") ? 409 : 400;
    return jsonError(message, status);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  if (!isDatabaseConfigured()) {
    return jsonError("DATABASE_URL is not configured.", 503);
  }

  const session = await auth();
  if (!session) {
    return jsonError("Unauthorized.", 401);
  }

  const { id } = await context.params;

  try {
    await deleteAuthor(id);
    const exported = await exportCmsBundle();
    const deployTriggered = await triggerDeployHook();
    return jsonOk({ ok: true, exportCount: exported.count, deployTriggered });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete author.";
    if (message === "Author not found.") {
      return jsonError(message, 404);
    }
    if (message.includes("Cannot delete")) {
      return jsonError(message, 409);
    }
    return jsonError(message, 400);
  }
}
