# Crypto Research Bot

Telegram Bot，输入币名或 ticker，自动聚合多个数据源并调用 Claude AI 生成风险研究报告。

## 功能

- **市场数据** — CoinGecko 价格、市值、FDV、涨跌幅
- **DEX 流动性** — DexScreener 交易对、流动性、买卖单量
- **持币分布** — Bubblemaps 去中心化评分
- **舆情扫描** — DuckDuckGo 自动搜索诈骗/跑路报告
- **AI 风险分析** — Claude 综合评级（极高/高/中等/较低）
- **数据持久化** — Supabase 记录每次分析结果，累计分析次数

## 技术栈

| 层 | 技术 |
|---|---|
| Runtime | Bun |
| Telegram | grammY |
| HTTP | 内置 `fetch` + AbortController |
| AI | @anthropic-ai/sdk (Claude) |
| 数据库 | Supabase (PostgreSQL) |


## 快速开始

### 1. 安装依赖

```bash
bun install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`：

```env
TELEGRAM_BOT_TOKEN=       # BotFather 创建的 Token
ANTHROPIC_API_KEY=        # Anthropic API Key
SUPABASE_URL=             # Supabase 项目 URL
SUPABASE_SERVICE_ROLE_KEY= # Supabase Service Role Key（非 anon key）
```

### 3. 初始化数据库

在 Supabase SQL Editor 中运行 `sql/coin_analyses.sql`。

### 4. 启动

```bash
bun start
```

## Bot 命令

| 命令 | 说明 |
|---|---|
| `/research <币名>` | 完整研究报告 |
| `/r <ticker>` | 简写形式 |
| `/help` | 帮助信息 |

示例：`/r BTC`、`/research pepe coin`

## 数据流

```
用户: /r BTC
  → commands.ts 发送占位消息
  → research.ts
      Step 1: searchCoin() → getCoinDetail()
      Step 2: Promise.all([
                searchPairs(),
                searchScamReports(),
                searchTwitterSentiment(),
                getDecentralizationScore()   ← 有合约地址时
              ])
      Step 3: Claude API 生成分析
      Step 4: formatReport() → editMessage()
      Step 5: void upsertCoinAnalysis()      ← fire-and-forget
```

## 免责声明

本 Bot 仅供数据参考，不构成任何投资建议。DYOR，小心谨慎。
