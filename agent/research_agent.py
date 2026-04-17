"""
Crypto Research Agent
Orchestrates multiple data sources to produce a comprehensive coin research report.
Uses Claude API for final analysis and risk assessment.
"""
import asyncio
import os
from typing import Optional
from anthropic import AsyncAnthropic

from .tools.coingecko import search_coin, get_coin_detail, parse_coin_summary
from .tools.dexscreener import search_pairs, parse_top_pairs, assess_liquidity_risk
from .tools.bubblemaps import get_decentralization_score, assess_concentration_risk, CHAIN_MAP
from .tools.web_search import search_scam_reports, search_twitter_sentiment, format_sentiment_section


claude = AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])


async def research_coin(query: str) -> str:
    """
    Main entry point: research a coin by name or ticker.
    Returns a formatted Telegram-ready report string.
    """
    # ── Step 1: Find the coin on CoinGecko ──────────────────────────────────
    coin_meta = await search_coin(query)
    if not coin_meta:
        return f"❌ 未找到与 *{query}* 匹配的代币，请检查名称或 ticker 是否正确。"

    coin_id = coin_meta["id"]
    detail = await get_coin_detail(coin_id)
    if not detail:
        return f"❌ 无法获取 *{query}* 的详细信息，CoinGecko 可能暂不收录。"

    summary = parse_coin_summary(detail)
    name = summary["name"]
    symbol = summary["symbol"]

    # ── Step 2: Parallel data fetching ──────────────────────────────────────
    contract_address = None
    chain = None
    platforms = detail.get("platforms", {})
    for platform, address in platforms.items():
        if address and platform in CHAIN_MAP:
            contract_address = address
            chain = platform
            break

    tasks = [
        search_pairs(f"{name} {symbol}"),
        search_scam_reports(name, symbol),
        search_twitter_sentiment(name, symbol),
    ]
    if contract_address and chain:
        tasks.append(get_decentralization_score(contract_address, chain))
    else:
        tasks.append(asyncio.coroutine(lambda: None)())

    pairs_raw, scam_results, twitter_url, bubble_data = await asyncio.gather(*tasks)

    top_pairs = parse_top_pairs(pairs_raw)
    liquidity_assessment = assess_liquidity_risk(top_pairs)
    concentration_assessment = assess_concentration_risk(bubble_data)
    sentiment_section = format_sentiment_section(scam_results, twitter_url, name)

    # ── Step 3: Build context for Claude ────────────────────────────────────
    context = _build_context(summary, top_pairs, liquidity_assessment, concentration_assessment)

    # ── Step 4: Claude analysis ──────────────────────────────────────────────
    claude_analysis = await _get_claude_analysis(name, symbol, context)

    # ── Step 5: Assemble final report ────────────────────────────────────────
    return _format_report(summary, top_pairs, liquidity_assessment,
                          concentration_assessment, sentiment_section, claude_analysis)


def _build_context(summary: dict, pairs: list, liquidity: str, concentration: str) -> str:
    """Build a structured context string for Claude to analyze."""
    fdv = summary.get("fdv_usd")
    mcap = summary.get("market_cap_usd")
    fdv_ratio = ""
    if fdv and mcap and mcap > 0:
        ratio = fdv / mcap
        fdv_ratio = f"FDV/市值比: {ratio:.1f}x"

    pair_info = ""
    if pairs:
        p = pairs[0]
        pair_info = f"""
主要交易对:
- 链: {p.get('chain')} / DEX: {p.get('dex')}
- 流动性: ${p.get('liquidity_usd', 0):,.0f}
- 24h 交易量: ${p.get('volume_24h', 0):,.0f}
- 买单/卖单(24h): {p.get('buys_24h')}/{p.get('sells_24h')}
"""

    return f"""
代币基本信息:
- 名称: {summary['name']} ({summary['symbol']})
- 描述: {summary['description'][:200]}
- 分类: {', '.join(summary['categories'][:3])}
- 市值: ${summary.get('market_cap_usd', 0):,.0f}
- FDV: ${summary.get('fdv_usd', 0):,.0f}
- {fdv_ratio}
- 流通量/总量: {summary.get('circulating_supply', 'N/A')} / {summary.get('total_supply', 'N/A')}
- 24h 涨跌: {summary.get('price_change_24h_pct', 'N/A')}%
- 7d 涨跌: {summary.get('price_change_7d_pct', 'N/A')}%
- 距离 ATH: {summary.get('ath_change_pct', 'N/A')}%
- 有 GitHub: {'是' if summary.get('github') else '否'}
- 有 Twitter: {'是' if summary.get('twitter') else '否'}
- 成立日期: {summary.get('genesis_date', '未知')}
{pair_info}
流动性评估: {liquidity}
持币集中度: {concentration}
"""


async def _get_claude_analysis(name: str, symbol: str, context: str) -> str:
    """Call Claude to analyze the coin and provide a risk assessment."""
    prompt = f"""你是一个加密货币风险分析专家，专门帮助普通投资者识别风险。

以下是关于 {name} ({symbol}) 的数据：
{context}

请基于以上数据，用中文提供：
1. **项目概述**（1-2句，说明这个项目做什么）
2. **主要风险点**（列出2-4个具体风险，基于数据）
3. **积极信号**（如果有的话，1-3个）
4. **综合风险评级**：极高 / 高 / 中等 / 较低，并说明原因
5. **新手建议**（1句话）

格式要简洁，适合 Telegram 消息显示。不要使用 markdown 的 ## 标题，用 emoji 区分各部分。
注意：这不是投资建议，只是数据分析。"""

    response = await claude.messages.create(
        model="claude-opus-4-5",
        max_tokens=600,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text


def _format_report(
    summary: dict,
    pairs: list,
    liquidity: str,
    concentration: str,
    sentiment: str,
    claude_analysis: str,
) -> str:
    """Assemble the final Telegram-formatted report."""
    name = summary["name"]
    symbol = summary["symbol"]
    price = summary.get("price_usd")
    price_str = f"${price:,.6f}" if price and price < 0.01 else (f"${price:,.4f}" if price else "N/A")

    mcap = summary.get("market_cap_usd")
    mcap_str = f"${mcap/1e6:.1f}M" if mcap and mcap < 1e9 else (f"${mcap/1e9:.2f}B" if mcap else "N/A")

    change_24h = summary.get("price_change_24h_pct")
    change_str = f"{'📈' if (change_24h or 0) > 0 else '📉'} {change_24h:+.1f}%" if change_24h else "N/A"

    dex_url = pairs[0].get("url", "") if pairs else ""
    links = []
    if summary.get("homepage"):
        links.append(f"[官网]({summary['homepage']})")
    if summary.get("twitter"):
        links.append(f"[Twitter](https://twitter.com/{summary['twitter']})")
    if dex_url:
        links.append(f"[DEX图表]({dex_url})")
    links_str = " | ".join(links) if links else "暂无链接"

    report = f"""🔬 *{name} ({symbol}) 研究报告*
━━━━━━━━━━━━━━━━━

💰 *市场数据*
• 价格: {price_str}
• 市值: {mcap_str}
• 24h: {change_str}

🏦 *流动性*
{liquidity}

👥 *持币分布*
{concentration}

{sentiment}

━━━━━━━━━━━━━━━━━
🤖 *AI 风险分析*

{claude_analysis}

━━━━━━━━━━━━━━━━━
🔗 {links_str}

⚠️ _以上为数据分析，不构成投资建议。DYOR，小心谨慎。_"""

    return report
