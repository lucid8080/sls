import { jsonError, jsonOk, readJsonBody } from "@/lib/cms/http";
import { handleTelegramUpdate } from "@/lib/cms/telegram";

export async function POST(request: Request) {
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (process.env.TELEGRAM_WEBHOOK_SECRET && secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return jsonError("Unauthorized.", 401);
  }

  const update = await readJsonBody<Parameters<typeof handleTelegramUpdate>[0]>(request);
  if (!update) {
    return jsonError("Invalid update payload.");
  }

  const result = await handleTelegramUpdate(update);
  return jsonOk(result);
}
