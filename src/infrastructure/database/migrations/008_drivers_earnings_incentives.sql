-- 008_drivers_earnings_incentives.sql

-- Driver Earnings & Incentives: driver_penalties, driver_penalty_summary, driver_incentive_progress, incentive_plans, driver_earnings_monthly, driver_earnings_weekly

-- Generated from live DB schema


-- ============================================================
-- Table: driver_penalties
-- ============================================================
CREATE TABLE IF NOT EXISTS driver_penalties (
    id SERIAL NOT NULL,
    driver_id INTEGER NOT NULL,
    offense_type VARCHAR(30) NOT NULL,
    penalty_type VARCHAR(20) NOT NULL,
    fine_amount DECIMAL(10,2) DEFAULT 0,
    fine_deducted BOOLEAN DEFAULT FALSE NOT NULL,
    ban_until TIMESTAMP,
    points INTEGER DEFAULT 0 NOT NULL,
    description TEXT NOT NULL,
    ride_id INTEGER,
    is_acknowledged BOOLEAN DEFAULT FALSE NOT NULL,
    acknowledged_at TIMESTAMP,
    issued_by UUID,
    is_appealed BOOLEAN DEFAULT FALSE NOT NULL,
    appeal_reason TEXT,
    appeal_status VARCHAR(20),
    appeal_resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT driver_penalties_appeal_status_check CHECK (((appeal_status)::text = ANY ((ARRAY['pending'::character varying, 'accepted'::character varying, 'rejected'::character varying])::text[]))),
    CONSTRAINT driver_penalties_offense_type_check CHECK (((offense_type)::text = ANY ((ARRAY['high_cancellation'::character varying, 'low_acceptance'::character varying, 'passenger_complaint'::character varying, 'safety_violation'::character varying, 'fake_ride'::character varying, 'low_rating'::character varying, 'document_expired'::character varying, 'fraud'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT driver_penalties_penalty_type_check CHECK (((penalty_type)::text = ANY ((ARRAY['warning'::character varying, 'fine'::character varying, 'temporary_ban'::character varying, 'permanent_ban'::character varying])::text[]))),
    CONSTRAINT driver_penalties_pkey PRIMARY KEY (id),
    CONSTRAINT driver_penalties_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
    CONSTRAINT driver_penalties_issued_by_fkey FOREIGN KEY (issued_by) REFERENCES users(id),
    CONSTRAINT driver_penalties_ride_id_fkey FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_driver_penalties_appeal ON public.driver_penalties USING btree (is_appealed, appeal_status) WHERE ((is_appealed = true) AND ((appeal_status)::text = 'pending'::text));

CREATE INDEX IF NOT EXISTS idx_driver_penalties_driver ON public.driver_penalties USING btree (driver_id);

CREATE INDEX IF NOT EXISTS idx_driver_penalties_offense ON public.driver_penalties USING btree (offense_type);

CREATE INDEX IF NOT EXISTS idx_driver_penalties_time ON public.driver_penalties USING btree (created_at);

-- ============================================================
-- Table: driver_penalty_summary
-- ============================================================
CREATE TABLE IF NOT EXISTS driver_penalty_summary (
    id SERIAL NOT NULL,
    driver_id INTEGER NOT NULL,
    total_points INTEGER DEFAULT 0 NOT NULL,
    total_warnings INTEGER DEFAULT 0 NOT NULL,
    total_fines INTEGER DEFAULT 0 NOT NULL,
    total_fine_amount DECIMAL(10,2) DEFAULT 0 NOT NULL,
    total_bans INTEGER DEFAULT 0 NOT NULL,
    is_banned BOOLEAN DEFAULT FALSE NOT NULL,
    ban_until TIMESTAMP,
    ban_reason TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT driver_penalty_summary_pkey PRIMARY KEY (id),
    CONSTRAINT driver_penalty_summary_driver_id_key UNIQUE (driver_id),
    CONSTRAINT driver_penalty_summary_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS driver_penalty_summary_driver_id_key ON public.driver_penalty_summary USING btree (driver_id);

CREATE INDEX IF NOT EXISTS idx_driver_penalty_summary_banned ON public.driver_penalty_summary USING btree (is_banned) WHERE (is_banned = true);

-- ============================================================
-- Table: driver_incentive_progress
-- ============================================================
CREATE TABLE IF NOT EXISTS driver_incentive_progress (
    id SERIAL NOT NULL,
    driver_id INTEGER NOT NULL,
    incentive_plan_id INTEGER NOT NULL,
    current_value DECIMAL(10,2) DEFAULT 0 NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE NOT NULL,
    completed_at TIMESTAMP,
    is_bonus_credited BOOLEAN DEFAULT FALSE NOT NULL,
    credited_at TIMESTAMP,
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT driver_incentive_progress_pkey PRIMARY KEY (id),
    CONSTRAINT driver_incentive_progress_driver_id_incentive_plan_id_perio_key UNIQUE (driver_id, incentive_plan_id, period_start),
    CONSTRAINT driver_incentive_progress_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
    CONSTRAINT driver_incentive_progress_incentive_plan_id_fkey FOREIGN KEY (incentive_plan_id) REFERENCES incentive_plans(id) ON DELETE CASCADE
);

-- Add ride_id column if it doesn't exist (for idempotency)
ALTER TABLE driver_incentive_progress
ADD COLUMN IF NOT EXISTS ride_id INTEGER REFERENCES rides(id) ON DELETE SET NULL;

-- Drop old constraint if exists
ALTER TABLE driver_incentive_progress
DROP CONSTRAINT IF EXISTS driver_incentive_progress_driver_id_incentive_plan_id_ride_key CASCADE;

-- Add new constraint with ride_id for idempotency
ALTER TABLE driver_incentive_progress
ADD CONSTRAINT driver_incentive_progress_driver_id_incentive_plan_id_ride_key
UNIQUE (driver_id, incentive_plan_id, ride_id, period_start);

CREATE UNIQUE INDEX IF NOT EXISTS driver_incentive_progress_driver_id_incentive_plan_id_ride_key ON public.driver_incentive_progress USING btree (driver_id, incentive_plan_id, ride_id, period_start);

CREATE INDEX IF NOT EXISTS idx_driver_incentive_driver ON public.driver_incentive_progress USING btree (driver_id);

CREATE INDEX IF NOT EXISTS idx_driver_incentive_pending ON public.driver_incentive_progress USING btree (is_completed, is_bonus_credited) WHERE ((is_completed = true) AND (is_bonus_credited = false));

CREATE INDEX IF NOT EXISTS idx_driver_incentive_period ON public.driver_incentive_progress USING btree (driver_id, period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_driver_incentive_ride ON public.driver_incentive_progress USING btree (ride_id) WHERE ride_id IS NOT NULL;

-- ============================================================
-- Table: incentive_plans
-- ============================================================
CREATE TABLE IF NOT EXISTS incentive_plans (
    id SERIAL NOT NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    type VARCHAR(20) NOT NULL,
    target_value DECIMAL(10,2) NOT NULL,
    bonus_amount DECIMAL(10,2) NOT NULL,
    vehicle_type VARCHAR(50),
    duration_type VARCHAR(10) NOT NULL,
    valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    valid_until TIMESTAMP NOT NULL,
    peak_start_hour INTEGER,
    peak_end_hour INTEGER,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT incentive_plans_bonus_amount_check CHECK ((bonus_amount > (0)::numeric)),
    CONSTRAINT incentive_plans_duration_type_check CHECK (((duration_type)::text = ANY ((ARRAY['daily'::character varying, 'weekly'::character varying, 'monthly'::character varying, 'custom'::character varying])::text[]))),
    CONSTRAINT incentive_plans_peak_end_hour_check CHECK (((peak_end_hour >= 0) AND (peak_end_hour <= 23))),
    CONSTRAINT incentive_plans_peak_start_hour_check CHECK (((peak_start_hour >= 0) AND (peak_start_hour <= 23))),
    CONSTRAINT incentive_plans_target_value_check CHECK ((target_value > (0)::numeric)),
    CONSTRAINT incentive_plans_type_check CHECK (((type)::text = ANY ((ARRAY['ride_count'::character varying, 'earning_target'::character varying, 'peak_rides'::character varying, 'acceptance_rate'::character varying])::text[]))),
    CONSTRAINT incentive_plans_vehicle_type_check CHECK (((vehicle_type)::text = ANY ((ARRAY['bike'::character varying, 'auto'::character varying, 'car'::character varying])::text[]))),
    CONSTRAINT incentive_plans_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_incentive_plans_active ON public.incentive_plans USING btree (is_active, valid_until) WHERE (is_active = true);

-- ============================================================
-- Default Incentive Plan Seed
-- ============================================================
INSERT INTO incentive_plans (title, description, type, target_value, bonus_amount, vehicle_type, duration_type, valid_until, is_active)
VALUES (
    'Daily Ride Bonus',
    'Complete 20 rides today and earn ₹50 bonus. Platform fee applies for first 10 rides, free after that!',
    'ride_count',
    20,
    50.00,
    NULL,
    'daily',
    '2027-12-31',
    TRUE
) ON CONFLICT DO NOTHING;

-- ============================================================
-- Table: driver_earnings_monthly
-- ============================================================
CREATE TABLE IF NOT EXISTS driver_earnings_monthly (
    id SERIAL NOT NULL,
    driver_id INTEGER NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    total_rides INTEGER DEFAULT 0 NOT NULL,
    completed_rides INTEGER DEFAULT 0 NOT NULL,
    cancelled_rides INTEGER DEFAULT 0 NOT NULL,
    ride_earnings DECIMAL(10,2) DEFAULT 0 NOT NULL,
    tip_earnings DECIMAL(10,2) DEFAULT 0 NOT NULL,
    incentive_earnings DECIMAL(10,2) DEFAULT 0 NOT NULL,
    referral_earnings DECIMAL(10,2) DEFAULT 0 NOT NULL,
    platform_fee_total DECIMAL(10,2) DEFAULT 0 NOT NULL,
    penalty_deductions DECIMAL(10,2) DEFAULT 0 NOT NULL,
    cancellation_deductions DECIMAL(10,2) DEFAULT 0 NOT NULL,
    gross_earnings DECIMAL(10,2) DEFAULT 0 NOT NULL,
    total_deductions DECIMAL(10,2) DEFAULT 0 NOT NULL,
    net_earnings DECIMAL(10,2) DEFAULT 0 NOT NULL,
    cash_collected DECIMAL(10,2) DEFAULT 0 NOT NULL,
    online_earnings DECIMAL(10,2) DEFAULT 0 NOT NULL,
    total_withdrawals DECIMAL(10,2) DEFAULT 0 NOT NULL,
    total_online_hours DECIMAL(6,1) DEFAULT 0 NOT NULL,
    avg_earning_per_ride DECIMAL(10,2) DEFAULT 0 NOT NULL,
    avg_rating DECIMAL(3,2) DEFAULT 0 NOT NULL,
    acceptance_rate DECIMAL(5,2) DEFAULT 0 NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT driver_earnings_monthly_month_check CHECK (((month >= 1) AND (month <= 12))),
    CONSTRAINT driver_earnings_monthly_year_check CHECK ((year >= 2024)),
    CONSTRAINT driver_earnings_monthly_pkey PRIMARY KEY (id),
    CONSTRAINT driver_earnings_monthly_driver_id_year_month_key UNIQUE (driver_id, year, month),
    CONSTRAINT driver_earnings_monthly_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS driver_earnings_monthly_driver_id_year_month_key ON public.driver_earnings_monthly USING btree (driver_id, year, month);

CREATE INDEX IF NOT EXISTS idx_driver_earnings_monthly_current ON public.driver_earnings_monthly USING btree (year, month);

CREATE INDEX IF NOT EXISTS idx_driver_earnings_monthly_driver ON public.driver_earnings_monthly USING btree (driver_id, year DESC, month DESC);

-- ============================================================
-- Table: driver_earnings_weekly
-- ============================================================
CREATE TABLE IF NOT EXISTS driver_earnings_weekly (
    id SERIAL NOT NULL,
    driver_id INTEGER NOT NULL,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    total_rides INTEGER DEFAULT 0 NOT NULL,
    completed_rides INTEGER DEFAULT 0 NOT NULL,
    cancelled_rides INTEGER DEFAULT 0 NOT NULL,
    ride_earnings DECIMAL(10,2) DEFAULT 0 NOT NULL,
    tip_earnings DECIMAL(10,2) DEFAULT 0 NOT NULL,
    incentive_earnings DECIMAL(10,2) DEFAULT 0 NOT NULL,
    referral_earnings DECIMAL(10,2) DEFAULT 0 NOT NULL,
    platform_fee_total DECIMAL(10,2) DEFAULT 0 NOT NULL,
    penalty_deductions DECIMAL(10,2) DEFAULT 0 NOT NULL,
    cancellation_deductions DECIMAL(10,2) DEFAULT 0 NOT NULL,
    gross_earnings DECIMAL(10,2) DEFAULT 0 NOT NULL,
    total_deductions DECIMAL(10,2) DEFAULT 0 NOT NULL,
    net_earnings DECIMAL(10,2) DEFAULT 0 NOT NULL,
    cash_collected DECIMAL(10,2) DEFAULT 0 NOT NULL,
    online_earnings DECIMAL(10,2) DEFAULT 0 NOT NULL,
    total_online_hours DECIMAL(5,1) DEFAULT 0 NOT NULL,
    avg_earning_per_ride DECIMAL(10,2) DEFAULT 0 NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT driver_earnings_weekly_pkey PRIMARY KEY (id),
    CONSTRAINT driver_earnings_weekly_driver_id_week_start_key UNIQUE (driver_id, week_start),
    CONSTRAINT driver_earnings_weekly_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS driver_earnings_weekly_driver_id_week_start_key ON public.driver_earnings_weekly USING btree (driver_id, week_start);

CREATE INDEX IF NOT EXISTS idx_driver_earnings_weekly_current ON public.driver_earnings_weekly USING btree (week_start);

CREATE INDEX IF NOT EXISTS idx_driver_earnings_weekly_driver ON public.driver_earnings_weekly USING btree (driver_id, week_start DESC);
