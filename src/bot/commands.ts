import type { Bot, Context } from "grammy"
import { researchCoin } from "../agent/research.ts"

export function registerCommands(bot: Bot): void {
  const helpText = `🤖 *Crypto Research Bot*

帮你快速研究 KOL 推荐的币，识别潜在风险。

*命令:*
• \`/research <币名>\` - 完整研究报告
• \`/r <ticker>\` - 简写形式

*示例:*
• \`/r BTC\`
• \`/research pepe coin\`
• \`/r WIF\`

*报告包含:*
✅ 基本市场数据
✅ DEX 流动性分析
✅ 持币集中度 (Bubblemaps)
✅ 舆情/诈骗搜索
✅ AI 综合风险评估

⚠️ _不构成投资建议，DYOR！_`

  bot.command(["start", "help"], (ctx) => ctx.reply(helpText, { parse_mode: "Markdown" }))
  bot.command(["research", "r"], handleResearch)
}

async function handleResearch(ctx: Context): Promise<void> {
  const args = typeof ctx.match === "string" ? ctx.match.trim() : ""
  if (!args) {
    await ctx.reply("请提供代币名称或 ticker，例如：\n`/research bitcoin`\n`/r PEPE`", {
      parse_mode: "Markdown",
    })
    return
  }

  const placeholder = await ctx.reply(`🔍 正在研究 *${args}*，请稍候...`, { parse_mode: "Markdown" })

  try {
    const report = await researchCoin(args)
    await ctx.api.editMessageText(placeholder.chat.id, placeholder.message_id, report, {
      parse_mode: "Markdown",
      link_preview_options: { is_disabled: true },
    })
  } catch (err) {
    console.error("[bot] research failed:", err)
    const msg = err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200)
    await ctx.api.editMessageText(placeholder.chat.id, placeholder.message_id, `❌ 研究过程中出现错误：${msg}`)
  }
}
