import { jsonError, jsonOk, readJsonBody } from "@/lib/cms/http";
import { handleTelegramUpdate, isAllowedTelegramChat } from "@/lib/cms/telegram";

export async function POST(request: Request) {
  const configuredSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!configuredSecret) {
    return jsonError("Telegram webhook is not configured.", 503);
  }

  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (secret !== configuredSecret) {
    return jsonError("Unauthorized.", 401);
  }

  const update = await readJsonBody<Parameters<typeof handleTelegramUpdate>[0]>(request);
  if (!update) {
    return jsonError("Invalid update payload.");
  }

  const chatId = update.message?.chat?.id;
  if (!isAllowedTelegramChat(chatId)) {
    return jsonError("Unauthorized chat.", 401);
  }

  const result = await handleTelegramUpdate(update);
  return jsonOk(result);
}
