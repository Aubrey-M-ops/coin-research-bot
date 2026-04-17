export interface CoinSummary {
  name: string
  symbol: string
  description: string
  homepage: string
  twitter?: string
  telegram?: string
  github?: string
  priceUsd?: number
  marketCapUsd?: number
  fdvUsd?: number
  volume24h?: number
  priceChange24hPct?: number
  priceChange7dPct?: number
  circulatingSupply?: number
  totalSupply?: number
  maxSupply?: number
  athUsd?: number
  athChangePct?: number
  genesisDate?: string
  categories: string[]
  sentimentVotesUpPct?: number
}
