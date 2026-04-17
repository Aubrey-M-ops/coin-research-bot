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
  sentimentSection: string
  claudeAnalysis: string
  bubbleData?: BubbleData
}

export interface CoinAnalysisRecord {
  coin_id: string
  name: string
  symbol: string
  price_usd?: number
  market_cap_usd?: number
  fdv_usd?: number
  volume_24h?: number
  price_change_24h_pct?: number
  top_liquidity_usd?: number
  decentralization_score?: number
  liquidity_assessment: string
  concentration_assessment: string
  claude_analysis: string
  categories: string[]
}
