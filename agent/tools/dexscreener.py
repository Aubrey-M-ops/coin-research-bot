"""DexScreener API tool - fetch DEX liquidity, volume, and trading pair data."""
import httpx
from typing import Optional


DEXSCREENER_BASE = "https://api.dexscreener.com/latest/dex"


async def search_pairs(query: str) -> list[dict]:
    """Search for trading pairs by token name or address."""
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(f"{DEXSCREENER_BASE}/search", params={"q": query})
        resp.raise_for_status()
        return resp.json().get("pairs", []) or []


def parse_top_pairs(pairs: list[dict], max_pairs: int = 3) -> list[dict]:
    """Extract key liquidity/volume info from the top pairs (by liquidity)."""
    sorted_pairs = sorted(
        pairs,
        key=lambda p: float(p.get("liquidity", {}).get("usd", 0) or 0),
        reverse=True,
    )

    result = []
    for pair in sorted_pairs[:max_pairs]:
        txns = pair.get("txns", {}).get("h24", {})
        result.append({
            "chain": pair.get("chainId"),
            "dex": pair.get("dexId"),
            "pair": pair.get("pairAddress"),
            "url": pair.get("url"),
            "price_usd": pair.get("priceUsd"),
            "liquidity_usd": pair.get("liquidity", {}).get("usd"),
            "volume_24h": pair.get("volume", {}).get("h24"),
            "price_change_1h_pct": pair.get("priceChange", {}).get("h1"),
            "price_change_24h_pct": pair.get("priceChange", {}).get("h24"),
            "buys_24h": txns.get("buys"),
            "sells_24h": txns.get("sells"),
            "fdv": pair.get("fdv"),
            "market_cap": pair.get("marketCap"),
            "created_at": pair.get("pairCreatedAt"),
        })
    return result


def assess_liquidity_risk(pairs: list[dict]) -> str:
    """Simple liquidity risk assessment."""
    if not pairs:
        return "⚠️ 未找到交易对，极高风险"

    top_liquidity = float(pairs[0].get("liquidity_usd") or 0)

    if top_liquidity < 50_000:
        return f"🔴 流动性极低 (${top_liquidity:,.0f})，极易被砸盘"
    elif top_liquidity < 500_000:
        return f"🟡 流动性偏低 (${top_liquidity:,.0f})，需谨慎"
    elif top_liquidity < 5_000_000:
        return f"🟢 流动性尚可 (${top_liquidity:,.0f})"
    else:
        return f"🟢 流动性充足 (${top_liquidity:,.0f})"
