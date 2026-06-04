import { sendTelegramMessage } from "@/lib/telegram";

export async function GET() {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (chatId) {
    await sendTelegramMessage(
      chatId,
      "🧪 <b>Test from Money Flow API</b>\n\nIf you see this, your Telegram integration is working!"
    );
  }
  return Response.json({ ok: true, message: "Telegram message sent" });
}
