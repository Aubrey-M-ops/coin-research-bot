# Daily Review Scheduler — Design Spec

## Overview

A daily cron job that picks the coin least recently reviewed from the database, re-runs a full research update, and pushes the refreshed report to the Telegram channel with a "每日复习" header.

## Architecture

**Approach:** In-process scheduler using `node-cron`, registered at bot startup. No new Docker services or external infrastructure.

**New files:**
- `src/scheduler/dailyReview.ts` — cron registration + review logic

**Modified files:**
- `src/db/coinRepository.ts` — add `getLeastRecentlyReviewedCoin()`
- `src/bot/index.ts` — call `scheduleDailyReview(bot)` at startup

## Data Flow

```
startBot()
  → scheduleDailyReview(bot)
      → node-cron.schedule("0 8 * * *", ..., { timezone: "America/Toronto" })

On fire:
  → getLeastRecentlyReviewedCoin()     SELECT * FROM coin_analyses ORDER BY last_analyzed_at ASC LIMIT 1
  → researchCoin(coin.name)            Full refresh — also calls upsertCoinAnalysis() which updates last_analyzed_at
  → formatDailyReviewHeader(coin)      Prepend header with days-since-review and analysis count
  → bot.api.sendMessage(CHANNEL_ID)    Push to Telegram channel
```

## Coin Selection

`ORDER BY last_analyzed_at ASC LIMIT 1` — picks the coin that has gone the longest without a refresh, supporting spaced-repetition review.

## Message Format

```
📅 *每日复习*
🪙 距上次复习 *X 天* · 已研究 *N* 次
━━━━━━━━━━━━━━━━━

🔬 *CoinName (SYMBOL) 研究报告*
━━━━━━━━━━━━━━━━━
[full refreshed report]
```

## Timezone

`America/Toronto` — node-cron handles DST transitions automatically.

## Error Handling

- DB empty → log warning, skip that day (no message sent)
- `researchCoin()` throws → log error, send brief error notice to channel
- Telegram send fails → log error, do not crash bot process

## Dependencies

- `node-cron` (npm package, Bun-compatible) + `@types/node-cron`
