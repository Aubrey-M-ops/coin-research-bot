import type { CoinSummary } from "../types/coin"

export interface CoinSearchResult {
  id: string
  platforms: Record<string, string>
}

const BASE = "https://api.coingecko.com/api/v3"

function makeAbortSignal(ms: number): AbortSignal {
  return AbortSignal.timeout(ms)
}

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

export async function searchCoin(query: string): Promise<CoinSearchResult | null> {
  try {
    const params = new URLSearchParams({ query })
    const res = await fetch(`${BASE}/search?${params}`, {
      signal: makeAbortSignal(10_000),
    })
    if (!res.ok) return null

    const data = await res.json() as unknown
    const coins = asRecord(data).coins
    if (!Array.isArray(coins)) return null

    const first = asRecord(coins[0])
    const id = asString(first.id)
    if (!id) return null

    return {
      id,
      platforms: asRecord(first.platforms) as Record<string, string>,
    }
  } catch {
    return null
  }
}

export async function getCoinDetail(coinId: string): Promise<Record<string, unknown> | null> {
  try {
    const params = new URLSearchParams({
      localization: "false",
      tickers: "false",
      market_data: "true",
      community_data: "true",
      developer_data: "false",
    })
    const res = await fetch(`${BASE}/coins/${encodeURIComponent(coinId)}?${params}`, {
      signal: makeAbortSignal(15_000),
    })
    if (res.status === 404) return null
    if (!res.ok) return null

    const data = await res.json() as unknown
    return asRecord(data)
  } catch {
    return null
  }
}

export function parseCoinSummary(data: Record<string, unknown>): CoinSummary {
  const market = asRecord(data.market_data)
  const links = asRecord(data.links)
  const description = asRecord(data.description)
  const reposUrl = asRecord(links.repos_url)

  return {
    name: asString(data.name) ?? "",
    symbol: (asString(data.symbol) ?? "").toUpperCase(),
    description: (asString(description.en) ?? "").slice(0, 500),
    homepage: asStringArray(links.homepage)[0] ?? "",
    twitter: asString(links.twitter_screen_name),
    telegram: asString(links.telegram_channel_identifier),
    github: asStringArray(reposUrl.github)[0],
    priceUsd: asNumber(asRecord(market.current_price).usd),
    marketCapUsd: asNumber(asRecord(market.market_cap).usd),
    fdvUsd: asNumber(asRecord(market.fully_diluted_valuation).usd),
    volume24h: asNumber(asRecord(market.total_volume).usd),
    priceChange24hPct: asNumber(market.price_change_percentage_24h),
    priceChange7dPct: asNumber(market.price_change_percentage_7d),
    circulatingSupply: asNumber(market.circulating_supply),
    totalSupply: asNumber(market.total_supply),
    maxSupply: asNumber(market.max_supply),
    athUsd: asNumber(asRecord(market.ath).usd),
    athChangePct: asNumber(asRecord(market.ath_change_percentage).usd),
    genesisDate: asString(data.genesis_date),
    categories: asStringArray(data.categories),
    sentimentVotesUpPct: asNumber(data.sentiment_votes_up_percentage),
  }
}
