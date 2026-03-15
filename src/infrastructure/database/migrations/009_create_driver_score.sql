-- Driver score table (stores calculated metrics and tier)

CREATE TABLE IF NOT EXISTS driver_score (
    driver_id INTEGER PRIMARY KEY REFERENCES drivers(id) ON DELETE CASCADE,
    avg_rating DECIMAL(3,2),
    acceptance_rate DECIMAL(5,2),
    completion_rate DECIMAL(5,2),
    ontime_rate DECIMAL(5,2),
    cancel_rate DECIMAL(5,2),
    complaint_penalty INTEGER DEFAULT 0,
    score_total INTEGER,
    tier VARCHAR(20) CHECK (tier IN ('PLATINUM', 'GOLD', 'SILVER', 'WATCHLIST')),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_driver_score_tier ON driver_score(tier);