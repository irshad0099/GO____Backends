-- ─────────────────────────────────────────────────────────────────────────────
-- DRIVER INCENTIVES / BONUS TARGETS
--
-- 2 tables:
-- 1) incentive_plans — admin create karta hai targets (e.g. "10 rides = Rs 200")
-- 2) driver_incentive_progress — har driver ka progress track hota hai
--
-- Rapido mein:
--   - "Complete 10 rides today, earn Rs 200 extra"
--   - "Peak hours (8-10 AM) mein 5 rides = Rs 150 bonus"
--   - "Weekly: 50 rides complete karo = Rs 500"
--
-- Incentive types:
--   - ride_count: X rides complete karo
--   - earning_target: Rs Y earn karo
--   - peak_rides: peak hours mein X rides
--   - acceptance_rate: 90%+ acceptance maintain karo
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── incentive_plans (admin managed) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS incentive_plans (
    id                  SERIAL PRIMARY KEY,

    title               VARCHAR(150)    NOT NULL,       -- "Complete 10 rides, earn Rs 200!"
    description         TEXT,

    -- Incentive type
    type                VARCHAR(20)     NOT NULL CHECK (type IN (
        'ride_count',       -- complete X rides
        'earning_target',   -- earn Rs Y
        'peak_rides',       -- X rides during peak hours
        'acceptance_rate'   -- maintain X% acceptance rate
    )),

    -- Target value (type ke hisab se meaning badlega)
    -- ride_count: 10 (rides), earning_target: 2000 (rupees), acceptance_rate: 90 (percent)
    target_value        DECIMAL(10,2)   NOT NULL CHECK (target_value > 0),

    -- Bonus amount on completing the target
    bonus_amount        DECIMAL(10,2)   NOT NULL CHECK (bonus_amount > 0),

    -- Kis vehicle type ke liye (NULL = all)
    vehicle_type        VARCHAR(50)     CHECK (vehicle_type IN ('bike', 'auto', 'car')),

    -- Time window
    duration_type       VARCHAR(10)     NOT NULL CHECK (duration_type IN ('daily', 'weekly', 'monthly', 'custom')),

    -- Custom date range (duration_type = custom ke liye)
    valid_from          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_until         TIMESTAMP       NOT NULL,

    -- Peak hours range (peak_rides type ke liye)
    peak_start_hour     INTEGER         CHECK (peak_start_hour >= 0 AND peak_start_hour <= 23),
    peak_end_hour       INTEGER         CHECK (peak_end_hour >= 0 AND peak_end_hour <= 23),

    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,

    created_at          TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP       DEFAULT CURRENT_TIMESTAMP
);

-- ─── driver_incentive_progress (per driver per plan) ────────────────────────
CREATE TABLE IF NOT EXISTS driver_incentive_progress (
    id                  SERIAL PRIMARY KEY,
    driver_id           INTEGER         NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    incentive_plan_id   INTEGER         NOT NULL REFERENCES incentive_plans(id) ON DELETE CASCADE,

    -- Current progress towards target
    current_value       DECIMAL(10,2)   NOT NULL DEFAULT 0,

    -- Kya target achieve ho gaya
    is_completed        BOOLEAN         NOT NULL DEFAULT FALSE,
    completed_at        TIMESTAMP,

    -- Bonus credit hua ya nahi (wallet mein)
    is_bonus_credited   BOOLEAN         NOT NULL DEFAULT FALSE,
    credited_at         TIMESTAMP,

    -- Period tracking (daily incentive ke liye kaunsa din, weekly ke liye kaunsa week)
    period_start        TIMESTAMP       NOT NULL,
    period_end          TIMESTAMP       NOT NULL,

    created_at          TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,

    -- Ek driver ek plan mein ek period mein ek hi entry
    UNIQUE (driver_id, incentive_plan_id, period_start)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
-- Active incentives list (driver app pe dikhane ke liye)
CREATE INDEX idx_incentive_plans_active ON incentive_plans(is_active, valid_until)
    WHERE is_active = TRUE;

-- Driver ka progress fetch
CREATE INDEX idx_driver_incentive_driver ON driver_incentive_progress(driver_id);

-- Pending bonus credit (cron job: target complete hua → wallet credit karo)
CREATE INDEX idx_driver_incentive_pending ON driver_incentive_progress(is_completed, is_bonus_credited)
    WHERE is_completed = TRUE AND is_bonus_credited = FALSE;

-- Period based lookup
CREATE INDEX idx_driver_incentive_period ON driver_incentive_progress(driver_id, period_start, period_end);
