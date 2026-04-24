import type { Bot, Context } from "grammy"
import { researchCoin } from "../agent/research.ts"
import { queryCoinAnalysis } from "../db/coinRepository.ts"

const ALLOWED_CHANNEL_ID = Bun.env.TELEGRAM_CHANNEL_ID
const DEFAULT_RESEARCH_TIMEOUT_MS = 90_000

class ResearchTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`research timed out after ${timeoutMs}ms`)
    this.name = "ResearchTimeoutError"
  }
}

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = Bun.env[name]
  if (!raw) return fallback

  const value = Number.parseInt(raw, 10)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

const RESEARCH_TIMEOUT_MS = readPositiveIntEnv("KOL_RESEARCH_TIMEOUT_MS", DEFAULT_RESEARCH_TIMEOUT_MS)

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout>

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new ResearchTimeoutError(timeoutMs)), timeoutMs)
  })

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeout))
}

async function researchCoinWithTimeout(query: string): Promise<string> {
  return withTimeout(researchCoin(query), RESEARCH_TIMEOUT_MS)
}

function formatTimeoutSkipMessage(query: string): string {
  const seconds = Math.round(RESEARCH_TIMEOUT_MS / 1000)
  return `⏭️ *${query}* 研究超过 ${seconds}s，已跳过本条，避免阻塞后续信息推送。`
}

export function registerCommands(bot: Bot): void {
  const helpText = `🤖 *Crypto Research Bot*

帮你快速研究 KOL 推荐的币，识别潜在风险。

*命令:*
• \`/research <币名>\` - 完整研究报告（实时拉取数据）
• \`/r <ticker>\` - 简写形式
• \`/lookup <币名>\` - 查询已存档报告（秒回）
• \`/l <ticker>\` - 简写形式

*示例:*
• \`/r BTC\`
• \`/research pepe coin\`
• \`/l WIF\`

*报告包含:*
✅ 基本市场数据
✅ DEX 流动性分析
✅ 持币集中度 (Bubblemaps)
✅ 舆情/诈骗搜索
✅ AI 综合风险评估

⚠️ _不构成投资建议，DYOR！_`

  bot.command(["start", "help"], (ctx) => ctx.reply(helpText, { parse_mode: "Markdown" }))
  bot.command(["research", "r"], handleResearch)
  bot.command(["lookup", "l"], handleLookup)

  // Handle @mention in groups/supergroups
  bot.on("message:entities:mention", handleMentionResearch)
  // Handle @mention in channels (channel_post updates)
  bot.on("channel_post", handleChannelPostResearch)
}

async function handleLookup(ctx: Context): Promise<void> {
  const args = typeof ctx.match === "string" ? ctx.match.trim() : ""
  if (!args) {
    await ctx.reply("请提供代币名称或 ticker，例如：\n`/lookup BTC`\n`/l pepe`", {
      parse_mode: "Markdown",
    })
    return
  }

  const result = await queryCoinAnalysis(args)

  if (!result || !result.full_report) {
    await ctx.reply(
      `❌ 数据库中没有 *${args}* 的记录。\n\n使用 \`/research ${args}\` 发起首次研究。`,
      { parse_mode: "Markdown" },
    )
    return
  }

  const analyzedAt = new Date(result.last_analyzed_at).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })

  const footer = `\n\n📦 _已存档报告 · 分析于 ${analyzedAt} CST · 共研究 ${result.analysis_count} 次_\n_获取最新数据请用 /research ${result.symbol}_`

  const fullMessage = result.full_report + footer

  await ctx.reply(fullMessage, {
    parse_mode: "Markdown",
    link_preview_options: { is_disabled: true },
  })
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
    const report = await researchCoinWithTimeout(args)
    await ctx.api.editMessageText(placeholder.chat.id, placeholder.message_id, report, {
      parse_mode: "Markdown",
      link_preview_options: { is_disabled: true },
    })
  } catch (err) {
    if (err instanceof ResearchTimeoutError) {
      console.warn(`[bot] research timed out, skipped: query="${args}" timeoutMs=${err.timeoutMs}`)
      await ctx.api.editMessageText(placeholder.chat.id, placeholder.message_id, formatTimeoutSkipMessage(args), {
        parse_mode: "Markdown",
      })
      return
    }

    console.error("[bot] research failed:", err)
    const msg = err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200)
    await ctx.api.editMessageText(placeholder.chat.id, placeholder.message_id, `❌ 研究过程中出现错误：${msg}`)
  }
}

function extractQueryFromMention(text: string, botUsername: string): string | null {
  // Match @botname followed by the coin query, case-insensitive
  const pattern = new RegExp(`@${botUsername}\\s+(.+)`, "i")
  const match = text.match(pattern)
  return match?.[1]?.trim() || null
}

async function handleMentionResearch(ctx: Context): Promise<void> {
  const chatId = String(ctx.chat?.id)
  console.log(`[mention] chatId=${chatId} allowedId=${ALLOWED_CHANNEL_ID}`)
  if (ALLOWED_CHANNEL_ID && chatId !== ALLOWED_CHANNEL_ID) {
    console.log(`[mention] ignored: chatId ${chatId} != allowed ${ALLOWED_CHANNEL_ID}`)
    return
  }

  const botUsername = ctx.me.username
  const text = ctx.message?.text || ""
  console.log(`[mention] botUsername=${botUsername} text="${text}"`)
  const query = extractQueryFromMention(text, botUsername)
  console.log(`[mention] extracted query="${query}"`)
  if (!query) return

  await runResearchInChat(ctx, chatId, query, ctx.message?.message_id)
}

async function handleChannelPostResearch(ctx: Context): Promise<void> {
  const chatId = String(ctx.chat?.id)
  console.log(`[channel_post] chatId=${chatId} allowedId=${ALLOWED_CHANNEL_ID}`)
  if (ALLOWED_CHANNEL_ID && chatId !== ALLOWED_CHANNEL_ID) {
    console.log(`[channel_post] ignored: chatId ${chatId} != allowed ${ALLOWED_CHANNEL_ID}`)
    return
  }

  const botUsername = ctx.me.username
  const text = ctx.channelPost?.text || ""
  console.log(`[channel_post] botUsername=${botUsername} text="${text}"`)
  if (!text.toLowerCase().includes(`@${botUsername.toLowerCase()}`)) return

  const query = extractQueryFromMention(text, botUsername)
  console.log(`[channel_post] extracted query="${query}"`)
  if (!query) return

  await runResearchInChat(ctx, chatId, query, ctx.channelPost?.message_id)
}

async function runResearchInChat(
  ctx: Context,
  chatId: string,
  query: string,
  replyToMessageId?: number,
): Promise<void> {
  const numericChatId = Number(chatId)

  const placeholder = await ctx.api.sendMessage(numericChatId, `🔍 正在研究 *${query}*，请稍候...`, {
    parse_mode: "Markdown",
    reply_parameters: replyToMessageId ? { message_id: replyToMessageId } : undefined,
  })

  try {
    const report = await researchCoinWithTimeout(query)
    await ctx.api.editMessageText(numericChatId, placeholder.message_id, report, {
      parse_mode: "Markdown",
      link_preview_options: { is_disabled: true },
    })
  } catch (err) {
    if (err instanceof ResearchTimeoutError) {
      console.warn(`[bot] channel research timed out, skipped: query="${query}" timeoutMs=${err.timeoutMs}`)
      await ctx.api.editMessageText(numericChatId, placeholder.message_id, formatTimeoutSkipMessage(query), {
        parse_mode: "Markdown",
      })
      return
    }

    console.error("[bot] channel research failed:", err)
    const msg = err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200)
    await ctx.api.editMessageText(numericChatId, placeholder.message_id, `❌ 研究过程中出现错误：${msg}`)
  }
}
