import { describe, expect, it } from "vitest";
import { AGENT_LAST_USED_THROTTLE_MS, shouldUpdateLastUsedAt } from "@/lib/cms/agent-auth";

describe("agent auth lastUsedAt throttle", () => {
  it("updates when there is no previous timestamp", () => {
    expect(shouldUpdateLastUsedAt(null)).toBe(true);
  });

  it("skips updates inside the throttle window", () => {
    const now = new Date("2026-07-18T00:00:00.000Z");
    const recent = new Date(now.getTime() - AGENT_LAST_USED_THROTTLE_MS / 2);

    expect(shouldUpdateLastUsedAt(recent, now)).toBe(false);
  });

  it("updates once the throttle window elapses", () => {
    const now = new Date("2026-07-18T00:00:00.000Z");
    const stale = new Date(now.getTime() - AGENT_LAST_USED_THROTTLE_MS);

    expect(shouldUpdateLastUsedAt(stale, now)).toBe(true);
  });
});
