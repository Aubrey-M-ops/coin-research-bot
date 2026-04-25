<div align="right">
  <a href="README.zh.md">中文</a>
</div>

# Crypto Research Bot

A Telegram bot that aggregates on-chain and market data from multiple sources and uses Claude AI to generate structured research reports on any crypto token.

## Features

- **Market data** — price, market cap, FDV, ATH, and % change via CoinGecko
- **DEX liquidity** — trading pairs, liquidity depth, and buy/sell volume via DexScreener
- **Holder distribution** — decentralization score via Bubblemaps
- **AI analysis** — Claude generates a structured 7-block report covering tokenomics, risk, and key takeaways
- **Persistent history** — every report is stored in Supabase; look up past analyses instantly with `/lookup`

## Commands

| Command | Description |
|---------|-------------|
| `/research <token>` | Full 7-block research report |
| `/r <ticker>` | Shorthand |
| `/lookup <token>` | Retrieve an archived report |
| `/l <ticker>` | Shorthand |
| `/help` | Show help |

**Examples:** `/r BTC` · `/research pepe coin` · `/l WIF`

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) >= 1.0
- A [Telegram bot token](https://t.me/BotFather)
- An [Anthropic API key](https://console.anthropic.com)
- A [Supabase](https://supabase.com) project

### Install

```bash
bun install
```

### Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
TELEGRAM_BOT_TOKEN=        # from BotFather
TELEGRAM_BOT_CHAT_ID=      # your Telegram user ID (for daily review DMs)
ANTHROPIC_API_KEY=         # from Anthropic console
SUPABASE_URL=              # your Supabase project URL
SUPABASE_SERVICE_ROLE_KEY= # service role key (not anon key)
```

### Initialize the database

```bash
supabase db push
```

### Run

```bash
bun start
```

## Deployment

See [docs/architecture.md](docs/architecture.md) for the SSH deployment guide and full data flow documentation.

## Author

[@MorningM🍦](https://github.com/MorningM)

## Disclaimer

This bot is for informational purposes only and does not constitute investment advice. DYOR.
