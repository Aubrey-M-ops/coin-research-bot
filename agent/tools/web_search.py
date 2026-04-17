"""Web search tool - search for scam/rug reports and sentiment using DuckDuckGo."""
import httpx
from typing import Optional
import urllib.parse


async def search_scam_reports(coin_name: str, symbol: str) -> list[dict]:
    """Search DuckDuckGo for scam/rug pull reports about a coin."""
    queries = [
        f"{coin_name} {symbol} rug pull scam",
        f"{coin_name} crypto scam warning",
        f"{symbol} coin fraud investigation",
    ]
    results = []
    async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
        for query in queries[:2]:  # Limit to 2 queries to avoid rate limiting
            encoded = urllib.parse.quote(query)
            try:
                resp = await client.get(
                    "https://api.duckduckgo.com/",
                    params={
                        "q": query,
                        "format": "json",
                        "no_html": "1",
                        "skip_disambig": "1",
                    },
                    headers={"User-Agent": "Mozilla/5.0"},
                )
                resp.raise_for_status()
                data = resp.json()

                # Extract related topics / results
                for topic in data.get("RelatedTopics", [])[:3]:
                    if isinstance(topic, dict) and topic.get("Text"):
                        results.append({
                            "text": topic.get("Text", "")[:200],
                            "url": topic.get("FirstURL", ""),
                            "query": query,
                        })
            except Exception:
                continue

    return results


async def search_twitter_sentiment(coin_name: str, symbol: str) -> str:
    """Generate a Twitter/X search URL for manual review."""
    query = urllib.parse.quote(f"${symbol} OR {coin_name} scam OR rug OR warning")
    return f"https://twitter.com/search?q={query}&src=typed_query&f=live"


def format_sentiment_section(
    scam_results: list[dict],
    twitter_url: str,
    coin_name: str,
) -> str:
    """Format the sentiment/scam section of the report."""
    lines = [f"🔍 *舆情分析 - {coin_name}*\n"]

    if scam_results:
        lines.append("⚠️ *发现相关警告信息:*")
        for r in scam_results[:3]:
            text = r["text"][:150].replace("*", "").replace("_", "")
            lines.append(f"• {text}")
            if r.get("url"):
                lines.append(f"  🔗 {r['url']}")
    else:
        lines.append("✅ 未发现明显的诈骗/跑路相关报告")
        lines.append("（建议仍需自行搜索验证）")

    lines.append(f"\n🐦 [Twitter 实时搜索]({twitter_url})")
    return "\n".join(lines)
