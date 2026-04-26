import { Bot } from "grammy"

const token = Bun.env.TELEGRAM_BOT_TOKEN
const chatId = Bun.env.TELEGRAM_BOT_CHAT_ID

if (!token) throw new Error("TELEGRAM_BOT_TOKEN not set")
if (!chatId) throw new Error("TELEGRAM_BOT_CHAT_ID not set")

const bot = new Bot(token)
const numericChatId = Number(chatId)

console.log("[test-research] Sending test message to chat:", numericChatId)

const placeholder = await bot.api.sendMessage(numericChatId, `🔍 正在研究 *BTC（测试）*，请稍候...`, {
  parse_mode: "Markdown",
})

await Bun.sleep(1000)

await bot.api.editMessageText(
  numericChatId,
  placeholder.message_id,
  `✅ *测试报告 · BTC（测试）*\n\n这是一条测试消息，用于验证 /research 消息发送流程正常。\n\n_实际运行时此处会显示完整的研究报告。_`,
  {
    parse_mode: "Markdown",
    link_preview_options: { is_disabled: true },
  },
)

console.log("[test-research] ✅ Done")
