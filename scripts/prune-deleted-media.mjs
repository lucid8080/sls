import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

const root = process.cwd();
const manifestPath = join(root, "data", "media-accepted.json");

function normalizePath(path) {
  return path.replace(/\/$/, "").toLowerCase();
}

async function loadDeletedPaths() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to load media_deletions.");
  }

  const sql = neon(databaseUrl);
  const rows = await sql`SELECT public_path FROM media_deletions`;
  return new Set(rows.map((row) => normalizePath(row.public_path)));
}

function pruneManifest(deletedPaths) {
  if (!existsSync(manifestPath)) {
    console.log(`Manifest not found: ${manifestPath}`);
    return 0;
  }

  const parsed = JSON.parse(readFileSync(manifestPath, "utf8"));
  const filtered = parsed.filter((item) => {
    if (!item.outputPath) return true;
    return !deletedPaths.has(normalizePath(`/${item.outputPath.replace(/\\/g, "/")}`));
  });

  if (filtered.length !== parsed.length) {
    writeFileSync(manifestPath, `${JSON.stringify(filtered, null, 2)}\n`, "utf8");
  }

  return parsed.length - filtered.length;
}

function prunePublicFiles(deletedPaths) {
  let removed = 0;
  for (const publicPath of deletedPaths) {
    const relative = publicPath.replace(/^\/+/, "");
    if (!relative.startsWith("media/")) continue;
    const absolute = join(root, "public", relative);
    if (existsSync(absolute)) {
      unlinkSync(absolute);
      removed += 1;
    }
  }
  return removed;
}

const deletedPaths = await loadDeletedPaths();
const manifestRemoved = pruneManifest(deletedPaths);
const filesRemoved = prunePublicFiles(deletedPaths);

console.log(
  `Pruned deleted media: ${deletedPaths.size} tombstone(s), ${manifestRemoved} manifest row(s), ${filesRemoved} public file(s).`,
);
