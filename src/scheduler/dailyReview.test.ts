import { expect, test } from "bun:test"
import { formatDailyReviewHeader } from "./dailyReview.ts"

test("formatDailyReviewHeader shows days since last review", () => {
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  const result = formatDailyReviewHeader("Bitcoin", "BTC", twoDaysAgo, 5)
  expect(result).toContain("📅 *每日复习*")
  expect(result).toContain("*2 天*")
  expect(result).toContain("*5* 次")
})

test("formatDailyReviewHeader shows 今天 when reviewed within the same day", () => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const result = formatDailyReviewHeader("Ethereum", "ETH", oneHourAgo, 1)
  expect(result).toContain("今天")
  expect(result).toContain("*1* 次")
})
