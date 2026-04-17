"""CoinGecko API tool - fetch basic coin info, market data, and metadata."""
import httpx
from typing import Optional


COINGECKO_BASE = "https://api.coingecko.com/api/v3"


async def search_coin(query: str) -> Optional[dict]:
    """Search for a coin by name or ticker symbol."""
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(f"{COINGECKO_BASE}/search", params={"query": query})
        resp.raise_for_status()
        coins = resp.json().get("coins", [])
        if not coins:
            return None
        return coins[0]  # Return top match


async def get_coin_detail(coin_id: str) -> Optional[dict]:
    """Fetch detailed info for a coin by its CoinGecko ID."""
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{COINGECKO_BASE}/coins/{coin_id}",
            params={
                "localization": "false",
                "tickers": "false",
                "market_data": "true",
                "community_data": "true",
                "developer_data": "false",
            },
        )
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        return resp.json()


def parse_coin_summary(data: dict) -> dict:
    """Extract the key fields we care about from the raw CoinGecko response."""
    market = data.get("market_data", {})
    links = data.get("links", {})

    return {
        "name": data.get("name"),
        "symbol": data.get("symbol", "").upper(),
        "description": (data.get("description", {}).get("en", "") or "")[:500],
        "homepage": (links.get("homepage") or [""])[0],
        "twitter": links.get("twitter_screen_name"),
        "telegram": links.get("telegram_channel_identifier"),
        "github": (links.get("repos_url", {}).get("github") or [None])[0],
        "price_usd": market.get("current_price", {}).get("usd"),
        "market_cap_usd": market.get("market_cap", {}).get("usd"),
        "fdv_usd": market.get("fully_diluted_valuation", {}).get("usd"),
        "volume_24h": market.get("total_volume", {}).get("usd"),
        "price_change_24h_pct": market.get("price_change_percentage_24h"),
        "price_change_7d_pct": market.get("price_change_percentage_7d"),
        "circulating_supply": market.get("circulating_supply"),
        "total_supply": market.get("total_supply"),
        "max_supply": market.get("max_supply"),
        "ath_usd": market.get("ath", {}).get("usd"),
        "ath_change_pct": market.get("ath_change_percentage", {}).get("usd"),
        "genesis_date": data.get("genesis_date"),
        "categories": data.get("categories", []),
        "sentiment_votes_up_pct": data.get("sentiment_votes_up_percentage"),
    }
