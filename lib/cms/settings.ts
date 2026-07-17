import { eq } from "drizzle-orm";
import { getDb } from "@/lib/cms/db/client";
import { cmsSettings } from "@/lib/cms/db/schema";

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const db = getDb();
  const [row] = await db.select().from(cmsSettings).where(eq(cmsSettings.key, key)).limit(1);
  return (row?.value as T | undefined) ?? fallback;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const db = getDb();
  await db
    .insert(cmsSettings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: cmsSettings.key,
      set: { value, updatedAt: new Date() },
    });
}
