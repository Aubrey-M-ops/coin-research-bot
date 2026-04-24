# TypeScript 重构设计文档

**日期**: 2026-04-16  
**状态**: 待实现  
**目标**: 将 Python 版 Telegram 加密货币研究 Bot 完整迁移至 TypeScript，新增数据库持久化功能

---

## 技术栈

| 层 | Python（当前） | TypeScript（目标） |
|----|---------------|-------------------|
| Runtime | Python 3.x | Bun |
| Telegram | python-telegram-bot | grammY |
| HTTP | httpx | 内置 `fetch` + AbortController |
| Claude | anthropic Python SDK | @anthropic-ai/sdk |
| 数据库 | 无 | Supabase (PostgreSQL) |
| 环境变量 | python-dotenv | Bun 内置 `Bun.env` |

---

## 目录结构

```
crypto-research-bot/
├── src/
│   ├── bot/
│   │   ├── index.ts          # grammY 初始化与启动
│   │   └── commands.ts       # /research /r /help 指令处理
│   ├── agent/
│   │   ├── research.ts       # 主编排逻辑
│   │   └── trading/          # 预留目录（链上交易，暂空）
│   ├── tools/
│   │   ├── coingecko.ts      # CoinGecko API
│   │   ├── dexscreener.ts    # DexScreener API
│   │   ├── bubblemaps.ts     # Bubblemaps API
│   │   └── webSearch.ts      # DuckDuckGo 舆情搜索
│   ├── db/
│   │   ├── client.ts         # Supabase client 初始化
│   │   └── coinRepository.ts # upsert / query 操作
│   └── types/
│       ├── coin.ts           # CoinSummary, CoinDetail
│       ├── dex.ts            # DexPair
│       └── report.ts         # ReportData
├── index.ts                  # `bun run index.ts` 入口
├── .env.example
├── package.json
└── tsconfig.json
```

---

## 类型定义

### `src/types/coin.ts`

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

### `src/types/dex.ts`

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

### `src/types/report.ts`

```typescript
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
```

---

## 数据流

```
用户: /research BTC
        │
        ▼
commands.ts       发送占位消息"🔍 正在研究..."
        │
        ▼
research.ts
  Step 1: searchCoin(query) → getCoinDetail(coinId)
  Step 2: Promise.all([
            searchPairs(name + symbol),
            searchScamReports(name, symbol),
            searchTwitterSentiment(name, symbol),
            getDecentralizationScore(contract, chain)  // 若有合约地址
          ])
  Step 3: buildContext(summary, pairs, liquidity, concentration)
  Step 4: Claude API → claudeAnalysis
  Step 5: formatReport(...) → reportString
        │
        ├──────► Telegram editMessage(reportString)   ← 主路径
        │
        └──────► void upsertCoinAnalysis(metrics)     ← fire-and-forget，不阻塞
                      │
                      ▼
                 Supabase coin_analyses
```

---

## 数据库设计

### 表：`coin_analyses`

| 字段 | 类型 | 说明 |
|------|------|------|
| `coin_id` | `text` PRIMARY KEY | CoinGecko ID |
| `name` | `text NOT NULL` | 币名 |
| `symbol` | `text NOT NULL` | Ticker |
| `price_usd` | `numeric` | 分析时价格 |
| `market_cap_usd` | `numeric` | 市值 |
| `fdv_usd` | `numeric` | 完全稀释估值 |
| `volume_24h` | `numeric` | 24h 交易量 |
| `price_change_24h_pct` | `numeric` | 24h 涨跌幅 |
| `top_liquidity_usd` | `numeric` | 最大交易对流动性 |
| `decentralization_score` | `numeric` | Bubblemaps 去中心化评分（可空） |
| `liquidity_assessment` | `text` | 流动性文字评估 |
| `claude_analysis` | `text` | Claude 完整分析文本 |
| `categories` | `text[]` | 分类标签数组 |
| `analysis_count` | `integer DEFAULT 1` | 累计分析次数 |
| `first_analyzed_at` | `timestamptz` | 首次分析时间 |
| `last_analyzed_at` | `timestamptz` | 最近分析时间 |

### Upsert 策略

- 以 `coin_id` 为冲突键
- 新币：INSERT 全部字段，`analysis_count = 1`
- 已有：UPDATE 所有 metrics 字段，`analysis_count = analysis_count + 1`，更新 `last_analyzed_at`
- `first_analyzed_at` 在 UPDATE 时不覆盖

### Supabase SQL

```sql
CREATE TABLE coin_analyses (
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
  claude_analysis       TEXT,
  categories            TEXT[],
  analysis_count        INTEGER DEFAULT 1,
  first_analyzed_at     TIMESTAMPTZ DEFAULT NOW(),
  last_analyzed_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 各模块职责

### `src/bot/index.ts`
- 从 `Bun.env` 读取 `TELEGRAM_BOT_TOKEN`
- 初始化 grammY `Bot` 实例
- 注册 commands.ts 中的指令处理器
- 启动 long polling

### `src/bot/commands.ts`
- 处理 `/research`、`/r`、`/start`、`/help`
- 调用 `researchCoin()` 并处理错误
- 不包含业务逻辑

### `src/agent/research.ts`
- 主编排函数 `researchCoin(query: string): Promise<string>`
- 使用 `Promise.all()` 并行调用各 tool
- 调用 Claude API 生成分析
- 格式化最终报告
- 异步触发数据库 upsert（不 await）

### `src/tools/*.ts`
- 每个文件对应一个外部数据源
- 导出 `getXxx()` / `parseXxx()` / `assessXxx()` 函数
- 所有网络请求使用 `fetch` + `AbortController` 超时（10-15s）
- 出错返回 `null` 或 `[]`，不 throw

### `src/db/client.ts`
- 初始化 `@supabase/supabase-js` client（单例）
- 从 `Bun.env` 读取 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY`

### `src/db/coinRepository.ts`
- `upsertCoinAnalysis(data: CoinAnalysisRecord): Promise<void>`
- 错误静默处理（不影响主流程）

---

## 环境变量

```env
TELEGRAM_BOT_TOKEN=
ANTHROPIC_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=   # Bot 是服务端，使用 service role key 绕过 RLS
```

---

## 错误处理原则

- 每个 tool 函数内部 try/catch，失败返回 `null | []`
- 单个数据源失败不中断整体报告生成
- DB 写入失败静默处理，记录 `console.error` 但不影响 Telegram 回复
- `commands.ts` 顶层捕获 `researchCoin()` 的异常，向用户返回友好错误消息

---

## 不在本次范围内

- 链上交易功能（`src/agent/trading/` 目录预留，暂不实现）
- 历史数据查询指令（如 `/history BTC`）
- 多用户权限管理
- 部署配置（Docker / PM2 等）
