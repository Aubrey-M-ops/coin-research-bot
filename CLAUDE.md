# Crypto Research Bot - Claude 开发规则

## 项目概述
这是一个 Telegram Bot，集成多个数据源（CoinGecko、DexScreener、Bubblemaps）
和 Claude API，帮助用户研究 KOL 推荐的加密货币并识别风险。

## 架构原则

### 并行优先
- 所有独立的 API 调用必须使用 `asyncio.gather()` 并行执行
- 禁止串行等待可以并行的网络请求
- 每个 tool 文件只负责一个数据源，保持单一职责

### 错误处理
- 所有外部 API 调用必须有 try/except，单个数据源失败不能导致整个报告失败
- 网络超时统一设置为 10-15 秒
- 失败时返回 None 或空列表，由上层决定如何展示

### 数据流
```
用户输入 → research_agent.py 编排
         ├── CoinGecko (基本信息)
         ├── DexScreener (流动性)    ← 并行
         ├── Bubblemaps (持币分布)   ← 并行
         └── Web Search (舆情)       ← 并行
         → Claude API (综合分析)
         → 格式化报告 → Telegram
```

## 代码规范

### 文件组织
- `agent/tools/` - 每个文件对应一个外部数据源
- `agent/research_agent.py` - 主编排逻辑，调用各 tool
- `bot.py` - Telegram 接入层，不包含业务逻辑

### 命名规范
- 异步函数使用 async/await
- Tool 文件导出：`get_xxx()` 获取数据，`parse_xxx()` 解析数据，`assess_xxx()` 评估风险
- 避免在 tool 文件中直接格式化 Telegram 消息（在 reporter 层做格式化）

### API Key 管理
- 所有密钥从环境变量读取，禁止硬编码
- 使用 python-dotenv 加载 .env 文件
- .env 文件禁止提交到 git

## 扩展指南

### 添加新数据源
1. 在 `agent/tools/` 创建新文件
2. 实现 `async def get_xxx()` 函数
3. 在 `research_agent.py` 的 `asyncio.gather()` 中添加调用
4. 在 `_format_report()` 中添加展示

### 未来：链上交易功能（规划中）
当添加链上交易功能时：
- 交易逻辑独立放在 `agent/trading/` 目录
- 必须有滑点保护和最大交易金额限制
- 每笔交易前必须重新获取最新价格和流动性数据
- 交易记录必须本地持久化（SQLite）
- 高风险币（流动性 < $50k 或 Bubblemaps < 40分）默认拒绝交易

## 禁止事项
- 禁止在代码中硬编码任何 API key 或私钥
- 禁止在报告中给出"买入"或"卖出"的明确建议
- 禁止跳过错误处理直接 crash
- 禁止同步阻塞 IO（所有网络请求必须 async）
