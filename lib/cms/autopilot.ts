import { getDb, isDatabaseConfigured } from "@/lib/cms/db/client";
import { cmsSettings } from "@/lib/cms/db/schema";
import { createAgentJob, getCalendarEntryByDate } from "@/lib/cms/articles";

export type AutopilotSettings = {
  enabled: boolean;
  autoPublish: boolean;
  timezone: string;
};

export function getAutopilotSettingsFromEnv(): AutopilotSettings {
  return {
    enabled: process.env.AUTOPILOT_ENABLED === "true",
    autoPublish: process.env.AUTOPILOT_AUTO_PUBLISH === "true",
    timezone: process.env.AUTOPILOT_TIMEZONE ?? "America/New_York",
  };
}

export async function getAutopilotSettings(): Promise<AutopilotSettings> {
  const env = getAutopilotSettingsFromEnv();
  if (!isDatabaseConfigured()) {
    return env;
  }

  try {
    const db = getDb();
    const rows = await db.select().from(cmsSettings);
    const map = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    return {
      enabled: (map.autopilot_enabled as boolean | undefined) ?? env.enabled,
      autoPublish: (map.autopilot_auto_publish as boolean | undefined) ?? env.autoPublish,
      timezone: (map.autopilot_timezone as string | undefined) ?? env.timezone,
    };
  } catch {
    return env;
  }
}

export async function setAutopilotSetting(key: string, value: unknown): Promise<void> {
  const db = getDb();
  await db
    .insert(cmsSettings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: cmsSettings.key,
      set: { value, updatedAt: new Date() },
    });
}

export function todayInTimezone(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function runDailyAutopilot(): Promise<{
  date: string;
  jobId?: string;
  topic?: string;
  skipped?: string;
}> {
  const settings = await getAutopilotSettings();
  if (!settings.enabled) {
    return { date: todayInTimezone(settings.timezone), skipped: "Autopilot disabled." };
  }

  const date = todayInTimezone(settings.timezone);
  const entry = await getCalendarEntryByDate(date);

  if (!entry) {
    return { date, skipped: "No calendar entry for today." };
  }

  if (entry.articleId) {
    return { date, topic: entry.topic, skipped: "Calendar slot already linked to an article." };
  }

  const job = await createAgentJob({
    type: "generate",
    payload: {
      calendarDate: date,
      topic: entry.topic,
      contentType: entry.contentType,
      categorySlug: entry.categorySlug,
      internalLinkTargets: entry.internalLinkTargets,
      seoChecklist: entry.seoChecklist,
      autoPublish: settings.autoPublish,
    },
  });

  return { date, jobId: job.id, topic: entry.topic };
}
