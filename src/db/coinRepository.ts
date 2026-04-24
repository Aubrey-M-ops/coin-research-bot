import { supabase } from "./client.ts"
import type { CoinAnalysisRecord } from "../types/report.ts"

export interface CoinLookupResult {
  name: string
  symbol: string
  full_report: string
  last_analyzed_at: string
  analysis_count: number
}

export async function queryCoinAnalysis(query: string): Promise<CoinLookupResult | null> {
  if (!supabase) {
    console.warn("[db] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing; skipping lookup")
    return null
  }

  const normalized = query.trim()

  try {
    // Try exact symbol match first (case-insensitive), then name contains match
    const { data, error } = await supabase
      .from("coin_analyses")
      .select("name, symbol, full_report, last_analyzed_at, analysis_count")
      .or(`symbol.ilike.${normalized},name.ilike.%${normalized}%`)
      .order("last_analyzed_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error("[db] query failed:", error.message)
      return null
    }

    return data
  } catch (err) {
    console.error("[db] unexpected error:", err)
    return null
  }
}

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
