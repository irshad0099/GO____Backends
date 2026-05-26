-- 065_rebuild_incentives.sql
-- Full rebuild of the driver incentive module.
--
-- Drops the old `driver_incentive_progress` + `incentive_plans` tables
-- (the ride_id-nullable design caused progress to never aggregate) and
-- replaces them with a clean schema:
--
--   incentive_plans               admin-configured rewards (one row per plan)
--   driver_incentive_ride_log     per-ride idempotent counting (source of truth)
--   driver_incentive_rewards      payout audit + DB-level dedup
--
-- One default plan is seeded so EVERY driver participates by default —
-- no per-driver enrolment record is required.

-- ─── Reset ──────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS driver_incentive_rewards   CASCADE;
DROP TABLE IF EXISTS driver_incentive_ride_log  CASCADE;
DROP TABLE IF EXISTS driver_incentive_progress  CASCADE;
DROP TABLE IF EXISTS incentive_plans            CASCADE;

-- ─── incentive_plans ────────────────────────────────────────────────────────
CREATE TABLE incentive_plans (
    id              SERIAL PRIMARY KEY,
    title           VARCHAR(150) NOT NULL,
    description     TEXT,
    type            VARCHAR(20)  NOT NULL,
    target_value    DECIMAL(10,2) NOT NULL CHECK (target_value > 0),
    bonus_amount    DECIMAL(10,2) NOT NULL CHECK (bonus_amount > 0),
    vehicle_type    VARCHAR(50),                  -- NULL = applies to every vehicle
    duration_type   VARCHAR(10)  NOT NULL,
    is_default      BOOLEAN      NOT NULL DEFAULT FALSE,
    peak_start_hour INTEGER      CHECK (peak_start_hour BETWEEN 0 AND 23),
    peak_end_hour   INTEGER      CHECK (peak_end_hour   BETWEEN 0 AND 23),
    valid_from      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_until     TIMESTAMP    NOT NULL,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT incentive_plans_type_check
        CHECK (type IN ('ride_count','peak_rides','earning_target')),
    CONSTRAINT incentive_plans_duration_check
        CHECK (duration_type IN ('daily','weekly','monthly'))
);

CREATE INDEX idx_incentive_plans_active  ON incentive_plans (is_active, valid_until) WHERE is_active = TRUE;
CREATE INDEX idx_incentive_plans_default ON incentive_plans (is_default)             WHERE is_default = TRUE;

-- ─── driver_incentive_ride_log ──────────────────────────────────────────────
-- One row per (driver, plan, ride). Same ride can never be counted twice
-- against the same plan because of the UNIQUE constraint.
-- Progress for a (driver, plan, period) is SUM(increment_value) over this table.
CREATE TABLE driver_incentive_ride_log (
    id              SERIAL PRIMARY KEY,
    driver_id       INTEGER       NOT NULL REFERENCES drivers(id)         ON DELETE CASCADE,
    plan_id         INTEGER       NOT NULL REFERENCES incentive_plans(id) ON DELETE CASCADE,
    ride_id         INTEGER       NOT NULL REFERENCES rides(id)           ON DELETE CASCADE,
    period_start    TIMESTAMP     NOT NULL,
    increment_value DECIMAL(10,2) NOT NULL DEFAULT 1,
    counted_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT driver_incentive_ride_log_unique UNIQUE (driver_id, plan_id, ride_id)
);

CREATE INDEX idx_dirl_driver_plan_period ON driver_incentive_ride_log (driver_id, plan_id, period_start);

-- ─── driver_incentive_rewards ───────────────────────────────────────────────
-- One row per (driver, plan, period) — guarantees a milestone can pay out
-- only once per period even under concurrent ride completions.
CREATE TABLE driver_incentive_rewards (
    id            SERIAL PRIMARY KEY,
    driver_id     INTEGER       NOT NULL REFERENCES drivers(id)         ON DELETE CASCADE,
    plan_id       INTEGER       NOT NULL REFERENCES incentive_plans(id) ON DELETE CASCADE,
    period_start  TIMESTAMP     NOT NULL,
    bonus_amount  DECIMAL(10,2) NOT NULL,
    ledger_id     BIGINT        REFERENCES driver_ledger(id) ON DELETE SET NULL,
    credited_at   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT driver_incentive_rewards_unique UNIQUE (driver_id, plan_id, period_start)
);

CREATE INDEX idx_dir_driver_credited ON driver_incentive_rewards (driver_id, credited_at DESC);

-- ─── Default plan (every driver, every day) ─────────────────────────────────
INSERT INTO incentive_plans (
    title, description, type, target_value, bonus_amount,
    vehicle_type, duration_type, is_default, valid_until
) VALUES (
    'Daily Ride Bonus',
    'Complete 20 rides today and earn ₹100 bonus.',
    'ride_count',
    20,
    100.00,
    NULL,            -- applies to every vehicle type
    'daily',
    TRUE,            -- default plan → every driver participates
    '2099-12-31 23:59:59'
);
