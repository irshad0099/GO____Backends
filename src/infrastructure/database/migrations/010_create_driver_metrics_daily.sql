-- Daily performance metrics for drivers

CREATE TABLE IF NOT EXISTS driver_metrics_daily (
    id SERIAL PRIMARY KEY,
    driver_id INTEGER REFERENCES drivers(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    rides_assigned INTEGER DEFAULT 0,
    rides_accepted INTEGER DEFAULT 0,
    rides_completed INTEGER DEFAULT 0,
    rides_cancelled_driver INTEGER DEFAULT 0,
    rides_cancelled_user INTEGER DEFAULT 0,
    complaints_count INTEGER DEFAULT 0,
    ontime_arrival_count INTEGER DEFAULT 0,
    late_arrival_count INTEGER DEFAULT 0,
    UNIQUE(driver_id, date)
);

-- Index for quick date‑range queries
CREATE INDEX IF NOT EXISTS idx_driver_metrics_daily_driver_date ON driver_metrics_daily(driver_id, date);