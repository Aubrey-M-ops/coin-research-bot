import type { Bot } from "grammy"
import { Cron } from "croner"
import { getLeastRecentlyReviewedCoin } from "../db/coinRepository.ts"
import { researchCoinById } from "../agent/research.ts"

const CHANNEL_ID = Bun.env.TELEGRAM_CHANNEL_ID

export function scheduleDailyReview(bot: Bot): void {
  if (!CHANNEL_ID) {
    console.warn("[scheduler] TELEGRAM_CHANNEL_ID not set; daily review disabled")
    return
  }

  new Cron("0 8 * * *", { timezone: "America/Toronto" }, async () => {
    await runDailyReview(bot)
  })

  console.log("[scheduler] Daily review scheduled at 08:00 America/Toronto")
}

async function runDailyReview(bot: Bot): Promise<void> {
  console.log("[scheduler] Running daily review...")

  const coin = await getLeastRecentlyReviewedCoin()
  if (!coin) {
    console.log("[scheduler] No coins in DB, skipping daily review")
    return
  }

  const channelId = Number(CHANNEL_ID)

  try {
    const report = await researchCoinById(coin.coin_id)
    const header = formatDailyReviewHeader(coin.name, coin.symbol, coin.last_analyzed_at, coin.analysis_count)
    await bot.api.sendMessage(channelId, `${header}\n\n${report}`, {
      parse_mode: "Markdown",
      link_preview_options: { is_disabled: true },
    })
    console.log(`[scheduler] Daily review sent for ${coin.symbol}`)
  } catch (err) {
    console.error("[scheduler] Daily review failed:", err)
    const msg = err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200)
    try {
      await bot.api.sendMessage(channelId, `❌ 每日复习失败：${msg}`)
    } catch (sendErr) {
      console.error("[scheduler] Failed to send error notice:", sendErr)
    }
  }
}

export function formatDailyReviewHeader(
  name: string,
  symbol: string,
  lastAnalyzedAt: string,
  analysisCount: number,
): string {
  const lastDate = new Date(lastAnalyzedAt)
  const now = new Date()
  const daysSince = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
  const daysText = daysSince === 0 ? "今天" : `${daysSince} 天`

  return `📅 *每日复习*
🪙 距上次复习 *${daysText}* · 已研究 *${analysisCount}* 次
━━━━━━━━━━━━━━━━━`
}
