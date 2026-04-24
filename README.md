# Crypto Research Bot

Telegram Bot — 直接与 Bot 私聊，输入币名或 ticker，自动聚合多个数据源并调用 Claude AI 生成结构化研究报告。

## 功能

- **市场数据** — CoinGecko 价格、市值、FDV、ATH、涨跌幅
- **DEX 流动性** — DexScreener 交易对、流动性、买卖单量
- **持币分布** — Bubblemaps 去中心化评分
- **AI 结构化分析** — Claude 生成 7 区块报告（身份卡片、项目解读、代币经济学、近期动态、风险评估、操作参考、学习收获）
- **数据持久化** — Supabase 记录每次分析结果，累计分析次数

## 技术栈

| 层 | 技术 |
|---|---|
| Runtime | Bun |
| Telegram | grammY |
| AI | Anthropic SDK (claude-sonnet-4-6) |
| 数据库 | Supabase (PostgreSQL) |
| 迁移 | Supabase CLI |

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
TELEGRAM_BOT_TOKEN=        # BotFather 创建的 Token
ANTHROPIC_API_KEY=         # Anthropic API Key
SUPABASE_URL=              # Supabase 项目 URL
SUPABASE_SERVICE_ROLE_KEY= # Supabase Service Role Key（非 anon key）
```

### 3. 初始化数据库

```bash
supabase db push
```

### 4. 启动

```bash
bun start
```

## SSH 部署并重跑

项目已包含 SSH 部署脚本，会把当前仓库同步到远端服务器并在远端重启 bot 进程。

### 1. 远端前置条件

- 已安装 `bun`
- 远端部署目录中存在 `.env`
- 本地可通过 SSH 登录目标机器

### 2. 配置本地部署目标

在本机创建 `.env.deploy`：

```env
VPS_HOST=178.156.196.115
VPS_USER=root
INSTALL_DIR=/opt/coin-research-bot
```

可选：

- `VPS_PORT`：SSH 端口，默认 `22`
- `REMOTE_ENV_FILE`：远端环境文件路径，默认 `<INSTALL_DIR>/.env`

### 3. 在 MacBook 上执行部署

```bash
bun run deploy:ssh
```

脚本会在本机：

- 读取 `.env.deploy`
- 通过 SSH / rsync 同步当前仓库到 VPS
- 在 VPS 上执行 `bun install --frozen-lockfile`
- 停掉旧的 bot 进程并重新运行 `bun run start`
- 检查 bot 是否成功启动，并输出日志

也可以直接覆盖配置：

```bash
bash scripts/deploy-ssh.sh root@example.com /opt/crypto-research-bot
```

可选环境变量：

- `DEPLOY_ENV_FILE`：本地部署配置文件，默认 `.env.deploy`
- `SSH_PORT`：SSH 端口，默认 `22`
- `REMOTE_ENV_FILE`：远端环境文件路径，默认 `<SSH_PATH>/.env`
- `REMOTE_INSTALL_CMD`：远端安装依赖命令，默认 `bun install --frozen-lockfile`
- `REMOTE_START_CMD`：远端启动命令，默认 `bun run start`
- `REMOTE_PID_FILE`：远端 PID 文件，默认 `<SSH_PATH>/.bot.pid`
- `REMOTE_LOG_FILE`：远端日志文件，默认 `<SSH_PATH>/bot.log`
- `STARTUP_WAIT_SECONDS`：启动后等待检查秒数，默认 `5`
- `DEPLOY_BRANCH`：仅用于远端日志展示，默认读取当前本地分支

脚本远端会执行：

```bash
bun install --frozen-lockfile
bun run start
```

## Bot 命令

在 Telegram 中直接与 Bot 私聊：

| 命令 | 说明 |
|---|---|
| `/research <币名>` | 完整 7 区块研究报告（实时拉取数据） |
| `/r <ticker>` | 简写形式 |
| `/lookup <币名>` | 查询已存档报告 |
| `/l <ticker>` | 简写形式 |
| `/help` | 帮助信息 |

示例：`/r BTC`、`/research pepe coin`、`/l WIF`

## 报告结构

每份报告包含 7 个区块，用 `———` 分隔：

1. **身份卡片** — 一句话定位、类别、排名、价格、ATH、在哪买
2. **项目是干什么的** — 大白话 + 类比解释
3. **代币经济学** — 供应量、流通率、通胀模型、大户集中度、FDV/市值比
4. **近期动态** — 利好与风险事件
5. **风险评估** — 项目/代币经济/流动性/监管/新手适合度
6. **操作参考** — DCA 策略、止损/目标参考（非投资建议）
7. **学习收获** — 本次研究涉及的关键概念

## 数据流

```
用户: /r SOL
  → commands.ts 发送占位消息
  → research.ts
      Step 1: searchCoin() → getCoinDetail()
      Step 2: Promise.all([
                searchPairs(),
                getDecentralizationScore()  ← 有合约地址时
              ])
      Step 3: buildContext() 整理数据
      Step 4: Claude API 生成完整 7 区块报告
      Step 5: formatReport() → editMessage()
      Step 6: void upsertCoinAnalysis()     ← fire-and-forget
```

## 免责声明

本 Bot 仅供数据参考，不构成任何投资建议。DYOR，小心谨慎。
