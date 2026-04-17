import { Bot } from "grammy"
import { registerCommands } from "./commands.ts"

export async function startBot(): Promise<void> {
  const token = Bun.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN must be set")

  const bot = new Bot(token)

  // Register slash commands so they appear in Telegram's hint menu
  await bot.api.setMyCommands([
    { command: "research", description: "完整研究报告，例如：/research bitcoin" },
    { command: "r", description: "简写形式，例如：/r BTC" },
    { command: "help", description: "使用说明" },
  ])

  registerCommands(bot)

  console.log("Bot started. Polling...")
  bot.start({ drop_pending_updates: true })
}
