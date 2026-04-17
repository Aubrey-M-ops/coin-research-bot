-- Migration 001: Report format restructure
-- Run once against existing Supabase DB

ALTER TABLE coin_analyses
  ADD COLUMN IF NOT EXISTS market_cap_rank        INTEGER,
  ADD COLUMN IF NOT EXISTS ath_usd                NUMERIC,
  ADD COLUMN IF NOT EXISTS ath_change_pct         NUMERIC,
  ADD COLUMN IF NOT EXISTS circulating_supply     NUMERIC,
  ADD COLUMN IF NOT EXISTS total_supply           NUMERIC,
  ADD COLUMN IF NOT EXISTS max_supply             NUMERIC,
  ADD COLUMN IF NOT EXISTS sector                 TEXT,
  ADD COLUMN IF NOT EXISTS full_report            TEXT;

-- Copy existing claude_analysis into full_report then drop old column
UPDATE coin_analyses SET full_report = claude_analysis WHERE full_report IS NULL;
ALTER TABLE coin_analyses DROP COLUMN IF EXISTS claude_analysis;
