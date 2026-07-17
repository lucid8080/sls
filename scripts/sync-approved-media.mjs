import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const source = join(root, "recovered-media-output", "media");
const target = join(root, "public", "media");

if (!existsSync(source)) {
  throw new Error(`Approved re-encoded media directory not found: ${source}`);
}

mkdirSync(join(root, "public"), { recursive: true });
cpSync(source, target, { recursive: true, force: true });
console.log(`Synced approved media from ${source} to ${target}`);
