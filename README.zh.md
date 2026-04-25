<div align="right">
  <a href="README.md">English</a>
</div>

# Crypto Research Bot

一个 Telegram 机器人，聚合多个链上与市场数据源，并使用 Claude AI 生成结构化的代币研究报告。

## 功能

- **市场数据** — 通过 CoinGecko 获取价格、市值、FDV、ATH 及涨跌幅
- **DEX 流动性** — 通过 DexScreener 获取交易对、流动性深度及买卖量
- **持币分布** — 通过 Bubblemaps 获取去中心化评分
- **AI 分析** — Claude 生成涵盖代币经济学、风险与关键结论的 7 模块报告
- **历史存档** — 每份报告存入 Supabase，随时用 `/lookup` 调取历史分析

## 命令

| 命令 | 说明 |
|------|------|
| `/research <token>` | 完整 7 模块研究报告 |
| `/r <ticker>` | 简写形式 |
| `/lookup <token>` | 查询已存档报告 |
| `/l <ticker>` | 简写形式 |
| `/help` | 显示帮助 |

**示例：** `/r BTC` · `/research pepe coin` · `/l WIF`

## 快速开始

### 前置条件

- [Bun](https://bun.sh) >= 1.0
- [Telegram Bot Token](https://t.me/BotFather)
- [Anthropic API Key](https://console.anthropic.com)
- [Supabase](https://supabase.com) 项目

### 安装依赖

```bash
bun install
```

### 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`：

```env
TELEGRAM_BOT_TOKEN=        # 来自 BotFather
TELEGRAM_BOT_CHAT_ID=      # 你的 Telegram 用户 ID（用于接收每日复习）
ANTHROPIC_API_KEY=         # 来自 Anthropic 控制台
SUPABASE_URL=              # Supabase 项目 URL
SUPABASE_SERVICE_ROLE_KEY= # Service Role Key（非 anon key）
```

### 初始化数据库

```bash
supabase db push
```

### 运行

```bash
bun start
```

## 部署

参见 [docs/architecture.md](docs/architecture.md) 了解 SSH 部署指南和完整数据流文档。

## 作者

[@MorningM](https://github.com/MorningM)

## 免责声明

本机器人仅供信息参考，不构成任何投资建议。DYOR。
