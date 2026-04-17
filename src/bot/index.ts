import { Bot } from "grammy"
import { registerCommands } from "./commands.ts"

export function startBot(): void {
  const token = Bun.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN must be set")

  const bot = new Bot(token)

  // Debug: log every incoming update type (must be before registerCommands)
  bot.use((ctx, next) => {
    const updateType = Object.keys(ctx.update).filter((k) => k !== "update_id")[0]
    const chatId = ctx.chat?.id ?? ctx.channelPost?.chat?.id
    const text = ctx.message?.text ?? ctx.channelPost?.text ?? ""
    console.log(`[update] type=${updateType} chatId=${chatId} text="${text.slice(0, 80)}"`)
    return next()
  })

  registerCommands(bot)

  console.log("Bot started. Polling...")
  bot.start({ drop_pending_updates: true })
}
