# Report Format & DB Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the Telegram research report to match the 7-block spec, and extend the DB schema to persist all newly required fields.

**Architecture:** Claude generates the full 7-section report as one structured text response; `formatReport()` becomes a thin header/footer wrapper. The DB gains columns for ATH, supply breakdown, market cap rank, and sector, plus renames `claude_analysis` → `full_report`. A SQL migration file handles existing Supabase installations.

**Tech Stack:** TypeScript, Bun, grammY, Anthropic SDK (claude-opus-4-5 → claude-sonnet-4-6), Supabase (PostgreSQL)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/types/coin.ts` | Add `marketCapRank?: number` to `CoinSummary` |
| Modify | `src/tools/coingecko.ts` | Extract `market_cap_rank` in `parseCoinSummary` |
| Modify | `src/types/report.ts` | Update `CoinAnalysisRecord` (new fields, rename `claude_analysis` → `full_report`) |
| Modify | `src/db/coinRepository.ts` | Persist new fields to updated DB schema |
| Modify | `src/agent/research.ts` | New 7-section Claude prompt, enhanced context, simplified `formatReport` |
| Modify | `sql/coin_analyses.sql` | Full new schema (source of truth) |
| Create | `sql/migrate_001_report_format.sql` | ALTER TABLE migration for existing DBs |

---

### Task 1: Add `marketCapRank` to CoinSummary type and coingecko parser

**Files:**
- Modify: `src/types/coin.ts`
- Modify: `src/tools/coingecko.ts`

- [ ] **Step 1: Add field to CoinSummary interface**

  Edit `src/types/coin.ts` — add `marketCapRank?: number` after `sentimentVotesUpPct`:

  ```typescript
  export interface CoinSummary {
    name: string
    symbol: string
    description: string
    homepage: string
    twitter?: string
    telegram?: string
    github?: string
    priceUsd?: number
    marketCapUsd?: number
    fdvUsd?: number
    volume24h?: number
    priceChange24hPct?: number
    priceChange7dPct?: number
    circulatingSupply?: number
    totalSupply?: number
    maxSupply?: number
    athUsd?: number
    athChangePct?: number
    genesisDate?: string
    categories: string[]
    sentimentVotesUpPct?: number
    marketCapRank?: number
  }
  ```

- [ ] **Step 2: Extract `market_cap_rank` in `parseCoinSummary`**

  In `src/tools/coingecko.ts`, add one line to the returned object in `parseCoinSummary` (after `sentimentVotesUpPct`):

  ```typescript
    sentimentVotesUpPct: asNumber(data.sentiment_votes_up_percentage),
    marketCapRank: asNumber(data.market_cap_rank),
  ```

- [ ] **Step 3: Type-check**

  ```bash
  cd /Users/limohan/code_projects/web3/crypto-research-bot && bun tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/types/coin.ts src/tools/coingecko.ts
  git commit -m "feat: add marketCapRank to CoinSummary"
  ```

---

### Task 2: New DB schema and migration SQL

**Files:**
- Modify: `sql/coin_analyses.sql`
- Create: `sql/migrate_001_report_format.sql`

- [ ] **Step 1: Rewrite `sql/coin_analyses.sql` as new source-of-truth schema**

  ```sql
  CREATE TABLE IF NOT EXISTS coin_analyses (
    coin_id                  TEXT PRIMARY KEY,
    name                     TEXT NOT NULL,
    symbol                   TEXT NOT NULL,
    market_cap_rank          INTEGER,
    price_usd                NUMERIC,
    market_cap_usd           NUMERIC,
    fdv_usd                  NUMERIC,
    volume_24h               NUMERIC,
    price_change_24h_pct     NUMERIC,
    ath_usd                  NUMERIC,
    ath_change_pct           NUMERIC,
    circulating_supply       NUMERIC,
    total_supply             NUMERIC,
    max_supply               NUMERIC,
    top_liquidity_usd        NUMERIC,
    decentralization_score   NUMERIC,
    sector                   TEXT,
    liquidity_assessment     TEXT,
    full_report              TEXT,
    categories               TEXT[],
    analysis_count           INTEGER DEFAULT 1,
    first_analyzed_at        TIMESTAMPTZ DEFAULT NOW(),
    last_analyzed_at         TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE OR REPLACE FUNCTION increment_analysis_count()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.analysis_count = OLD.analysis_count + 1;
    NEW.first_analyzed_at = OLD.first_analyzed_at;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  CREATE OR REPLACE TRIGGER on_coin_analysis_update
    BEFORE UPDATE ON coin_analyses
    FOR EACH ROW EXECUTE FUNCTION increment_analysis_count();
  ```

- [ ] **Step 2: Create migration file `sql/migrate_001_report_format.sql`**

  This runs against an existing DB to bring it up to the new schema:

  ```sql
  -- Migration 001: Report format restructure
  -- Run once against existing Supabase DB

  ALTER TABLE coin_analyses
    ADD COLUMN IF NOT EXISTS market_cap_rank        INTEGER,
    ADD COLUMN IF NOT EXISTS ath_usd                NUMERIC,
    ADD COLUMN IF NOT EXISTS ath_change_pct         NUMERIC,
    ADD COLUMN IF NOT EXISTS circulating_supply     NUMERIC,
    ADD COLUMN IF NOT EXISTS total_supply           NUMERIC,
    ADD COLUMN IF NOT EXISTS max_supply             NUMERIC,
    ADD COLUMN IF NOT EXISTS sector                 TEXT,
    ADD COLUMN IF NOT EXISTS full_report            TEXT;

  -- Copy existing claude_analysis into full_report then drop old column
  UPDATE coin_analyses SET full_report = claude_analysis WHERE full_report IS NULL;
  ALTER TABLE coin_analyses DROP COLUMN IF EXISTS claude_analysis;
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add sql/coin_analyses.sql sql/migrate_001_report_format.sql
  git commit -m "feat: add report format fields and migration to DB schema"
  ```

---

### Task 3: Update `CoinAnalysisRecord` type and `coinRepository`

**Files:**
- Modify: `src/types/report.ts`
- Modify: `src/db/coinRepository.ts`

- [ ] **Step 1: Update `CoinAnalysisRecord` in `src/types/report.ts`**

  Replace the entire file content:

  ```typescript
  import type { CoinSummary } from "./coin.ts"
  import type { DexPair } from "./dex.ts"

  export interface BubbleData {
    decentralizationScore?: number
    identifiedSupplyPct?: number
    chain: string
    contract: string
    bubblemapsUrl: string
  }

  export interface ReportData {
    coinId: string
    summary: CoinSummary
    topPairs: DexPair[]
    liquidityAssessment: string
    concentrationAssessment: string
    sentimentSection: string
    fullReport: string
    bubbleData?: BubbleData
  }

  export interface CoinAnalysisRecord {
    coin_id: string
    name: string
    symbol: string
    market_cap_rank?: number
    price_usd?: number
    market_cap_usd?: number
    fdv_usd?: number
    volume_24h?: number
    price_change_24h_pct?: number
    ath_usd?: number
    ath_change_pct?: number
    circulating_supply?: number
    total_supply?: number
    max_supply?: number
    top_liquidity_usd?: number
    decentralization_score?: number
    sector?: string
    liquidity_assessment: string
    full_report: string
    categories: string[]
  }
  ```

- [ ] **Step 2: Update `coinRepository.ts` — no logic changes needed, just verify upsert still works**

  The `upsertCoinAnalysis` function uses spread (`...data`), so it automatically picks up new fields from the updated type. Verify the file looks correct:

  ```typescript
  import { supabase } from "./client.ts"
  import type { CoinAnalysisRecord } from "../types/report.ts"

  export async function upsertCoinAnalysis(data: CoinAnalysisRecord): Promise<void> {
    if (!supabase) {
      console.warn("[db] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing; skipping persistence")
      return
    }

    try {
      const { error } = await supabase.from("coin_analyses").upsert(
        {
          ...data,
          last_analyzed_at: new Date().toISOString(),
        },
        {
          onConflict: "coin_id",
          ignoreDuplicates: false,
        },
      )

      if (error) {
        console.error("[db] upsert failed:", error.message)
      }
    } catch (err) {
      console.error("[db] unexpected error:", err)
    }
  }
  ```

- [ ] **Step 3: Type-check**

  ```bash
  cd /Users/limohan/code_projects/web3/crypto-research-bot && bun tsc --noEmit
  ```

  Expected: errors only in `research.ts` (because `claude_analysis` is now `full_report` in the type) — those are fixed in Task 4.

- [ ] **Step 4: Commit**

  ```bash
  git add src/types/report.ts src/db/coinRepository.ts
  git commit -m "feat: update CoinAnalysisRecord with report format fields"
  ```

---

### Task 4: Rewrite `research.ts` — 7-section Claude prompt + simplified formatReport

**Files:**
- Modify: `src/agent/research.ts`

This is the core task. Claude now generates the full 7-block report. `formatReport` wraps it with a header and disclaimer.

- [ ] **Step 1: Replace `buildContext` to include all new fields**

  Replace the `buildContext` function (lines 87-130 in current file):

  ```typescript
  function buildContext(
    summary: CoinSummary,
    pairs: DexPair[],
    liquidity: string,
    concentration: string,
  ): string {
    const fdv = summary.fdvUsd
    const mcap = summary.marketCapUsd
    let fdvRatio = "N/A"
    if (fdv && mcap && mcap > 0) {
      fdvRatio = `${(fdv / mcap).toFixed(1)}x`
    }

    const circulationRate =
      summary.circulatingSupply && summary.maxSupply
        ? `${((summary.circulatingSupply / summary.maxSupply) * 100).toFixed(1)}%`
        : summary.circulatingSupply && summary.totalSupply
          ? `${((summary.circulatingSupply / summary.totalSupply) * 100).toFixed(1)}%`
          : "N/A"

    const formatNum = (n?: number) =>
      n == null ? "N/A" : n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${n.toLocaleString("en")}`

    const formatSupply = (n?: number) =>
      n == null ? "N/A" : n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n.toLocaleString("en")

    let pairInfo = "暂无 DEX 数据"
    if (pairs.length > 0) {
      const p = pairs[0]
      pairInfo = `链: ${p.chain} / DEX: ${p.dex} / 流动性: ${formatNum(p.liquidityUsd)} / 24h量: ${formatNum(p.volume24h)} / 买单/卖单(24h): ${p.buys24h ?? "N/A"}/${p.sells24h ?? "N/A"}`
    }

    return `代币数据:
  名称: ${summary.name} (${summary.symbol})
  CoinGecko 排名: #${summary.marketCapRank ?? "N/A"}
  描述: ${summary.description.slice(0, 300)}
  分类: ${summary.categories.slice(0, 4).join(", ")}
  当前价格: $${summary.priceUsd ?? "N/A"}
  市值: ${formatNum(summary.marketCapUsd)}
  FDV: ${formatNum(summary.fdvUsd)}
  FDV/市值比: ${fdvRatio}
  24h 成交量: ${formatNum(summary.volume24h)}
  ATH: $${summary.athUsd ?? "N/A"} (当前距 ATH ${summary.athChangePct?.toFixed(1) ?? "N/A"}%)
  24h 涨跌: ${summary.priceChange24hPct?.toFixed(2) ?? "N/A"}%
  7d 涨跌: ${summary.priceChange7dPct?.toFixed(2) ?? "N/A"}%
  流通量: ${formatSupply(summary.circulatingSupply)}
  总供应量: ${formatSupply(summary.totalSupply)}
  最大供应量: ${formatSupply(summary.maxSupply)} ${summary.maxSupply == null ? "(无上限)" : ""}
  流通率: ${circulationRate}
  有 GitHub: ${summary.github ? "是" : "否"}
  成立日期: ${summary.genesisDate ?? "未知"}
  主要 DEX: ${pairInfo}
  流动性评估: ${liquidity}
  持币集中度: ${concentration}
  `
  }
  ```

- [ ] **Step 2: Replace `getClaudeAnalysis` with 7-section prompt**

  Replace the `getClaudeAnalysis` function (lines 132-161 in current file):

  ```typescript
  async function getClaudeAnalysis(name: string, symbol: string, context: string): Promise<string> {
    const response = await claude.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `你是加密货币研究助手，帮助零经验新手学习币种知识。用户只有 OKX 钱包，初始预算 $50，当前只做现货不开合约。

以下是 ${name} (${symbol}) 的数据：
${context}

请严格按照以下 7 个区块输出报告，使用 Telegram Markdown 格式（*粗体*、_斜体_，不用 ## 标题）。每个区块用分隔线 ——— 分开。

*① 身份卡片*
• 一句话定位: [用大白话说这个币是什么，不用术语]
• 类别: [Layer 1/Layer 2/DeFi/Meme/AI+Web3/GameFi/RWA/稳定币]
• 市值排名: #[CoinGecko排名]
• 当前价格: $[价格]
• 历史最高 ATH: $[ATH]（当前距 ATH [%]）
• 所在链: [自身是链 / 基于哪条链]
• 在哪买: [✅ OKX 现货 可买 / ❌ OKX 未上线，需 DEX]（依据市值排名和知名度判断）

———

*② 项目是干什么的*
[3-5句大白话解释，必须包含一个类比。如果是 Meme 币，直接说明没有实际用途。]

———

*③ 代币经济学*
• 最大供应量: [数量] — [🟢健康/🟡注意/🔴危险: 原因一句话]
• 流通量/流通率: [数量] / [%] — [🟢/🟡/🔴: 原因]
• 通胀模型: [有/无 burn / staking / 增发，🟢/🟡/🔴]
• 大户集中度: [Bubblemaps分数或描述] — [🟢/🟡/🔴: 原因]
• FDV/市值比: [倍数] — [🟢/🟡/🔴: 低=健康，高=未来抛压大]
• 近期解锁: [如有已知解锁事件说明，否则写"暂无已知大额解锁"]

_术语: FDV = 完全稀释估值（假设所有币都流通时的市值）; 流通率 = 已流通 ÷ 最大供应量_

———

*④ 近期动态*
🟢 利好:
• [事件1，约什么时候]
• [事件2]

🔴 风险:
• [风险事件1]
• [风险事件2]

（若无近期重大事件，直接写"近期无重大催化剂"）

———

*⑤ 风险评估*
• 项目风险: [🟢/🟡/🔴] [一句话]
• 代币经济风险: [🟢/🟡/🔴] [一句话]
• 流动性风险: [🟢/🟡/🔴] [一句话]
• 监管风险: [🟢/🟡/🔴] [一句话]
• 新手适合度: [🟢适合/🟡谨慎/🔴不建议] [一句话理由]

综合风险: [🟢/🟡/🔴] [总结一句]

———

*⑥ 操作参考*
⚠️ _非投资建议，仅供练习建立买入逻辑_
• 买入方式: [DCA分几次 或 一次性，基于$50预算]
• 建议单次金额: $[X]（占$50预算[%]）
• 止损参考: -15% ~ -20%，即跌至 $[价格] 考虑止损
• 目标参考: [合理目标%]，即 $[价格]
• 持有周期: [短期<1周/中期1-3月/长期>3月]

_DCA = 分批买入，避免一次梭哈在最高点_

———

*⑦ 学习收获*
本次研究涉及的关键概念：
• [ ] [概念A] — [一句话解释]
• [ ] [概念B] — [一句话解释]
• [ ] [概念C] — [一句话解释]

新术语: [术语1], [术语2], [术语3]`,
        },
      ],
    })

    return response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
  }
  ```

- [ ] **Step 3: Replace `formatReport` with thin wrapper**

  Replace the `formatReport` function (lines 163-220 in current file):

  ```typescript
  function formatReport(name: string, symbol: string, claudeReport: string): string {
    return `🔬 *${name} (${symbol}) 研究报告*
  ━━━━━━━━━━━━━━━━━

  ${claudeReport}

  ━━━━━━━━━━━━━━━━━
  ⚠️ _以上为数据分析，不构成投资建议。DYOR，小心谨慎。_`
  }
  ```

- [ ] **Step 4: Update `researchCoin` to use new signatures and persist new fields**

  Replace the entire `researchCoin` function and its upsert call:

  ```typescript
  export async function researchCoin(query: string): Promise<string> {
    const normalized = normalizeQuery(query)
    const coinMeta = await searchCoin(normalized) ?? (normalized !== query ? await searchCoin(query) : null)
    if (!coinMeta) return `❌ 未找到与 *${query}* 匹配的代币，请检查名称或 ticker 是否正确。`

    const coinId = coinMeta.id
    const detail = await getCoinDetail(coinId)
    if (!detail) return `❌ 无法获取 *${query}* 的详细信息，CoinGecko 可能暂不收录。`

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

    const [pairsRaw, scamResults, twitterUrl, bubbleData] = await Promise.all([
      searchPairs(`${name} ${symbol}`),
      searchScamReports(name, symbol),
      searchTwitterSentiment(name, symbol),
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

  Also remove the now-unused `sentimentSection` / `formatSentimentSection` import and variable (sentiment context is already in Claude's knowledge; the web search results were previously formatted separately but now Claude handles all sections — keep `scamResults` and `twitterUrl` in `Promise.all` for now, they can be removed in a separate cleanup PR, or you may remove them here if you confirm `formatSentimentSection` is not called anywhere else).

  **Remove these unused imports from the top of `research.ts`:**
  ```typescript
  // Remove: formatSentimentSection
  import { searchScamReports, searchTwitterSentiment } from "../tools/webSearch.ts"
  ```

  **Keep** `searchScamReports` and `searchTwitterSentiment` in the Promise.all but stop using their results in the report (they still run for future use). Alternatively, remove them for clean code:

  ```typescript
  // Clean version — remove unused web search calls entirely:
  const [pairsRaw, bubbleData] = await Promise.all([
    searchPairs(`${name} ${symbol}`),
    contractAddress && chain ? getDecentralizationScore(contractAddress, chain) : Promise.resolve(null),
  ])
  ```

  And remove the `webSearch.ts` import entirely:
  ```typescript
  // Remove this import:
  import { searchScamReports, searchTwitterSentiment, formatSentimentSection } from "../tools/webSearch.ts"
  ```

- [ ] **Step 5: Type-check**

  ```bash
  cd /Users/limohan/code_projects/web3/crypto-research-bot && bun tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 6: Commit**

  ```bash
  git add src/agent/research.ts
  git commit -m "feat: restructure report to 7-block spec, upgrade to claude-sonnet-4-6"
  ```

---

### Task 5: Run migration against Supabase and verify end-to-end

**Files:** none (operational step)

- [ ] **Step 1: Run migration SQL in Supabase**

  Go to Supabase Dashboard → SQL Editor → paste and run `sql/migrate_001_report_format.sql`. Verify output: no errors, `full_report` column exists.

- [ ] **Step 2: Start the bot locally**

  ```bash
  cd /Users/limohan/code_projects/web3/crypto-research-bot && bun run index.ts
  ```

  Expected: "Bot started" log, no startup errors.

- [ ] **Step 3: Send test command in Telegram**

  Send `/r SOL` to the bot. Expected:
  - Bot replies with "正在研究..."
  - Within ~15 seconds, message updates to full 7-section report
  - Section ① shows identity card with OKX status
  - Section ③ shows tokenomics with 🟢/🟡/🔴 signals
  - Section ⑦ shows learning takeaways with checkboxes

- [ ] **Step 4: Verify DB record**

  In Supabase Dashboard → Table Editor → `coin_analyses`, confirm the SOL row has:
  - `market_cap_rank` populated (e.g. 5)
  - `ath_usd` populated
  - `full_report` populated with the full report text
  - `claude_analysis` column no longer exists

- [ ] **Step 5: Test edge case — unknown coin**

  Send `/r xyzabc123notreal`. Expected: `❌ 未找到与 *xyzabc123notreal* 匹配的代币...`

- [ ] **Step 6: Commit**

  ```bash
  git add -p  # stage any env or minor fixups if needed
  git commit -m "chore: verify migration and end-to-end report format"
  ```

---

## Spec Coverage Check

| Spec Section | Task(s) | Status |
|---|---|---|
| ① 一句话定位 + 身份卡片 (price, ATH, rank, chain, OKX) | Task 1 + Task 4 | ✅ |
| ② 大白话解释 + 类比 | Task 4 Claude prompt | ✅ |
| ③ Tokenomics table with 🟢/🟡/🔴 | Task 4 Claude prompt | ✅ |
| ④ 近期动态 & 催化剂 | Task 4 Claude prompt | ✅ |
| ⑤ 风险评估 5维度交通灯 | Task 4 Claude prompt | ✅ |
| ⑥ 操作参考 (DCA, 止损, 目标位) | Task 4 Claude prompt | ✅ |
| ⑦ 学习收获 checkboxes | Task 4 Claude prompt | ✅ |
| DB: ATH, circulating/total/max supply, rank, sector | Task 2 + Task 3 | ✅ |
| DB: migration for existing installations | Task 2 | ✅ |
