# Architecture

## Data Flow

```
User: /r SOL
  → commands.ts      sends placeholder message
  → research.ts
      Step 1: searchCoin() → getCoinDetail()
      Step 2: Promise.all([
                searchPairs(),
                getDecentralizationScore()   ← when contract address is available
              ])
      Step 3: buildContext()                 aggregates data
      Step 4: Claude API                     generates 7-block report
      Step 5: formatReport() → editMessage()
      Step 6: void upsertCoinAnalysis()      fire-and-forget
```

## Report Structure

Each report contains 7 blocks separated by `———`:

| # | Block | Content |
|---|-------|---------|
| 1 | Identity Card | one-liner, category, rank, price, ATH, where to buy |
| 2 | What It Does | plain-language explanation with analogies |
| 3 | Tokenomics | supply, circulation rate, inflation model, holder concentration, FDV/MC ratio |
| 4 | Recent Events | positive catalysts and risk events |
| 5 | Risk Assessment | project / tokenomics / liquidity / regulatory / newbie suitability |
| 6 | Action Reference | DCA strategy, stop-loss / target reference (not investment advice) |
| 7 | Key Takeaways | concepts covered in this research session |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun |
| Telegram | grammY |
| AI | Anthropic SDK (`claude-sonnet-4-6`) |
| Database | Supabase (PostgreSQL) |
| Migrations | Supabase CLI |

## Data Sources

| Source | Data |
|--------|------|
| CoinGecko | price, market cap, FDV, ATH, % change |
| DexScreener | trading pairs, liquidity, buy/sell volume |
| Bubblemaps | decentralization score, holder distribution |

## SSH Deployment Script

The deploy script at `scripts/deploy-ssh.sh` syncs the repo to a remote VPS and restarts the bot process.

### Remote Prerequisites

- `bun` installed on the VPS
- `.env` present in the remote install directory
- SSH access from local machine

### Local Configuration

Create `.env.deploy` in the project root:

```env
VPS_HOST=<your-vps-ip>
VPS_USER=root
INSTALL_DIR=/opt/coin-research-bot
```

Optional overrides:

| Variable | Default |
|----------|---------|
| `VPS_PORT` | `22` |
| `REMOTE_ENV_FILE` | `<INSTALL_DIR>/.env` |
| `DEPLOY_ENV_FILE` | `.env.deploy` |
| `SSH_PORT` | `22` |
| `REMOTE_INSTALL_CMD` | `bun install --frozen-lockfile` |
| `REMOTE_START_CMD` | `bun run start` |
| `REMOTE_PID_FILE` | `<SSH_PATH>/.bot.pid` |
| `REMOTE_LOG_FILE` | `<SSH_PATH>/bot.log` |
| `STARTUP_WAIT_SECONDS` | `5` |
| `DEPLOY_BRANCH` | current local branch |

### Deploy

```bash
bun run deploy:ssh
```

Or override inline:

```bash
bash scripts/deploy-ssh.sh root@example.com /opt/crypto-research-bot
```
