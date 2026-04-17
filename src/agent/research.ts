import Anthropic from "@anthropic-ai/sdk"
import { searchCoin, getCoinDetail, parseCoinSummary } from "../tools/coingecko.ts"
import { searchPairs, parseTopPairs, assessLiquidityRisk } from "../tools/dexscreener.ts"
import { getDecentralizationScore, assessConcentrationRisk, CHAIN_MAP } from "../tools/bubblemaps.ts"
import { searchScamReports, searchTwitterSentiment, formatSentimentSection } from "../tools/webSearch.ts"
import { upsertCoinAnalysis } from "../db/coinRepository.ts"
import type { CoinSummary } from "../types/coin.ts"
import type { DexPair } from "../types/dex.ts"

const claude = new Anthropic({ apiKey: Bun.env.ANTHROPIC_API_KEY })

export async function researchCoin(query: string): Promise<string> {
  const coinMeta = await searchCoin(query)
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
  const sentimentSection = formatSentimentSection(scamResults, twitterUrl, name)
  const context = buildContext(summary, topPairs, liquidityAssessment, concentrationAssessment)
  const claudeAnalysis = await getClaudeAnalysis(name, symbol, context)
  const report = formatReport(
    summary,
    topPairs,
    liquidityAssessment,
    concentrationAssessment,
    sentimentSection,
    claudeAnalysis,
  )

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

  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
}

function formatReport(
  summary: CoinSummary,
  pairs: DexPair[],
  liquidity: string,
  concentration: string,
  sentiment: string,
  claudeAnalysis: string,
): string {
  const { name, symbol, priceUsd, marketCapUsd, priceChange24hPct } = summary

  let priceStr = "N/A"
  if (priceUsd != null) {
    priceStr = priceUsd < 0.01 ? `$${priceUsd.toFixed(6)}` : `$${priceUsd.toFixed(4)}`
  }

  let mcapStr = "N/A"
  if (marketCapUsd != null) {
    mcapStr = marketCapUsd < 1e9 ? `$${(marketCapUsd / 1e6).toFixed(1)}M` : `$${(marketCapUsd / 1e9).toFixed(2)}B`
  }

  const changeStr =
    priceChange24hPct != null
      ? `${priceChange24hPct > 0 ? "📈" : "📉"} ${priceChange24hPct > 0 ? "+" : ""}${priceChange24hPct.toFixed(1)}%`
      : "N/A"

  const dexUrl = pairs[0]?.url ?? ""
  const links: string[] = []
  if (summary.homepage) links.push(`[官网](${summary.homepage})`)
  if (summary.twitter) links.push(`[Twitter](https://twitter.com/${summary.twitter})`)
  if (dexUrl) links.push(`[DEX图表](${dexUrl})`)
  const linksStr = links.length > 0 ? links.join(" | ") : "暂无链接"

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
