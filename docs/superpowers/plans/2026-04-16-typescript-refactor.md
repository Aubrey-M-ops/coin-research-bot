# TypeScript Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the Python Telegram crypto-research bot to TypeScript (Bun runtime), adding Supabase persistence, using grammY, native fetch, and @anthropic-ai/sdk.

**Architecture:** Each Python file maps 1-to-1 to a TypeScript equivalent; the orchestration model (parallel Promise.all) mirrors the existing asyncio.gather pattern. The DB write is fire-and-forget appended after the Telegram reply, leaving the critical path unchanged.

**Tech Stack:** Bun, TypeScript, grammY, @anthropic-ai/sdk, @supabase/supabase-js, native fetch + AbortController

---

## File Map

| New file | Replaces / purpose |
|---|---|
| `index.ts` | entry point (`bun run index.ts`) |
| `src/bot/index.ts` | `bot.py` – grammY init & polling |
| `src/bot/commands.ts` | `bot.py` – command handlers |
| `src/agent/research.ts` | `agent/research_agent.py` |
| `src/tools/coingecko.ts` | `agent/tools/coingecko.py` |
| `src/tools/dexscreener.ts` | `agent/tools/dexscreener.py` |
| `src/tools/bubblemaps.ts` | `agent/tools/bubblemaps.py` |
| `src/tools/webSearch.ts` | `agent/tools/web_search.py` |
| `src/db/client.ts` | new – Supabase singleton |
| `src/db/coinRepository.ts` | new – upsert logic |
| `src/types/coin.ts` | new – CoinSummary type |
| `src/types/dex.ts` | new – DexPair type |
| `src/types/report.ts` | new – ReportData, BubbleData types |
| `package.json` | new – Bun project manifest |
| `tsconfig.json` | new – TypeScript config |
| `.env.example` | update – add SUPABASE_* vars |

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `index.ts`
- Update: `.env.example`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "crypto-research-bot",
  "version": "1.0.0",
  "scripts": {
    "start": "bun run index.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "grammy": "^1.30.0",
    "@anthropic-ai/sdk": "^0.39.0",
    "@supabase/supabase-js": "^2.49.4"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.0.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src", "index.ts"]
}
```

- [ ] **Step 3: Create `index.ts`** (entry point)

```typescript
import { startBot } from "./src/bot/index.ts"

startBot()
```

- [ ] **Step 4: Update `.env.example`**

```
TELEGRAM_BOT_TOKEN=
ANTHROPIC_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 5: Install dependencies**

```bash
bun install
```

Expected: `node_modules/` created, `bun.lockb` generated.

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json index.ts .env.example bun.lockb
git commit -m "chore: scaffold bun/typescript project"
```

---

## Task 2: Type Definitions

**Files:**
- Create: `src/types/coin.ts`
- Create: `src/types/dex.ts`
- Create: `src/types/report.ts`

- [ ] **Step 1: Create `src/types/coin.ts`**

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
}
```

- [ ] **Step 2: Create `src/types/dex.ts`**

```typescript
export interface DexPair {
  chain: string
  dex: string
  pairAddress: string
  url: string
  priceUsd?: number
  liquidityUsd?: number
  volume24h?: number
  priceChange1hPct?: number
  priceChange24hPct?: number
  buys24h?: number
  sells24h?: number
  fdv?: number
  marketCap?: number
  createdAt?: number
}
```

- [ ] **Step 3: Create `src/types/report.ts`**

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
  claudeAnalysis: string
  bubbleData?: BubbleData
}

export interface CoinAnalysisRecord {
  coin_id: string
  name: string
  symbol: string
  price_usd?: number
  market_cap_usd?: number
  fdv_usd?: number
  volume_24h?: number
  price_change_24h_pct?: number
  top_liquidity_usd?: number
  decentralization_score?: number
  liquidity_assessment: string
  concentration_assessment: string
  claude_analysis: string
  categories: string[]
}
```

- [ ] **Step 4: Verify types compile**

```bash
bun run typecheck
```

Expected: no errors (files only contain interfaces, nothing to fail).

- [ ] **Step 5: Commit**

```bash
git add src/types/
git commit -m "feat: add typescript type definitions"
```

---

## Task 3: Database Layer

**Files:**
- Create: `src/db/client.ts`
- Create: `src/db/coinRepository.ts`

- [ ] **Step 1: Create `src/db/client.ts`**

```typescript
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = Bun.env.SUPABASE_URL
const supabaseKey = Bun.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
}

export const supabase = createClient(supabaseUrl, supabaseKey)
```

- [ ] **Step 2: Create `src/db/coinRepository.ts`**

```typescript
import { supabase } from "./client.ts"
import type { CoinAnalysisRecord } from "../types/report.ts"

export async function upsertCoinAnalysis(data: CoinAnalysisRecord): Promise<void> {
  try {
    const { error } = await supabase
      .from("coin_analyses")
      .upsert(
        {
          ...data,
          last_analyzed_at: new Date().toISOString(),
        },
        {
          onConflict: "coin_id",
          ignoreDuplicates: false,
        }
      )

    if (error) {
      console.error("[db] upsert failed:", error.message)
    }
  } catch (err) {
    console.error("[db] unexpected error:", err)
  }
}
```

Note: Supabase handles `analysis_count = analysis_count + 1` via a database trigger or a custom RPC. For simplicity, the upsert overwrites all metric fields; `first_analyzed_at` is protected by setting it only on INSERT via the table DEFAULT. The increment requires the SQL snippet below to be run in Supabase.

- [ ] **Step 3: Run this SQL in Supabase to create the table (do once manually)**

```sql
CREATE TABLE IF NOT EXISTS coin_analyses (
  coin_id               TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  symbol                TEXT NOT NULL,
  price_usd             NUMERIC,
  market_cap_usd        NUMERIC,
  fdv_usd               NUMERIC,
  volume_24h            NUMERIC,
  price_change_24h_pct  NUMERIC,
  top_liquidity_usd     NUMERIC,
  decentralization_score NUMERIC,
  liquidity_assessment  TEXT,
  concentration_assessment TEXT,
  claude_analysis       TEXT,
  categories            TEXT[],
  analysis_count        INTEGER DEFAULT 1,
  first_analyzed_at     TIMESTAMPTZ DEFAULT NOW(),
  last_analyzed_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to auto-increment analysis_count on update
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

- [ ] **Step 4: Verify types compile**

```bash
bun run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/db/
git commit -m "feat: add supabase db client and coin repository"
```

---

## Task 4: CoinGecko Tool

**Files:**
- Create: `src/tools/coingecko.ts`

- [ ] **Step 1: Create `src/tools/coingecko.ts`**

```typescript
import type { CoinSummary } from "../types/coin.ts"

const BASE = "https://api.coingecko.com/api/v3"

function makeAbort(ms: number): AbortSignal {
  return AbortSignal.timeout(ms)
}

export async function searchCoin(query: string): Promise<{ id: string; platforms: Record<string, string> } | null> {
  try {
    const res = await fetch(`${BASE}/search?query=${encodeURIComponent(query)}`, {
      signal: makeAbort(10_000),
    })
    if (!res.ok) return null
    const data = await res.json() as { coins: Array<{ id: string }> }
    return data.coins?.[0] ?? null
  } catch {
    return null
  }
}

export async function getCoinDetail(coinId: string): Promise<Record<string, unknown> | null> {
  try {
    const params = new URLSearchParams({
      localization: "false",
      tickers: "false",
      market_data: "true",
      community_data: "true",
      developer_data: "false",
    })
    const res = await fetch(`${BASE}/coins/${coinId}?${params}`, {
      signal: makeAbort(15_000),
    })
    if (res.status === 404) return null
    if (!res.ok) return null
    return await res.json() as Record<string, unknown>
  } catch {
    return null
  }
}

export function parseCoinSummary(data: Record<string, unknown>): CoinSummary {
  const market = (data.market_data ?? {}) as Record<string, Record<string, unknown>>
  const links = (data.links ?? {}) as Record<string, unknown>
  const homepageArr = links.homepage as string[] | undefined
  const githubArr = ((links.repos_url as Record<string, string[]> | undefined)?.github) ?? []
  const desc = ((data.description as Record<string, string> | undefined)?.en ?? "").slice(0, 500)

  return {
    name: data.name as string,
    symbol: ((data.symbol as string) ?? "").toUpperCase(),
    description: desc,
    homepage: homepageArr?.[0] ?? "",
    twitter: links.twitter_screen_name as string | undefined,
    telegram: links.telegram_channel_identifier as string | undefined,
    github: githubArr[0],
    priceUsd: (market.current_price?.usd as number | undefined),
    marketCapUsd: (market.market_cap?.usd as number | undefined),
    fdvUsd: (market.fully_diluted_valuation?.usd as number | undefined),
    volume24h: (market.total_volume?.usd as number | undefined),
    priceChange24hPct: market.price_change_percentage_24h as number | undefined,
    priceChange7dPct: market.price_change_percentage_7d as number | undefined,
    circulatingSupply: market.circulating_supply as number | undefined,
    totalSupply: market.total_supply as number | undefined,
    maxSupply: market.max_supply as number | undefined,
    athUsd: (market.ath as Record<string, number> | undefined)?.usd,
    athChangePct: (market.ath_change_percentage as Record<string, number> | undefined)?.usd,
    genesisDate: data.genesis_date as string | undefined,
    categories: (data.categories as string[] | undefined) ?? [],
    sentimentVotesUpPct: data.sentiment_votes_up_percentage as number | undefined,
  }
}
```

- [ ] **Step 2: Verify types compile**

```bash
bun run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/tools/coingecko.ts
git commit -m "feat: add coingecko tool"
```

---

## Task 5: DexScreener Tool

**Files:**
- Create: `src/tools/dexscreener.ts`

- [ ] **Step 1: Create `src/tools/dexscreener.ts`**

```typescript
import type { DexPair } from "../types/dex.ts"

const BASE = "https://api.dexscreener.com/latest/dex"

export async function searchPairs(query: string): Promise<unknown[]> {
  try {
    const res = await fetch(`${BASE}/search?q=${encodeURIComponent(query)}`, {
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return []
    const data = await res.json() as { pairs?: unknown[] }
    return data.pairs ?? []
  } catch {
    return []
  }
}

export function parseTopPairs(pairs: unknown[], maxPairs = 3): DexPair[] {
  const sorted = [...(pairs as Record<string, unknown>[])]
    .sort((a, b) => {
      const liqA = Number((a.liquidity as Record<string, unknown>)?.usd ?? 0)
      const liqB = Number((b.liquidity as Record<string, unknown>)?.usd ?? 0)
      return liqB - liqA
    })

  return sorted.slice(0, maxPairs).map((pair) => {
    const txns = ((pair.txns as Record<string, unknown>)?.h24 ?? {}) as Record<string, number>
    const liq = (pair.liquidity as Record<string, unknown>) ?? {}
    const vol = (pair.volume as Record<string, unknown>) ?? {}
    const change = (pair.priceChange as Record<string, unknown>) ?? {}
    return {
      chain: pair.chainId as string,
      dex: pair.dexId as string,
      pairAddress: pair.pairAddress as string,
      url: pair.url as string,
      priceUsd: Number(pair.priceUsd) || undefined,
      liquidityUsd: Number(liq.usd) || undefined,
      volume24h: Number(vol.h24) || undefined,
      priceChange1hPct: Number(change.h1) || undefined,
      priceChange24hPct: Number(change.h24) || undefined,
      buys24h: txns.buys,
      sells24h: txns.sells,
      fdv: Number(pair.fdv) || undefined,
      marketCap: Number(pair.marketCap) || undefined,
      createdAt: Number(pair.pairCreatedAt) || undefined,
    }
  })
}

export function assessLiquidityRisk(pairs: DexPair[]): string {
  if (pairs.length === 0) return "⚠️ 未找到交易对，极高风险"

  const topLiquidity = pairs[0].liquidityUsd ?? 0

  if (topLiquidity < 50_000) return `🔴 流动性极低 ($${topLiquidity.toLocaleString("en", { maximumFractionDigits: 0 })})，极易被砸盘`
  if (topLiquidity < 500_000) return `🟡 流动性偏低 ($${topLiquidity.toLocaleString("en", { maximumFractionDigits: 0 })})，需谨慎`
  if (topLiquidity < 5_000_000) return `🟢 流动性尚可 ($${topLiquidity.toLocaleString("en", { maximumFractionDigits: 0 })})`
  return `🟢 流动性充足 ($${topLiquidity.toLocaleString("en", { maximumFractionDigits: 0 })})`
}
```

- [ ] **Step 2: Verify types compile**

```bash
bun run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/tools/dexscreener.ts
git commit -m "feat: add dexscreener tool"
```

---

## Task 6: Bubblemaps Tool

**Files:**
- Create: `src/tools/bubblemaps.ts`

- [ ] **Step 1: Create `src/tools/bubblemaps.ts`**

```typescript
import type { BubbleData } from "../types/report.ts"

const API = "https://api-legacy.bubblemaps.io"

export const CHAIN_MAP: Record<string, string> = {
  ethereum: "eth",
  "binance-smart-chain": "bsc",
  avalanche: "avax",
  "polygon-pos": "matic",
  fantom: "ftm",
  "arbitrum-one": "arb",
  "optimistic-ethereum": "op",
  base: "base",
  solana: "sol",
}

export async function getDecentralizationScore(
  contractAddress: string,
  chain: string
): Promise<BubbleData | null> {
  const mappedChain = CHAIN_MAP[chain] ?? chain
  try {
    const params = new URLSearchParams({ token: contractAddress, chain: mappedChain })
    const res = await fetch(`${API}/map-metadata?${params}`, {
      signal: AbortSignal.timeout(15_000),
    })
    if (res.status === 404 || res.status === 400) return null
    if (!res.ok) return null
    const data = await res.json() as Record<string, unknown>
    return {
      decentralizationScore: data.decentralisationScore as number | undefined,
      identifiedSupplyPct: data.identifiedSupply as number | undefined,
      chain: mappedChain,
      contract: contractAddress,
      bubblemapsUrl: `https://app.bubblemaps.io/${mappedChain}/token/${contractAddress}`,
    }
  } catch {
    return null
  }
}

export function assessConcentrationRisk(bubbleData: BubbleData | null): string {
  if (!bubbleData || bubbleData.decentralizationScore == null) {
    return "⚠️ 无法获取持币集中度数据，建议手动查看 Bubblemaps"
  }

  const score = bubbleData.decentralizationScore
  const url = bubbleData.bubblemapsUrl

  let rating: string
  if (score >= 80) rating = "🟢 持币分布良好"
  else if (score >= 60) rating = "🟡 持币较为集中，存在一定风险"
  else if (score >= 40) rating = "🟠 持币高度集中，风险较高"
  else rating = "🔴 持币极度集中，极高风险！"

  return `${rating} (去中心化评分: ${score}/100)\n📊 [查看 Bubblemaps](${url})`
}
```

- [ ] **Step 2: Verify types compile**

```bash
bun run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/tools/bubblemaps.ts
git commit -m "feat: add bubblemaps tool"
```

---

## Task 7: Web Search Tool

**Files:**
- Create: `src/tools/webSearch.ts`

- [ ] **Step 1: Create `src/tools/webSearch.ts`**

```typescript
interface ScamResult {
  text: string
  url: string
  query: string
}

export async function searchScamReports(coinName: string, symbol: string): Promise<ScamResult[]> {
  const queries = [
    `${coinName} ${symbol} rug pull scam`,
    `${coinName} crypto scam warning`,
  ]

  const results: ScamResult[] = []

  for (const query of queries) {
    try {
      const params = new URLSearchParams({
        q: query,
        format: "json",
        no_html: "1",
        skip_disambig: "1",
      })
      const res = await fetch(`https://api.duckduckgo.com/?${params}`, {
        signal: AbortSignal.timeout(10_000),
        headers: { "User-Agent": "Mozilla/5.0" },
      })
      if (!res.ok) continue
      const data = await res.json() as { RelatedTopics?: unknown[] }
      for (const topic of (data.RelatedTopics ?? []).slice(0, 3)) {
        const t = topic as Record<string, string>
        if (t.Text) {
          results.push({ text: t.Text.slice(0, 200), url: t.FirstURL ?? "", query })
        }
      }
    } catch {
      continue
    }
  }

  return results
}

export async function searchTwitterSentiment(coinName: string, symbol: string): Promise<string> {
  const query = encodeURIComponent(`$${symbol} OR ${coinName} scam OR rug OR warning`)
  return `https://twitter.com/search?q=${query}&src=typed_query&f=live`
}

export function formatSentimentSection(
  scamResults: ScamResult[],
  twitterUrl: string,
  coinName: string
): string {
  const lines = [`🔍 *舆情分析 - ${coinName}*\n`]

  if (scamResults.length > 0) {
    lines.push("⚠️ *发现相关警告信息:*")
    for (const r of scamResults.slice(0, 3)) {
      const text = r.text.slice(0, 150).replace(/[*_]/g, "")
      lines.push(`• ${text}`)
      if (r.url) lines.push(`  🔗 ${r.url}`)
    }
  } else {
    lines.push("✅ 未发现明显的诈骗/跑路相关报告")
    lines.push("（建议仍需自行搜索验证）")
  }

  lines.push(`\n🐦 [Twitter 实时搜索](${twitterUrl})`)
  return lines.join("\n")
}
```

- [ ] **Step 2: Verify types compile**

```bash
bun run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/tools/webSearch.ts
git commit -m "feat: add web search tool"
```

---

## Task 8: Research Agent

**Files:**
- Create: `src/agent/research.ts`

- [ ] **Step 1: Create `src/agent/research.ts`**

```typescript
import Anthropic from "@anthropic-ai/sdk"
import { searchCoin, getCoinDetail, parseCoinSummary } from "../tools/coingecko.ts"
import { searchPairs, parseTopPairs, assessLiquidityRisk } from "../tools/dexscreener.ts"
import { getDecentralizationScore, assessConcentrationRisk, CHAIN_MAP } from "../tools/bubblemaps.ts"
import { searchScamReports, searchTwitterSentiment, formatSentimentSection } from "../tools/webSearch.ts"
import { upsertCoinAnalysis } from "../db/coinRepository.ts"
import type { CoinSummary } from "../types/coin.ts"
import type { DexPair } from "../types/dex.ts"
import type { BubbleData } from "../types/report.ts"

const claude = new Anthropic({ apiKey: Bun.env.ANTHROPIC_API_KEY })

export async function researchCoin(query: string): Promise<string> {
  // Step 1: find coin
  const coinMeta = await searchCoin(query)
  if (!coinMeta) return `❌ 未找到与 *${query}* 匹配的代币，请检查名称或 ticker 是否正确。`

  const coinId = coinMeta.id
  const detail = await getCoinDetail(coinId)
  if (!detail) return `❌ 无法获取 *${query}* 的详细信息，CoinGecko 可能暂不收录。`

  const summary = parseCoinSummary(detail)
  const { name, symbol } = summary

  // Step 2: resolve contract address from platforms
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

  // Step 3: parallel fetch
  const [pairsRaw, scamResults, twitterUrl, bubbleData] = await Promise.all([
    searchPairs(`${name} ${symbol}`),
    searchScamReports(name, symbol),
    searchTwitterSentiment(name, symbol),
    contractAddress && chain ? getDecentralizationScore(contractAddress, chain) : Promise.resolve(null),
  ])

  const topPairs = parseTopPairs(pairsRaw)
  const liquidityAssessment = assessLiquidityRisk(topPairs)
  const concentrationAssessment = assessConcentrationRisk(bubbleData)
  const sentimentSection = formatSentimentSection(scamResults, twitterUrl, name)

  // Step 4: Claude analysis
  const context = buildContext(summary, topPairs, liquidityAssessment, concentrationAssessment)
  const claudeAnalysis = await getClaudeAnalysis(name, symbol, context)

  // Step 5: format report
  const report = formatReport(summary, topPairs, liquidityAssessment, concentrationAssessment, sentimentSection, claudeAnalysis)

  // Step 6: fire-and-forget DB write
  void upsertCoinAnalysis({
    coin_id: coinId,
    name,
    symbol,
    price_usd: summary.priceUsd,
    market_cap_usd: summary.marketCapUsd,
    fdv_usd: summary.fdvUsd,
    volume_24h: summary.volume24h,
    price_change_24h_pct: summary.priceChange24hPct,
    top_liquidity_usd: topPairs[0]?.liquidityUsd,
    decentralization_score: bubbleData?.decentralizationScore,
    liquidity_assessment: liquidityAssessment,
    concentration_assessment: concentrationAssessment,
    claude_analysis: claudeAnalysis,
    categories: summary.categories,
  })

  return report
}

function buildContext(
  summary: CoinSummary,
  pairs: DexPair[],
  liquidity: string,
  concentration: string
): string {
  const fdv = summary.fdvUsd
  const mcap = summary.marketCapUsd
  let fdvRatio = ""
  if (fdv && mcap && mcap > 0) {
    fdvRatio = `FDV/市值比: ${(fdv / mcap).toFixed(1)}x`
  }

  let pairInfo = ""
  if (pairs.length > 0) {
    const p = pairs[0]
    pairInfo = `
主要交易对:
- 链: ${p.chain} / DEX: ${p.dex}
- 流动性: $${(p.liquidityUsd ?? 0).toLocaleString("en", { maximumFractionDigits: 0 })}
- 24h 交易量: $${(p.volume24h ?? 0).toLocaleString("en", { maximumFractionDigits: 0 })}
- 买单/卖单(24h): ${p.buys24h ?? "N/A"}/${p.sells24h ?? "N/A"}`
  }

  return `
代币基本信息:
- 名称: ${summary.name} (${summary.symbol})
- 描述: ${summary.description.slice(0, 200)}
- 分类: ${summary.categories.slice(0, 3).join(", ")}
- 市值: $${(summary.marketCapUsd ?? 0).toLocaleString("en", { maximumFractionDigits: 0 })}
- FDV: $${(summary.fdvUsd ?? 0).toLocaleString("en", { maximumFractionDigits: 0 })}
- ${fdvRatio}
- 流通量/总量: ${summary.circulatingSupply ?? "N/A"} / ${summary.totalSupply ?? "N/A"}
- 24h 涨跌: ${summary.priceChange24hPct ?? "N/A"}%
- 7d 涨跌: ${summary.priceChange7dPct ?? "N/A"}%
- 距离 ATH: ${summary.athChangePct ?? "N/A"}%
- 有 GitHub: ${summary.github ? "是" : "否"}
- 有 Twitter: ${summary.twitter ? "是" : "否"}
- 成立日期: ${summary.genesisDate ?? "未知"}
${pairInfo}
流动性评估: ${liquidity}
持币集中度: ${concentration}
`
}

async function getClaudeAnalysis(name: string, symbol: string, context: string): Promise<string> {
  const response = await claude.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 600,
    messages: [
      {
        role: "user",
        content: `你是一个加密货币风险分析专家，专门帮助普通投资者识别风险。

以下是关于 ${name} (${symbol}) 的数据：
${context}

请基于以上数据，用中文提供：
1. **项目概述**（1-2句，说明这个项目做什么）
2. **主要风险点**（列出2-4个具体风险，基于数据）
3. **积极信号**（如果有的话，1-3个）
4. **综合风险评级**：极高 / 高 / 中等 / 较低，并说明原因
5. **新手建议**（1句话）

格式要简洁，适合 Telegram 消息显示。不要使用 markdown 的 ## 标题，用 emoji 区分各部分。
注意：这不是投资建议，只是数据分析。`,
      },
    ],
  })

  return response.content[0].type === "text" ? response.content[0].text : ""
}

function formatReport(
  summary: CoinSummary,
  pairs: DexPair[],
  liquidity: string,
  concentration: string,
  sentiment: string,
  claudeAnalysis: string
): string {
  const { name, symbol, priceUsd, marketCapUsd, priceChange24hPct } = summary

  let priceStr = "N/A"
  if (priceUsd != null) {
    priceStr = priceUsd < 0.01
      ? `$${priceUsd.toFixed(6)}`
      : `$${priceUsd.toFixed(4)}`
  }

  let mcapStr = "N/A"
  if (marketCapUsd != null) {
    mcapStr = marketCapUsd < 1e9
      ? `$${(marketCapUsd / 1e6).toFixed(1)}M`
      : `$${(marketCapUsd / 1e9).toFixed(2)}B`
  }

  const changeStr = priceChange24hPct != null
    ? `${priceChange24hPct > 0 ? "📈" : "📉"} ${priceChange24hPct > 0 ? "+" : ""}${priceChange24hPct.toFixed(1)}%`
    : "N/A"

  const dexUrl = pairs[0]?.url ?? ""
  const linksArr: string[] = []
  if (summary.homepage) linksArr.push(`[官网](${summary.homepage})`)
  if (summary.twitter) linksArr.push(`[Twitter](https://twitter.com/${summary.twitter})`)
  if (dexUrl) linksArr.push(`[DEX图表](${dexUrl})`)
  const linksStr = linksArr.length > 0 ? linksArr.join(" | ") : "暂无链接"

  return `🔬 *${name} (${symbol}) 研究报告*
━━━━━━━━━━━━━━━━━

💰 *市场数据*
• 价格: ${priceStr}
• 市值: ${mcapStr}
• 24h: ${changeStr}

🏦 *流动性*
${liquidity}

👥 *持币分布*
${concentration}

${sentiment}

━━━━━━━━━━━━━━━━━
🤖 *AI 风险分析*

${claudeAnalysis}

━━━━━━━━━━━━━━━━━
🔗 ${linksStr}

⚠️ _以上为数据分析，不构成投资建议。DYOR，小心谨慎。_`
}
```

- [ ] **Step 2: Verify types compile**

```bash
bun run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/agent/research.ts
git commit -m "feat: add research agent orchestrator"
```

---

## Task 9: Telegram Bot

**Files:**
- Create: `src/bot/commands.ts`
- Create: `src/bot/index.ts`

- [ ] **Step 1: Create `src/bot/commands.ts`**

```typescript
import type { Bot } from "grammy"
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

  async function handleResearch(ctx: Parameters<Parameters<Bot["command"]>[1]>[0]): Promise<void> {
    const args = ctx.match?.trim()
    if (!args) {
      await ctx.reply("请提供代币名称或 ticker，例如：\n`/research bitcoin`\n`/r PEPE`", {
        parse_mode: "Markdown",
      })
      return
    }

    const placeholder = await ctx.reply(`🔍 正在研究 *${args}*，请稍候...`, { parse_mode: "Markdown" })

    try {
      const report = await researchCoin(args)
      await ctx.api.editMessageText(ctx.chat.id, placeholder.message_id, report, {
        parse_mode: "Markdown",
        link_preview_options: { is_disabled: true },
      })
    } catch (err) {
      console.error("[bot] research failed:", err)
      const msg = err instanceof Error ? err.message.slice(0, 200) : String(err)
      await ctx.api.editMessageText(
        ctx.chat.id,
        placeholder.message_id,
        `❌ 研究过程中出现错误：${msg}`
      )
    }
  }

  bot.command(["research", "r"], handleResearch)
}
```

- [ ] **Step 2: Create `src/bot/index.ts`**

```typescript
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
```

- [ ] **Step 3: Verify full project compiles**

```bash
bun run typecheck
```

Expected: no errors across all files.

- [ ] **Step 4: Commit**

```bash
git add src/bot/
git commit -m "feat: add grammy telegram bot layer"
```

---

## Task 10: Smoke Test & Cleanup

**Files:**
- No new files — verification only

- [ ] **Step 1: Verify the bot starts without crashing (needs real env vars)**

Copy your `.env.example` to `.env` and fill in valid values for `TELEGRAM_BOT_TOKEN`, `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Then:

```bash
bun run index.ts
```

Expected output:
```
Bot started. Polling...
```

No crash = success. Kill with Ctrl-C.

- [ ] **Step 2: Send `/r BTC` in Telegram**

Open Telegram, send `/r BTC` to your bot. Expected: placeholder message appears, then within ~10s it is edited with a full research report.

- [ ] **Step 3: Verify DB row was written**

In Supabase dashboard → Table editor → `coin_analyses`. Expected: a row with `coin_id = "bitcoin"`.

- [ ] **Step 4: Verify analysis_count increments**

Send `/r BTC` again. Expected: `analysis_count` in the Supabase row is now `2`.

- [ ] **Step 5: Verify error path**

Send `/r XXXXXXXXNOTACOIN`. Expected: bot replies `❌ 未找到与...匹配的代币`.

- [ ] **Step 6: Final commit**

```bash
git add .
git commit -m "feat: complete typescript refactor with supabase persistence"
```

---

## Self-Review Checklist

### Spec coverage

| Spec requirement | Task |
|---|---|
| Bun runtime | Task 1 |
| grammY Telegram | Task 9 |
| native fetch + AbortController | Tasks 4-7 |
| @anthropic-ai/sdk | Task 8 |
| Supabase PostgreSQL | Tasks 3 |
| Directory structure per spec | All tasks |
| CoinSummary, DexPair, BubbleData, ReportData types | Task 2 |
| searchCoin → getCoinDetail → Promise.all pattern | Task 8 |
| Fire-and-forget DB upsert | Task 8 |
| coin_analyses table with all columns | Task 3 |
| Upsert: increment analysis_count, preserve first_analyzed_at | Task 3 |
| AbortController timeouts 10-15s | Tasks 4-7 |
| Error returns null/[], no throw | Tasks 4-7 |
| DB errors silent (console.error only) | Task 3 |
| commands.ts top-level catch → friendly error | Task 9 |
| /research /r /start /help commands | Task 9 |
| src/agent/trading/ reserved (not implemented) | not needed |
| SUPABASE_SERVICE_ROLE_KEY (not anon key) | Tasks 1, 3 |

No gaps found.

### Placeholder scan

No TBD, TODO, "implement later", or "similar to Task N" language found.

### Type consistency

- `CoinSummary` fields use camelCase throughout (priceUsd, marketCapUsd, etc.) ✓
- `DexPair` fields use camelCase (liquidityUsd, buys24h, etc.) ✓
- `CoinAnalysisRecord` uses snake_case to match Supabase column names ✓
- `upsertCoinAnalysis` called in Task 8 with `CoinAnalysisRecord` shape defined in Task 2 ✓
- `BubbleData.decentralizationScore` (camelCase) consistent between Task 2 definition, Task 6 production, and Task 8 consumption ✓
