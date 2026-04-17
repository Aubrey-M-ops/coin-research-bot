export interface ScamResult {
  text: string
  url: string
  query: string
}

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined
}

export async function searchScamReports(coinName: string, symbol: string): Promise<ScamResult[]> {
  const queries = [
    `${coinName} ${symbol} rug pull scam`,
    `${coinName} crypto scam warning`,
    `${symbol} coin fraud investigation`,
  ]

  const results: ScamResult[] = []

  for (const query of queries.slice(0, 2)) {
    try {
      const params = new URLSearchParams({
        q: query,
        format: "json",
        no_html: "1",
        skip_disambig: "1",
      })
      const res = await fetch(`https://api.duckduckgo.com/?${params}`, {
        signal: AbortSignal.timeout(10_000),
        headers: { "User-Agent": "Mozilla/5.0" },
      })
      if (!res.ok) continue

      const data = asRecord(await res.json() as unknown)
      const topics = data.RelatedTopics
      if (!Array.isArray(topics)) continue

      for (const topic of topics.slice(0, 3)) {
        const item = asRecord(topic)
        const text = asString(item.Text)
        if (text) {
          results.push({
            text: text.slice(0, 200),
            url: asString(item.FirstURL) ?? "",
            query,
          })
        }
      }
    } catch {
      continue
    }
  }

  return results
}

export async function searchTwitterSentiment(coinName: string, symbol: string): Promise<string> {
  const query = encodeURIComponent(`$${symbol} OR ${coinName} scam OR rug OR warning`)
  return `https://twitter.com/search?q=${query}&src=typed_query&f=live`
}

export function formatSentimentSection(
  scamResults: ScamResult[],
  twitterUrl: string,
  coinName: string
): string {
  const lines = [`🔍 *舆情分析 - ${coinName}*\n`]

  if (scamResults.length > 0) {
    lines.push("⚠️ *发现相关警告信息:*")
    for (const r of scamResults.slice(0, 3)) {
      const text = r.text.slice(0, 150).replace(/[*_]/g, "")
      lines.push(`• ${text}`)
      if (r.url) lines.push(`  🔗 ${r.url}`)
    }
  } else {
    lines.push("✅ 未发现明显的诈骗/跑路相关报告")
    lines.push("（建议仍需自行搜索验证）")
  }

  lines.push(`\n🐦 [Twitter 实时搜索](${twitterUrl})`)
  return lines.join("\n")
}
