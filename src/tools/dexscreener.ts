import type { DexPair } from "../types/dex"

const BASE = "https://api.dexscreener.com/latest/dex"

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function asNumber(value: unknown): number | undefined {
  const numberValue = typeof value === "number" ? value : Number(value)
  return Number.isFinite(numberValue) ? numberValue : undefined
}

export async function searchPairs(query: string): Promise<unknown[]> {
  try {
    const params = new URLSearchParams({ q: query })
    const res = await fetch(`${BASE}/search?${params}`, {
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return []

    const data = await res.json() as unknown
    const pairs = asRecord(data).pairs
    return Array.isArray(pairs) ? pairs : []
  } catch {
    return []
  }
}

export function parseTopPairs(pairs: unknown[], maxPairs = 3): DexPair[] {
  const sorted = [...pairs]
    .map(asRecord)
    .sort((a, b) => {
      const liqA = asNumber(asRecord(a.liquidity).usd) ?? 0
      const liqB = asNumber(asRecord(b.liquidity).usd) ?? 0
      return liqB - liqA
    })

  return sorted.slice(0, maxPairs).map((pair) => {
    const txns = asRecord(asRecord(pair.txns).h24)
    const liquidity = asRecord(pair.liquidity)
    const volume = asRecord(pair.volume)
    const priceChange = asRecord(pair.priceChange)

    return {
      chain: asString(pair.chainId),
      dex: asString(pair.dexId),
      pairAddress: asString(pair.pairAddress),
      url: asString(pair.url),
      priceUsd: asNumber(pair.priceUsd),
      liquidityUsd: asNumber(liquidity.usd),
      volume24h: asNumber(volume.h24),
      priceChange1hPct: asNumber(priceChange.h1),
      priceChange24hPct: asNumber(priceChange.h24),
      buys24h: asNumber(txns.buys),
      sells24h: asNumber(txns.sells),
      fdv: asNumber(pair.fdv),
      marketCap: asNumber(pair.marketCap),
      createdAt: asNumber(pair.pairCreatedAt),
    }
  })
}

export function assessLiquidityRisk(pairs: DexPair[]): string {
  if (pairs.length === 0) return "⚠️ 未找到交易对，极高风险"

  const topLiquidity = pairs[0].liquidityUsd ?? 0
  const formattedLiquidity = topLiquidity.toLocaleString("en", { maximumFractionDigits: 0 })

  if (topLiquidity < 50_000) return `🔴 流动性极低 ($${formattedLiquidity})，极易被砸盘`
  if (topLiquidity < 500_000) return `🟡 流动性偏低 ($${formattedLiquidity})，需谨慎`
  if (topLiquidity < 5_000_000) return `🟢 流动性尚可 ($${formattedLiquidity})`
  return `🟢 流动性充足 ($${formattedLiquidity})`
}
