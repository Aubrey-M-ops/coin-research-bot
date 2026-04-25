# Daily Review Scheduler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Schedule a daily 8am (America/Toronto) cron job that picks the least-recently-reviewed coin from the database, refreshes its research report, and pushes a "每日复习" message to the Telegram channel.

**Architecture:** In-process cron using `croner` registered at bot startup. `researchCoin` is refactored to extract a shared `researchFromDetail()` helper, and a new `researchCoinById()` export bypasses the CoinGecko search step for reliability. The scheduler lives in `src/scheduler/dailyReview.ts` and is wired in `src/bot/index.ts`.

**Tech Stack:** Bun, croner, grammy, Supabase JS client, TypeScript

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Install | `croner` package | In-process cron scheduling with timezone support |
| Modify | `src/db/coinRepository.ts` | Add `getLeastRecentlyReviewedCoin()` + `LeastRecentCoin` interface |
| Modify | `src/agent/research.ts` | Extract `researchFromDetail()`, add `researchCoinById()` export |
| Create | `src/scheduler/dailyReview.ts` | Cron registration, daily job, `formatDailyReviewHeader()` |
| Create | `src/scheduler/dailyReview.test.ts` | Unit tests for `formatDailyReviewHeader()` |
| Modify | `src/bot/index.ts` | Call `scheduleDailyReview(bot)` at startup |

---

### Task 1: Install croner

**Files:**
- Modify: `package.json`, `bun.lock`

- [ ] **Step 1: Install the package**

```bash
bun add croner
```

Expected output: `+ croner@x.x.x` added to dependencies.

- [ ] **Step 2: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: add croner for in-process cron scheduling"
```

---

### Task 2: Add `getLeastRecentlyReviewedCoin` to coinRepository.ts

**Files:**
- Modify: `src/db/coinRepository.ts`

- [ ] **Step 1: Append the interface and function to `src/db/coinRepository.ts`**

Add after the existing `upsertCoinAnalysis` function:

```ts
export interface LeastRecentCoin {
  coin_id: string
  name: string
  symbol: string
  last_analyzed_at: string
  analysis_count: number
}

export async function getLeastRecentlyReviewedCoin(): Promise<LeastRecentCoin | null> {
  if (!supabase) {
    console.warn("[db] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing; skipping getLeastRecentlyReviewedCoin")
    return null
  }

  try {
    const { data, error } = await supabase
      .from("coin_analyses")
      .select("coin_id, name, symbol, last_analyzed_at, analysis_count")
      .order("last_analyzed_at", { ascending: true })
      .limit(1)
      .single()

    if (error) {
      if (error.code === "PGRST116") return null // table is empty
      console.error("[db] getLeastRecentlyReviewedCoin failed:", error.message)
      return null
    }

    return data as LeastRecentCoin
  } catch (err) {
    console.error("[db] unexpected error in getLeastRecentlyReviewedCoin:", err)
    return null
  }
}
```

- [ ] **Step 2: Run typecheck**

```bash
bun run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/db/coinRepository.ts
git commit -m "feat(db): add getLeastRecentlyReviewedCoin query"
```

---

### Task 3: Extract `researchFromDetail` and add `researchCoinById` in research.ts

**Files:**
- Modify: `src/agent/research.ts:35-98`

This refactor extracts the shared core logic so `researchCoinById` can skip the CoinGecko search step and use the stored `coin_id` directly.

- [ ] **Step 1: Replace the `researchCoin` function (lines 35–98) with three functions**

Replace the entire `researchCoin` function with:

```ts
export async function researchCoin(query: string): Promise<string> {
  const normalized = normalizeQuery(query)
  const coinMeta = await searchCoin(normalized) ?? (normalized !== query ? await searchCoin(query) : null)
  if (!coinMeta) return `❌ 未找到与 *${query}* 匹配的代币，请检查名称或 ticker 是否正确。`

  const detail = await getCoinDetail(coinMeta.id)
  if (!detail) return `❌ 无法获取 *${query}* 的详细信息，CoinGecko 可能暂不收录。`

  return researchFromDetail(coinMeta.id, detail)
}

export async function researchCoinById(coinId: string): Promise<string> {
  const detail = await getCoinDetail(coinId)
  if (!detail) return `❌ 无法获取 coin_id=${coinId} 的详细信息，CoinGecko 可能暂不收录。`

  return researchFromDetail(coinId, detail)
}

async function researchFromDetail(coinId: string, detail: Record<string, unknown>): Promise<string> {
  const summary = parseCoinSummary(detail)
  const { name, symbol } = summary

  const platforms = (detail.platforms ?? {}) as Record<string, string>
  let contractAddress: string | undefined
  let chain: string | undefined
  for (const [platform, address] of Object.entries(platforms)) {
    if (address && CHAIN_MAP[platform]) {
      contractAddress = address
      chain = platform
      break
    }
  }

  const [pairsRaw, bubbleData] = await Promise.all([
    searchPairs(`${name} ${symbol}`),
    contractAddress && chain ? getDecentralizationScore(contractAddress, chain) : Promise.resolve(null),
  ])

  const topPairs = parseTopPairs(pairsRaw)
  const liquidityAssessment = assessLiquidityRisk(topPairs)
  const concentrationAssessment = assessConcentrationRisk(bubbleData)
  const context = buildContext(summary, topPairs, liquidityAssessment, concentrationAssessment)
  const claudeReport = await getClaudeAnalysis(name, symbol, context)
  const report = formatReport(name, symbol, claudeReport)

  const sector = summary.categories[0] ?? ""

  void upsertCoinAnalysis({
    coin_id: coinId,
    name,
    symbol,
    market_cap_rank: summary.marketCapRank,
    price_usd: summary.priceUsd,
    market_cap_usd: summary.marketCapUsd,
    fdv_usd: summary.fdvUsd,
    volume_24h: summary.volume24h,
    price_change_24h_pct: summary.priceChange24hPct,
    ath_usd: summary.athUsd,
    ath_change_pct: summary.athChangePct,
    circulating_supply: summary.circulatingSupply,
    total_supply: summary.totalSupply,
    max_supply: summary.maxSupply,
    top_liquidity_usd: topPairs[0]?.liquidityUsd,
    decentralization_score: bubbleData?.decentralizationScore,
    sector,
    liquidity_assessment: liquidityAssessment,
    full_report: claudeReport,
    categories: summary.categories,
  }).catch((err) => {
    console.error("[research] failed to persist coin analysis:", err)
  })

  return report
}
```

The `buildContext`, `getClaudeAnalysis`, and `formatReport` functions below this block remain unchanged.

- [ ] **Step 2: Run typecheck**

```bash
bun run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/agent/research.ts
git commit -m "refactor(research): extract researchFromDetail, add researchCoinById"
```

---

### Task 4: Create the daily review scheduler (TDD)

**Files:**
- Create: `src/scheduler/dailyReview.test.ts`
- Create: `src/scheduler/dailyReview.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/scheduler/dailyReview.test.ts`:

```ts
import { expect, test } from "bun:test"
import { formatDailyReviewHeader } from "./dailyReview.ts"

test("formatDailyReviewHeader shows days since last review", () => {
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  const result = formatDailyReviewHeader("Bitcoin", "BTC", twoDaysAgo, 5)
  expect(result).toContain("📅 *每日复习*")
  expect(result).toContain("*2 天*")
  expect(result).toContain("*5* 次")
})

test("formatDailyReviewHeader shows 今天 when reviewed within the same day", () => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const result = formatDailyReviewHeader("Ethereum", "ETH", oneHourAgo, 1)
  expect(result).toContain("今天")
  expect(result).toContain("*1* 次")
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
bun test src/scheduler/dailyReview.test.ts
```

Expected: error — `formatDailyReviewHeader` not found (file doesn't exist yet).

- [ ] **Step 3: Create `src/scheduler/dailyReview.ts`**

```ts
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
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
bun test src/scheduler/dailyReview.test.ts
```

Expected:
```
✓ formatDailyReviewHeader shows days since last review
✓ formatDailyReviewHeader shows 今天 when reviewed within the same day

2 pass, 0 fail
```

- [ ] **Step 5: Run typecheck**

```bash
bun run typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/scheduler/dailyReview.ts src/scheduler/dailyReview.test.ts
git commit -m "feat(scheduler): add daily review cron job with 每日复习 header"
```

---

### Task 5: Wire scheduler into bot startup

**Files:**
- Modify: `src/bot/index.ts`

- [ ] **Step 1: Add the import and call to `src/bot/index.ts`**

Replace the full content of `src/bot/index.ts` with:

```ts
import { Bot } from "grammy"
import { registerCommands } from "./commands.ts"
import { scheduleDailyReview } from "../scheduler/dailyReview.ts"

export async function startBot(): Promise<void> {
  const token = Bun.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN must be set")

  const bot = new Bot(token)

  await bot.api.setMyCommands([
    { command: "research", description: "完整研究报告，例如：/research bitcoin" },
    { command: "r", description: "简写形式，例如：/r BTC" },
    { command: "lookup", description: "查询已存档报告，例如：/lookup bitcoin" },
    { command: "l", description: "简写形式，例如：/l BTC" },
    { command: "help", description: "使用说明" },
  ])

  registerCommands(bot)
  scheduleDailyReview(bot)

  console.log("Bot started. Polling...")
  bot.start({ drop_pending_updates: true })
}
```

- [ ] **Step 2: Run typecheck**

```bash
bun run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/bot/index.ts
git commit -m "feat(bot): wire daily review scheduler at startup"
```
