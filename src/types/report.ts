import type { CoinSummary } from "./coin.ts"
import type { DexPair } from "./dex.ts"

export interface BubbleData {
  decentralizationScore?: number
  identifiedSupplyPct?: number
  chain: string
  contract: string
  bubblemapsUrl: string
}

export interface ReportData {
  coinId: string
  summary: CoinSummary
  topPairs: DexPair[]
  liquidityAssessment: string
  concentrationAssessment: string
  fullReport: string
  bubbleData?: BubbleData
}

export interface CoinAnalysisRecord {
  coin_id: string
  name: string
  symbol: string
  market_cap_rank?: number
  price_usd?: number
  market_cap_usd?: number
  fdv_usd?: number
  volume_24h?: number
  price_change_24h_pct?: number
  ath_usd?: number
  ath_change_pct?: number
  circulating_supply?: number
  total_supply?: number
  max_supply?: number
  top_liquidity_usd?: number
  decentralization_score?: number
  sector?: string
  liquidity_assessment: string
  full_report: string
  categories: string[]
}
