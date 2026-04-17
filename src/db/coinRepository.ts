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
