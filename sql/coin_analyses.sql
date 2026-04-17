CREATE TABLE IF NOT EXISTS coin_analyses (
  coin_id                  TEXT PRIMARY KEY,
  name                     TEXT NOT NULL,
  symbol                   TEXT NOT NULL,
  market_cap_rank          INTEGER,
  price_usd                NUMERIC,
  market_cap_usd           NUMERIC,
  fdv_usd                  NUMERIC,
  volume_24h               NUMERIC,
  price_change_24h_pct     NUMERIC,
  ath_usd                  NUMERIC,
  ath_change_pct           NUMERIC,
  circulating_supply       NUMERIC,
  total_supply             NUMERIC,
  max_supply               NUMERIC,
  top_liquidity_usd        NUMERIC,
  decentralization_score   NUMERIC,
  sector                   TEXT,
  liquidity_assessment     TEXT,
  concentration_assessment TEXT,
  full_report              TEXT,
  categories               TEXT[],
  analysis_count           INTEGER DEFAULT 1,
  first_analyzed_at        TIMESTAMPTZ DEFAULT NOW(),
  last_analyzed_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION increment_analysis_count()
RETURNS TRIGGER AS $$
BEGIN
  NEW.analysis_count = OLD.analysis_count + 1;
  NEW.first_analyzed_at = OLD.first_analyzed_at;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER on_coin_analysis_update
  BEFORE UPDATE ON coin_analyses
  FOR EACH ROW EXECUTE FUNCTION increment_analysis_count();
