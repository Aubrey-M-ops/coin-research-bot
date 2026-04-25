import { supabase } from "./client.ts"
import type { CoinAnalysisRecord } from "../types/report.ts"

export async function upsertCoinAnalysis(data: CoinAnalysisRecord): Promise<void> {
  if (!supabase) {
    console.warn("[db] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing; skipping persistence")
    return
  }

  try {
    const { error } = await supabase.from("coin_analyses").upsert(
      {
        ...data,
        last_analyzed_at: new Date().toISOString(),
      },
      {
        onConflict: "coin_id",
        ignoreDuplicates: false,
      },
    )

    if (error) {
      console.error("[db] upsert failed:", error.message)
    }
  } catch (err) {
    console.error("[db] unexpected error:", err)
  }
}

export interface LeastRecentCoin {
  coin_id: string
  name: string
  symbol: string
  last_analyzed_at: string
  analysis_count: number
}

export async function getLeastRecentlyReviewedCoin(): Promise<LeastRecentCoin | null> {
  if (!supabase) {
    console.warn("[db] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing; skipping getLeastRecentlyReviewedCoin")
    return null
  }

  try {
    const { data, error } = await supabase
      .from("coin_analyses")
      .select("coin_id, name, symbol, last_analyzed_at, analysis_count")
      .order("last_analyzed_at", { ascending: true })
      .limit(1)
      .single()

    if (error) {
      if (error.code === "PGRST116") return null // table is empty
      console.error("[db] getLeastRecentlyReviewedCoin failed:", error.message)
      return null
    }

    return data as LeastRecentCoin
  } catch (err) {
    console.error("[db] unexpected error in getLeastRecentlyReviewedCoin:", err)
    return null
  }
}
