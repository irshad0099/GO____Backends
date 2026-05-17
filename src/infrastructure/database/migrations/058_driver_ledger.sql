
-- 058_driver_ledger.sql
-- Replace driver_earnings_weekly, driver_earnings_monthly, driver_earnings_transactions
-- with a single driver_ledger table. Weekly/monthly computed via queries.

-- Drop stale aggregate tables (never updated by app code, only seed scripts)
DROP TABLE IF EXISTS driver_earnings_weekly CASCADE;
DROP TABLE IF EXISTS driver_earnings_monthly CASCADE;

-- Drop phantom table referenced in old service but never created
DROP TABLE IF EXISTS driver_earnings_transactions CASCADE;

-- ============================================================
-- Table: driver_ledger
-- Single source of truth for every driver earning/deduction event.
-- amount > 0 = credit, amount < 0 = debit
-- ============================================================
CREATE TABLE IF NOT EXISTS driver_ledger (
    id              BIGSERIAL NOT NULL,
    driver_id       INTEGER NOT NULL,
    type            VARCHAR(30) NOT NULL,
    amount          DECIMAL(10,2) NOT NULL,
    duration_minutes INTEGER DEFAULT 0,
    status          VARCHAR(20) DEFAULT 'completed',
    ride_id         INTEGER,
    reference_id    VARCHAR(100),
    payment_method  VARCHAR(30),
    note            TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT driver_ledger_pkey PRIMARY KEY (id),
    CONSTRAINT driver_ledger_type_check CHECK (type IN (
        'ride_earning', 'tip', 'incentive', 'referral',
        'penalty_deduction', 'cash_deposit', 'withdrawal', 'auto_deduct'
    )),
    CONSTRAINT driver_ledger_status_check CHECK (status IN ('held', 'completed', 'released')),
    CONSTRAINT driver_ledger_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
    CONSTRAINT driver_ledger_ride_id_fkey FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_driver_ledger_driver ON driver_ledger(driver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_ledger_ride ON driver_ledger(ride_id);
CREATE INDEX IF NOT EXISTS idx_driver_ledger_type ON driver_ledger(type);
CREATE INDEX IF NOT EXISTS idx_driver_ledger_created ON driver_ledger(created_at DESC);

-- Idempotency guard: one ride_earning per driver per ride
CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_ledger_ride_earning_unique
    ON driver_ledger(driver_id, ride_id)
    WHERE type = 'ride_earning';
