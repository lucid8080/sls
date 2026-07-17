import { getArticleById } from "@/lib/cms/articles";
import { publishArticle, submitForReview } from "@/lib/cms/publish";

export async function notifyTelegram(message: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

  if (!token || !chatId) {
    return false;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "Markdown",
        disable_web_page_preview: false,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function handleTelegramUpdate(update: {
  message?: { text?: string; chat?: { id: number } };
}): Promise<{ handled: boolean; message?: string }> {
  const text = update.message?.text?.trim();
  if (!text) {
    return { handled: false };
  }

  const publishMatch = text.match(/^publish\s+(\S+)/i);
  if (publishMatch) {
    const articleId = publishMatch[1];
    const article = await getArticleById(articleId);
    if (!article) {
      return { handled: true, message: `Article not found: ${articleId}` };
    }

    const result = await publishArticle(articleId, "telegram");
    if (!result.ok) {
      return {
        handled: true,
        message: `Publish failed for ${article.title}: ${result.error ?? "quality gates failed"}`,
      };
    }

    return {
      handled: true,
      message: `Published: ${article.title}\n${article.pathname}`,
    };
  }

  const reviewMatch = text.match(/^review\s+(\S+)/i);
  if (reviewMatch) {
    const articleId = reviewMatch[1];
    const result = await submitForReview(articleId, "telegram");
    return {
      handled: true,
      message: result.ok ? `Submitted ${articleId} for review.` : `Review submit failed: ${result.error}`,
    };
  }

  const reviseMatch = text.match(/^revise\s+(\S+)\s+([\s\S]+)/i);
  if (reviseMatch) {
    return {
      handled: true,
      message: `Revision noted for ${reviseMatch[1]}: ${reviseMatch[2]}. Update the draft via admin or Agent API PATCH.`,
    };
  }

  if (/^help$/i.test(text)) {
    return {
      handled: true,
      message: "Commands:\n- review <articleId>\n- publish <articleId>\n- revise <articleId> <notes>\n- help",
    };
  }

  return { handled: false };
}
