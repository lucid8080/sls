import { afterEach, describe, expect, it, vi } from "vitest";

const handleTelegramUpdate = vi.fn();

vi.mock("@/lib/cms/telegram", async () => {
  const actual = await vi.importActual<typeof import("@/lib/cms/telegram")>("@/lib/cms/telegram");
  return {
    ...actual,
    handleTelegramUpdate,
  };
});

describe("telegram webhook hardening", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    delete process.env.TELEGRAM_CHAT_ID;
  });

  it("fails closed when the webhook secret is not configured", async () => {
    const { POST } = await import("@/app/api/telegram/webhook/route");
    const response = await POST(
      new Request("http://localhost/api/telegram/webhook", {
        method: "POST",
        body: JSON.stringify({ message: { text: "help", chat: { id: 1 } } }),
      }),
    );

    expect(response.status).toBe(503);
    expect(handleTelegramUpdate).not.toHaveBeenCalled();
  });

  it("rejects requests with the wrong secret", async () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = "expected-secret";
    process.env.TELEGRAM_CHAT_ID = "42";

    const { POST } = await import("@/app/api/telegram/webhook/route");
    const response = await POST(
      new Request("http://localhost/api/telegram/webhook", {
        method: "POST",
        headers: { "x-telegram-bot-api-secret-token": "wrong" },
        body: JSON.stringify({ message: { text: "help", chat: { id: 42 } } }),
      }),
    );

    expect(response.status).toBe(401);
    expect(handleTelegramUpdate).not.toHaveBeenCalled();
  });

  it("rejects commands from chats outside the allowlist", async () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = "expected-secret";
    process.env.TELEGRAM_CHAT_ID = "42";

    const { POST } = await import("@/app/api/telegram/webhook/route");
    const response = await POST(
      new Request("http://localhost/api/telegram/webhook", {
        method: "POST",
        headers: { "x-telegram-bot-api-secret-token": "expected-secret" },
        body: JSON.stringify({ message: { text: "help", chat: { id: 99 } } }),
      }),
    );

    expect(response.status).toBe(401);
    expect(handleTelegramUpdate).not.toHaveBeenCalled();
  });

  it("accepts authenticated commands from the configured chat", async () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = "expected-secret";
    process.env.TELEGRAM_CHAT_ID = "42";
    handleTelegramUpdate.mockResolvedValue({ handled: true, message: "ok" });

    const { POST } = await import("@/app/api/telegram/webhook/route");
    const response = await POST(
      new Request("http://localhost/api/telegram/webhook", {
        method: "POST",
        headers: { "x-telegram-bot-api-secret-token": "expected-secret" },
        body: JSON.stringify({ message: { text: "help", chat: { id: 42 } } }),
      }),
    );

    expect(response.status).toBe(200);
    expect(handleTelegramUpdate).toHaveBeenCalledOnce();
  });
});
