"""
Telegram Bot entry point.
Commands:
  /research <coin>  - Research a cryptocurrency
  /r <coin>         - Shorthand for /research
  /help             - Show usage
"""
import asyncio
import logging
import os
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
from telegram.constants import ParseMode
from dotenv import load_dotenv

from agent.research_agent import research_coin

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def cmd_research(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /research and /r commands."""
    if not context.args:
        await update.message.reply_text(
            "请提供代币名称或 ticker，例如：\n`/research bitcoin`\n`/r PEPE`",
            parse_mode=ParseMode.MARKDOWN,
        )
        return

    query = " ".join(context.args).strip()
    msg = await update.message.reply_text(f"🔍 正在研究 *{query}*，请稍候...", parse_mode=ParseMode.MARKDOWN)

    try:
        report = await research_coin(query)
        await msg.edit_text(report, parse_mode=ParseMode.MARKDOWN, disable_web_page_preview=True)
    except Exception as e:
        logger.exception(f"Research failed for query: {query}")
        await msg.edit_text(f"❌ 研究过程中出现错误：{str(e)[:200]}")


async def cmd_help(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    help_text = """🤖 *Crypto Research Bot*

帮你快速研究 KOL 推荐的币，识别潜在风险。

*命令:*
• `/research <币名>` - 完整研究报告
• `/r <ticker>` - 简写形式

*示例:*
• `/r BTC`
• `/research pepe coin`
• `/r WIF`

*报告包含:*
✅ 基本市场数据
✅ DEX 流动性分析
✅ 持币集中度 (Bubblemaps)
✅ 舆情/诈骗搜索
✅ AI 综合风险评估

⚠️ _不构成投资建议，DYOR！_"""
    await update.message.reply_text(help_text, parse_mode=ParseMode.MARKDOWN)


def main():
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if not token:
        raise ValueError("TELEGRAM_BOT_TOKEN not set in .env")

    app = Application.builder().token(token).build()
    app.add_handler(CommandHandler("research", cmd_research))
    app.add_handler(CommandHandler("r", cmd_research))
    app.add_handler(CommandHandler("start", cmd_help))
    app.add_handler(CommandHandler("help", cmd_help))

    logger.info("Bot started. Polling...")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
