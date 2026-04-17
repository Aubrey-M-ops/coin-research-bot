"""Bubblemaps API tool - check token holder concentration and decentralization score."""
import httpx
from typing import Optional


BUBBLEMAPS_API = "https://api-legacy.bubblemaps.io"

# Chain ID mapping (CoinGecko platform -> Bubblemaps chain)
CHAIN_MAP = {
    "ethereum": "eth",
    "binance-smart-chain": "bsc",
    "avalanche": "avax",
    "polygon-pos": "matic",
    "fantom": "ftm",
    "arbitrum-one": "arb",
    "optimistic-ethereum": "op",
    "base": "base",
    "solana": "sol",
}


async def get_decentralization_score(contract_address: str, chain: str) -> Optional[dict]:
    """
    Fetch Bubblemaps decentralization score for a token.
    chain should be the Bubblemaps chain identifier (e.g. 'eth', 'bsc').
    """
    mapped_chain = CHAIN_MAP.get(chain, chain)
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            resp = await client.get(
                f"{BUBBLEMAPS_API}/map-metadata",
                params={"token": contract_address, "chain": mapped_chain},
            )
            if resp.status_code in (404, 400):
                return None
            resp.raise_for_status()
            data = resp.json()
            return {
                "decentralization_score": data.get("decentralisationScore"),
                "identified_supply_pct": data.get("identifiedSupply"),
                "chain": mapped_chain,
                "contract": contract_address,
                "bubblemaps_url": f"https://app.bubblemaps.io/{mapped_chain}/token/{contract_address}",
            }
        except Exception:
            return None


def assess_concentration_risk(score_data: Optional[dict]) -> str:
    """Interpret the Bubblemaps decentralization score."""
    if not score_data or score_data.get("decentralization_score") is None:
        return "⚠️ 无法获取持币集中度数据，建议手动查看 Bubblemaps"

    score = score_data["decentralization_score"]
    url = score_data.get("bubblemaps_url", "")

    if score >= 80:
        rating = "🟢 持币分布良好"
    elif score >= 60:
        rating = "🟡 持币较为集中，存在一定风险"
    elif score >= 40:
        rating = "🟠 持币高度集中，风险较高"
    else:
        rating = "🔴 持币极度集中，极高风险！"

    return f"{rating} (去中心化评分: {score}/100)\n📊 [查看 Bubblemaps]({url})"
