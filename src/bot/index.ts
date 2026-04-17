import { Bot } from "grammy"
import { registerCommands } from "./commands.ts"

export function startBot(): void {
  const token = Bun.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN must be set")

  const bot = new Bot(token)
  registerCommands(bot)

  console.log("Bot started. Polling...")
  bot.start({ drop_pending_updates: true })
}
