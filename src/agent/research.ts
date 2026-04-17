import Anthropic from "@anthropic-ai/sdk"
import { searchCoin, getCoinDetail, parseCoinSummary } from "../tools/coingecko.ts"
import { searchPairs, parseTopPairs, assessLiquidityRisk } from "../tools/dexscreener.ts"
import { getDecentralizationScore, assessConcentrationRisk, CHAIN_MAP } from "../tools/bubblemaps.ts"
import { upsertCoinAnalysis } from "../db/coinRepository.ts"
import type { CoinSummary } from "../types/coin.ts"
import type { DexPair } from "../types/dex.ts"

const claude = new Anthropic({ apiKey: Bun.env.ANTHROPIC_API_KEY })

function normalizeQuery(query: string): string {
  return query
    .trim()
    .replace(/\b(coin|token|crypto|protocol|finance|network|chain)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
}

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
    concentration_assessment: concentrationAssessment,
    full_report: claudeReport,
    categories: summary.categories,
  }).catch((err) => {
    console.error("[research] failed to persist coin analysis:", err)
  })

  return report
}

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
最大供应量: ${formatSupply(summary.maxSupply)}${summary.maxSupply == null ? " (无上限)" : ""}
流通率: ${circulationRate}
有 GitHub: ${summary.github ? "是" : "否"}
成立日期: ${summary.genesisDate ?? "未知"}
主要 DEX: ${pairInfo}
流动性评估: ${liquidity}
持币集中度: ${concentration}
`
}

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

请严格按照以下 7 个区块输出报告，使用 Telegram Markdown 格式（*粗体*、_斜体_，不用 ## 标题）。每个区块用 ——— 分隔。

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

function formatReport(name: string, symbol: string, claudeReport: string): string {
  return `🔬 *${name} (${symbol}) 研究报告*
━━━━━━━━━━━━━━━━━

${claudeReport}

━━━━━━━━━━━━━━━━━
⚠️ _以上为数据分析，不构成投资建议。DYOR，小心谨慎。_`
}
