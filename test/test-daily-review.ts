import { Bot } from "grammy"
import { formatDailyReviewHeader } from "../src/scheduler/dailyReview.ts"

const token = Bun.env.TELEGRAM_BOT_TOKEN
const chatId = Bun.env.TELEGRAM_BOT_CHAT_ID

if (!token) throw new Error("TELEGRAM_BOT_TOKEN not set")
if (!chatId) throw new Error("TELEGRAM_BOT_CHAT_ID not set")

const bot = new Bot(token)
const numericChatId = Number(chatId)

console.log("[test-daily-review] Sending test message to chat:", numericChatId)

const fakeCoin = {
  name: "Bitcoin",
  symbol: "BTC",
  last_analyzed_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  analysis_count: 5,
}

const header = formatDailyReviewHeader(
  fakeCoin.name,
  fakeCoin.symbol,
  fakeCoin.last_analyzed_at,
  fakeCoin.analysis_count,
)

const body = `_这是一条测试消息，用于验证每日复习消息发送流程正常。_\n\n_实际运行时此处会显示完整的研究报告。_`

await bot.api.sendMessage(numericChatId, `${header}\n\n${body}`, {
  parse_mode: "Markdown",
  link_preview_options: { is_disabled: true },
})

console.log("[test-daily-review] ✅ Done")
