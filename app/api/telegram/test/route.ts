import { sendTelegramMessage } from "@/lib/telegram";

export async function GET() {
  await sendTelegramMessage(
    "🧪 *Test from Money Flow API*\n\nIf you see this, your Telegram integration is working!"
  );
  return Response.json({ ok: true, message: "Telegram message sent" });
}
