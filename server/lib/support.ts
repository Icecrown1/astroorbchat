/**
 * Support alert helper — sends a Telegram message to the configured support chat.
 * Uses SUPPORT_CHAT_ID env var (the chat ID or @username of the support channel/group).
 * Falls back to a console log if the env var is not set.
 */
export async function sendSupportAlert(subject: string, body: string): Promise<void> {
  const chatId = process.env.SUPPORT_CHAT_ID;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  const text = `🚨 *${escapeMarkdown(subject)}*\n\n${escapeMarkdown(body)}`;

  if (!chatId || !botToken) {
    console.warn('[SUPPORT_ALERT] SUPPORT_CHAT_ID or TELEGRAM_BOT_TOKEN not set — alert dropped:');
    console.warn(`[SUPPORT_ALERT] Subject: ${subject}`);
    console.warn(`[SUPPORT_ALERT] Body: ${body}`);
    return;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'MarkdownV2',
        }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[SUPPORT_ALERT] Telegram API error:', response.status, errorBody);
    } else {
      console.log('[SUPPORT_ALERT] Alert sent:', subject);
    }
  } catch (err: any) {
    console.error('[SUPPORT_ALERT] Failed to send alert:', err?.message);
  }
}

function escapeMarkdown(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}
