-- Migration: report format restructure
-- Adds new columns, migrates claude_analysis -> full_report

ALTER TABLE coin_analyses
  ADD COLUMN IF NOT EXISTS market_cap_rank        INTEGER,
  ADD COLUMN IF NOT EXISTS ath_usd                NUMERIC,
  ADD COLUMN IF NOT EXISTS ath_change_pct         NUMERIC,
  ADD COLUMN IF NOT EXISTS circulating_supply     NUMERIC,
  ADD COLUMN IF NOT EXISTS total_supply           NUMERIC,
  ADD COLUMN IF NOT EXISTS max_supply             NUMERIC,
  ADD COLUMN IF NOT EXISTS sector                 TEXT,
  ADD COLUMN IF NOT EXISTS full_report            TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'coin_analyses' AND column_name = 'claude_analysis'
  ) THEN
    UPDATE coin_analyses SET full_report = claude_analysis WHERE full_report IS NULL;
    ALTER TABLE coin_analyses DROP COLUMN claude_analysis;
  END IF;
END $$;
