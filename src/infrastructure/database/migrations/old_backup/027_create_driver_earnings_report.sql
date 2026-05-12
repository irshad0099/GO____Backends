-- ─────────────────────────────────────────────────────────────────────────────
-- DRIVER EARNINGS REPORT — Weekly / Monthly Summary
--
-- driver_metrics_daily already hai (010), yahan weekly + monthly aggregate
-- Rapido mein driver ko milta hai:
--   - Weekly summary (Mon-Sun): total rides, earnings, incentives, deductions
--   - Monthly summary: same + withdrawals + net payout
--
-- Yeh cached tables hain — cron job se populate hote hain (daily/weekly)
-- Direct SUM() queries pe depend nahi karna scalable nahi hai
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── driver_earnings_weekly ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_earnings_weekly (
    id                      SERIAL PRIMARY KEY,
    driver_id               INTEGER         NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,

    -- Week identifier (Monday of that week)
    week_start              DATE            NOT NULL,
    week_end                DATE            NOT NULL,

    -- Ride stats
    total_rides             INTEGER         NOT NULL DEFAULT 0,
    completed_rides         INTEGER         NOT NULL DEFAULT 0,
    cancelled_rides         INTEGER         NOT NULL DEFAULT 0,

    -- Earnings breakdown
    ride_earnings           DECIMAL(10,2)   NOT NULL DEFAULT 0,     -- fare se aaya
    tip_earnings            DECIMAL(10,2)   NOT NULL DEFAULT 0,     -- tips
    incentive_earnings      DECIMAL(10,2)   NOT NULL DEFAULT 0,     -- bonus/incentives
    referral_earnings       DECIMAL(10,2)   NOT NULL DEFAULT 0,     -- referral bonus

    -- Deductions
    platform_fee_total      DECIMAL(10,2)   NOT NULL DEFAULT 0,     -- platform ne kitna kaata
    penalty_deductions      DECIMAL(10,2)   NOT NULL DEFAULT 0,     -- fines
    cancellation_deductions DECIMAL(10,2)   NOT NULL DEFAULT 0,     -- cancellation penalties

    -- Net
    gross_earnings          DECIMAL(10,2)   NOT NULL DEFAULT 0,     -- total earned (before deductions)
    total_deductions        DECIMAL(10,2)   NOT NULL DEFAULT 0,     -- total deducted
    net_earnings            DECIMAL(10,2)   NOT NULL DEFAULT 0,     -- gross - deductions

    -- Cash vs online split (important for settlement)
    cash_collected          DECIMAL(10,2)   NOT NULL DEFAULT 0,     -- cash rides se kitna collect kiya
    online_earnings         DECIMAL(10,2)   NOT NULL DEFAULT 0,     -- non-cash earnings

    -- Hours online
    total_online_hours      DECIMAL(5,1)    NOT NULL DEFAULT 0,

    -- Average per ride
    avg_earning_per_ride    DECIMAL(10,2)   NOT NULL DEFAULT 0,

    created_at              TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,

    -- Ek driver ka ek week mein ek hi entry
    UNIQUE (driver_id, week_start)
);

-- ─── driver_earnings_monthly ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_earnings_monthly (
    id                      SERIAL PRIMARY KEY,
    driver_id               INTEGER         NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,

    -- Month identifier
    month                   INTEGER         NOT NULL CHECK (month >= 1 AND month <= 12),
    year                    INTEGER         NOT NULL CHECK (year >= 2024),

    -- Same structure as weekly but monthly aggregate
    total_rides             INTEGER         NOT NULL DEFAULT 0,
    completed_rides         INTEGER         NOT NULL DEFAULT 0,
    cancelled_rides         INTEGER         NOT NULL DEFAULT 0,

    ride_earnings           DECIMAL(10,2)   NOT NULL DEFAULT 0,
    tip_earnings            DECIMAL(10,2)   NOT NULL DEFAULT 0,
    incentive_earnings      DECIMAL(10,2)   NOT NULL DEFAULT 0,
    referral_earnings       DECIMAL(10,2)   NOT NULL DEFAULT 0,

    platform_fee_total      DECIMAL(10,2)   NOT NULL DEFAULT 0,
    penalty_deductions      DECIMAL(10,2)   NOT NULL DEFAULT 0,
    cancellation_deductions DECIMAL(10,2)   NOT NULL DEFAULT 0,

    gross_earnings          DECIMAL(10,2)   NOT NULL DEFAULT 0,
    total_deductions        DECIMAL(10,2)   NOT NULL DEFAULT 0,
    net_earnings            DECIMAL(10,2)   NOT NULL DEFAULT 0,

    cash_collected          DECIMAL(10,2)   NOT NULL DEFAULT 0,
    online_earnings         DECIMAL(10,2)   NOT NULL DEFAULT 0,

    -- Withdrawals (bank transfer)
    total_withdrawals       DECIMAL(10,2)   NOT NULL DEFAULT 0,

    total_online_hours      DECIMAL(6,1)    NOT NULL DEFAULT 0,
    avg_earning_per_ride    DECIMAL(10,2)   NOT NULL DEFAULT 0,

    -- Rating snapshot at month end
    avg_rating              DECIMAL(3,2)    NOT NULL DEFAULT 0,
    acceptance_rate         DECIMAL(5,2)    NOT NULL DEFAULT 0,

    created_at              TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,

    -- Ek driver ka ek month mein ek hi entry
    UNIQUE (driver_id, year, month)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
-- Driver ke weekly earnings (earnings screen pe list)
CREATE INDEX idx_driver_earnings_weekly_driver ON driver_earnings_weekly(driver_id, week_start DESC);

-- Driver ke monthly earnings
CREATE INDEX idx_driver_earnings_monthly_driver ON driver_earnings_monthly(driver_id, year DESC, month DESC);

-- Cron job: current week/month update karna
CREATE INDEX idx_driver_earnings_weekly_current ON driver_earnings_weekly(week_start);
CREATE INDEX idx_driver_earnings_monthly_current ON driver_earnings_monthly(year, month);
