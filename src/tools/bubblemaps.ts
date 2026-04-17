import type { BubbleData } from "../types/report"

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

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
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

    const data = asRecord(await res.json() as unknown)
    return {
      decentralizationScore: asNumber(data.decentralisationScore),
      identifiedSupplyPct: asNumber(data.identifiedSupply),
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
