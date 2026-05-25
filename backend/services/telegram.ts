function getAppBaseUrl() {
  return (process.env.APP_BASE_URL || "https://domain.com").replace(/\/+$/, "");
}

function buildMessage(input: {
  recipientName?: string | null;
  recipientEmail?: string | null;
  title: string;
  message: string;
  link?: string;
}) {
  const lines = [
    `ICT Support: ${input.title}`,
    input.recipientName || input.recipientEmail ? `To: ${input.recipientName || input.recipientEmail}` : "",
    "",
    input.message,
    input.link ? `${getAppBaseUrl()}${input.link.startsWith("/") ? input.link : `/${input.link}`}` : "",
  ].filter(Boolean);

  return lines.join("\n");
}

export async function sendTelegramNotification(input: {
  chatId?: string | null;
  recipientName?: string | null;
  recipientEmail?: string | null;
  title: string;
  message: string;
  link?: string;
}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { delivered: false, reason: "Telegram bot token is not configured." };
  }

  const chatId = input.chatId;
  if (!chatId) {
    return { delivered: false, reason: "User has not linked their Telegram account." };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: buildMessage(input),
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      console.warn("Telegram notification failed:", response.status, details);
      return { delivered: false, reason: `Telegram API returned ${response.status}.` };
    }

    return { delivered: true };
  } catch (err) {
    console.warn("Telegram notification failed:", err);
    return { delivered: false, reason: "Telegram request failed." };
  }
}

export async function sendTelegramMessage(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { delivered: false, reason: "Telegram is not configured." };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      console.warn("Telegram message failed:", response.status, details);
      return { delivered: false, reason: `Telegram API returned ${response.status}.` };
    }

    return { delivered: true };
  } catch (err) {
    console.warn("Telegram message failed:", err);
    return { delivered: false, reason: "Telegram request failed." };
  }
}

export type TelegramUpdate = {
  update_id: number;
  message?: {
    text?: string;
    chat?: {
      id?: number | string;
    };
  };
};

export async function getTelegramUpdates(offset?: number) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return [] as TelegramUpdate[];

  const params = new URLSearchParams({
    timeout: "0",
    allowed_updates: JSON.stringify(["message"]),
  });
  if (offset !== undefined) {
    params.set("offset", String(offset));
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates?${params.toString()}`);
  if (!response.ok) {
    const details = await response.text().catch(() => "");
    console.warn("Telegram getUpdates failed:", response.status, details);
    return [] as TelegramUpdate[];
  }

  const data = await response.json().catch(() => null) as { result?: TelegramUpdate[] } | null;
  return Array.isArray(data?.result) ? data.result : [];
}
