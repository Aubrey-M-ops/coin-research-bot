export interface DexPair {
  chain: string
  dex: string
  pairAddress: string
  url: string
  priceUsd?: number
  liquidityUsd?: number
  volume24h?: number
  priceChange1hPct?: number
  priceChange24hPct?: number
  buys24h?: number
  sells24h?: number
  fdv?: number
  marketCap?: number
  createdAt?: number
}
