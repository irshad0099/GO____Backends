-- ─────────────────────────────────────────────────────────────────────────────
-- PRICING ENGINE v3.0 — DB-DRIVEN CONFIG
--
-- Har pricing knob ab DB mein hai. Admin change karega, cache refresh hoga,
-- code change nahi karna padega.
--
-- Tables:
--   pricing_vehicle_config        — per-vehicle fares, fees, speed
--   pricing_convenience_fee       — per-vehicle off-peak + peak base fee
--   pricing_distance_tiers        — distance bands with multipliers
--   pricing_subscriber_rules      — subscriber tier free-km + discount + surge cap
--   pricing_gst_config            — 5% rider, 18% platform (single row)
--   pricing_penalty_config        — offense-wise fine + suspension rules
--   pricing_settings              — misc knobs (surge_max, peak_hours, cancel)
-- ─────────────────────────────────────────────────────────────────────────────

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. pricing_vehicle_config
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS pricing_vehicle_config (
    id                      SERIAL PRIMARY KEY,
    vehicle_type            VARCHAR(20)     NOT NULL UNIQUE,
    display_name            VARCHAR(50)     NOT NULL,

    base_fare               DECIMAL(10,2)   NOT NULL,
    per_km_rate             DECIMAL(10,2)   NOT NULL,
    minimum_fare            DECIMAL(10,2)   NOT NULL,

    platform_fee            DECIMAL(10,2)   NOT NULL DEFAULT 0,
    platform_fee_daily_cap  INTEGER         NOT NULL DEFAULT 10,

    avg_speed_kmph          DECIMAL(5,2)    NOT NULL DEFAULT 30,

    -- Pickup surcharge
    pickup_free_km          DECIMAL(5,2)    NOT NULL DEFAULT 2.5,
    pickup_rate_per_km      DECIMAL(10,2)   NOT NULL DEFAULT 0,

    -- Waiting charges
    waiting_grace_minutes   INTEGER         NOT NULL DEFAULT 7,
    waiting_rate_per_min    DECIMAL(10,2)   NOT NULL DEFAULT 0,

    -- Traffic delay compensation
    traffic_grace_minutes   INTEGER         NOT NULL DEFAULT 30,
    traffic_rate_per_min    DECIMAL(10,2)   NOT NULL DEFAULT 0,

    -- Category standards (for KYC / category misrep penalty)
    max_vehicle_age_years   INTEGER,
    min_engine_cc           INTEGER,
    ac_required             BOOLEAN         NOT NULL DEFAULT FALSE,
    category_notes          TEXT,

    is_active               BOOLEAN         NOT NULL DEFAULT TRUE,
    sort_order              INTEGER         NOT NULL DEFAULT 0,

    created_at              TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP       DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pricing_vehicle_active
    ON pricing_vehicle_config(is_active, sort_order);

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. pricing_convenience_fee
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS pricing_convenience_fee (
    id                      SERIAL PRIMARY KEY,
    vehicle_type            VARCHAR(20)     NOT NULL UNIQUE
                                REFERENCES pricing_vehicle_config(vehicle_type)
                                ON UPDATE CASCADE ON DELETE CASCADE,
    off_peak_base           DECIMAL(10,2)   NOT NULL,
    peak_base               DECIMAL(10,2)   NOT NULL,

    updated_at              TIMESTAMP       DEFAULT CURRENT_TIMESTAMP
);

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. pricing_distance_tiers
-- ═════════════════════════════════════════════════════════════════════════════
-- Global tier table — applies to all vehicles.
-- Multiplier is applied on the vehicle's convenience fee base.
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS pricing_distance_tiers (
    id                      SERIAL PRIMARY KEY,
    tier_name               VARCHAR(30)     NOT NULL UNIQUE,
    min_km                  DECIMAL(6,2)    NOT NULL,
    max_km                  DECIMAL(6,2),                   -- NULL = unbounded
    multiplier              DECIMAL(4,2)    NOT NULL DEFAULT 1.0,
    sort_order              INTEGER         NOT NULL DEFAULT 0,
    is_active               BOOLEAN         NOT NULL DEFAULT TRUE,

    updated_at              TIMESTAMP       DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pricing_tiers_order
    ON pricing_distance_tiers(is_active, sort_order);

-- ═════════════════════════════════════════════════════════════════════════════
-- 4. pricing_subscriber_rules
-- ═════════════════════════════════════════════════════════════════════════════
-- Free km zone, discount beyond, and surge cap per subscriber tier.
-- 'none' row is the non-subscribed default (free_km=0, discount=0, cap=surge_max).
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS pricing_subscriber_rules (
    id                      SERIAL PRIMARY KEY,
    tier_name               VARCHAR(30)     NOT NULL UNIQUE,
    free_km                 DECIMAL(5,2)    NOT NULL DEFAULT 0,
    discount_pct_beyond     DECIMAL(5,2)    NOT NULL DEFAULT 0,  -- % off convenience fee beyond free_km
    surge_cap               DECIMAL(4,2)    NOT NULL DEFAULT 1.75,
    is_active               BOOLEAN         NOT NULL DEFAULT TRUE,

    updated_at              TIMESTAMP       DEFAULT CURRENT_TIMESTAMP
);

-- ═════════════════════════════════════════════════════════════════════════════
-- 5. pricing_gst_config (single-row)
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS pricing_gst_config (
    id                      SERIAL PRIMARY KEY,
    gst_enabled             BOOLEAN         NOT NULL DEFAULT FALSE,
    rider_rate_pct          DECIMAL(5,2)    NOT NULL DEFAULT 5.00,    -- SAC 9964
    platform_rate_pct       DECIMAL(5,2)    NOT NULL DEFAULT 18.00,   -- SAC 9985
    rider_sac_code          VARCHAR(10)     NOT NULL DEFAULT '9964',
    platform_sac_code       VARCHAR(10)     NOT NULL DEFAULT '9985',
    gst_registration_no     VARCHAR(30),
    updated_at              TIMESTAMP       DEFAULT CURRENT_TIMESTAMP
);

-- ═════════════════════════════════════════════════════════════════════════════
-- 6. pricing_penalty_config
-- ═════════════════════════════════════════════════════════════════════════════
-- Per offense_type + offense_count, defines fine, suspension, and action.
-- ride engine + penalty service reads from here.
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS pricing_penalty_config (
    id                      SERIAL PRIMARY KEY,
    offense_type            VARCHAR(50)     NOT NULL,
    offense_count           INTEGER         NOT NULL,
    penalty_amount          DECIMAL(10,2)   NOT NULL DEFAULT 0,
    suspension_days         INTEGER         NOT NULL DEFAULT 0,
    requires_rekyc          BOOLEAN         NOT NULL DEFAULT FALSE,
    is_permanent_ban        BOOLEAN         NOT NULL DEFAULT FALSE,
    rider_refund_amount     DECIMAL(10,2)   NOT NULL DEFAULT 0,
    escalation_window_days  INTEGER         NOT NULL DEFAULT 90,
    action_notes            TEXT,
    is_active               BOOLEAN         NOT NULL DEFAULT TRUE,

    updated_at              TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (offense_type, offense_count)
);

CREATE INDEX IF NOT EXISTS idx_pricing_penalty_offense
    ON pricing_penalty_config(offense_type, offense_count);

-- ═════════════════════════════════════════════════════════════════════════════
-- 7. pricing_settings — misc global knobs
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS pricing_settings (
    setting_key             VARCHAR(80)     PRIMARY KEY,
    setting_value           TEXT            NOT NULL,
    value_type              VARCHAR(10)     NOT NULL DEFAULT 'string'
                                CHECK (value_type IN ('string','number','boolean','json')),
    description             TEXT,
    updated_at              TIMESTAMP       DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────────────────────────
-- SEED DATA
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Vehicles ────────────────────────────────────────────────────────────────
INSERT INTO pricing_vehicle_config (
    vehicle_type, display_name, base_fare, per_km_rate, minimum_fare,
    platform_fee, platform_fee_daily_cap, avg_speed_kmph,
    pickup_free_km, pickup_rate_per_km,
    waiting_grace_minutes, waiting_rate_per_min,
    traffic_grace_minutes, traffic_rate_per_min,
    max_vehicle_age_years, min_engine_cc, ac_required, category_notes,
    sort_order
) VALUES
    ('bike',    'Bike',     20,  8,  35,  1,    10, 30, 2.5, 2,   7, 1,   30, 0.5, NULL, NULL, FALSE, 'Two-wheeler',                   10),
    ('auto',    'Auto',     30,  12, 50,  1.5,  10, 25, 2.5, 3,   7, 1.5, 30, 1,   NULL, NULL, FALSE, 'Three-wheeler',                 20),
    ('car',     'Car',      50,  15, 90,  5,    10, 35, 2.5, 4,   7, 2,   30, 1.5, 8,    1000, TRUE,  '4-door sedan or hatchback',     30),
    ('xl',      'XL',       80,  20, 120, 8,    10, 30, 2.5, 5,   7, 2.5, 30, 2,   8,    1500, TRUE,  '6-7 seats, MPV/SUV',            40),
    ('premium', 'Premium',  120, 28, 200, 12,   10, 35, 2.5, 6,   7, 3,   30, 2.5, 5,    1500, TRUE,  'Leather seats, tinted windows', 50),
    ('luxury',  'Luxury',   200, 40, 350, 20,   10, 40, 2.5, 8,   7, 4,   30, 3,   4,    2000, TRUE,  'BMW/Merc/Audi class',           60)
ON CONFLICT (vehicle_type) DO NOTHING;

-- ── Convenience fee base (off-peak + peak) ──────────────────────────────────
INSERT INTO pricing_convenience_fee (vehicle_type, off_peak_base, peak_base) VALUES
    ('bike',     5,  10),
    ('auto',    10,  20),
    ('car',     20,  35),
    ('xl',      30,  55),
    ('premium', 40,  70),
    ('luxury',  60, 100)
ON CONFLICT (vehicle_type) DO NOTHING;

-- ── Distance tiers (multiplier on convenience fee base) ─────────────────────
INSERT INTO pricing_distance_tiers (tier_name, min_km, max_km, multiplier, sort_order) VALUES
    ('short',      0,   3,    0.75, 10),
    ('standard',   3,   7,    1.00, 20),
    ('long',       7,   15,   1.20, 30),
    ('very_long',  15,  NULL, 1.40, 40)
ON CONFLICT (tier_name) DO NOTHING;

-- ── Subscriber rules ────────────────────────────────────────────────────────
-- Free <=6km, 50% off beyond. Surge cap 1.25 for most tiers, 1.1 for premium.
INSERT INTO pricing_subscriber_rules (tier_name, free_km, discount_pct_beyond, surge_cap) VALUES
    ('none',      0, 0,   1.75),
    ('basic',     6, 50,  1.25),
    ('standard',  6, 50,  1.25),
    ('premium',   6, 50,  1.10),
    ('annual',    6, 50,  1.25)
ON CONFLICT (tier_name) DO NOTHING;

-- ── GST (disabled until registration) ───────────────────────────────────────
INSERT INTO pricing_gst_config (id, gst_enabled, rider_rate_pct, platform_rate_pct)
VALUES (1, FALSE, 5.00, 18.00)
ON CONFLICT (id) DO NOTHING;

-- ── Penalty config (Section 7 of PRD) ───────────────────────────────────────
INSERT INTO pricing_penalty_config (
    offense_type, offense_count, penalty_amount, suspension_days,
    requires_rekyc, is_permanent_ban, rider_refund_amount, escalation_window_days, action_notes
) VALUES
    -- wrong vehicle registration number
    ('wrong_vehicle_rc',       1,  500,   0, FALSE, FALSE, 0,   90,  'Warning notice issued'),
    ('wrong_vehicle_rc',       2, 1000,   7, TRUE,  FALSE, 0,   90,  'Re-KYC mandatory'),
    ('wrong_vehicle_rc',       3, 2500,   0, FALSE, TRUE,  0,   90,  'Reported to RTO'),

    -- vehicle category misrepresentation
    ('category_misrep',        1, 1000,   0, FALSE, FALSE, 0,  180,  'Immediate category downgrade'),
    ('category_misrep',        2, 2500,  14, FALSE, FALSE, 0,  180,  'Re-inspection mandatory'),
    ('category_misrep',        3, 5000,   0, FALSE, TRUE,  0,  180,  'Refund issued to rider'),

    -- route deviation
    ('route_deviation',        1,  200,   0, FALSE, FALSE, 100, 30,  '20%+ longer route without traffic explanation'),
    ('route_deviation',        3,    0,   7, FALSE, FALSE, 0,   30,  '3rd deviation in 30 days = 7-day suspension'),

    -- excessive driver cancellations (per-excess-cancellation fine)
    ('excess_cancellation',    1,   50,   0, FALSE, FALSE, 0,    7,  'More than 5/day without valid reason'),
    ('excess_cancellation',   15,    0,   3, FALSE, FALSE, 0,    7,  '15+ excess cancellations in 7 days = 3-day suspension')
ON CONFLICT (offense_type, offense_count) DO NOTHING;

-- ── Misc settings ───────────────────────────────────────────────────────────
INSERT INTO pricing_settings (setting_key, setting_value, value_type, description) VALUES
    ('surge_max_multiplier',          '1.75',     'number',  'Global cap on surge multiplier (non-subscriber)'),
    ('peak_ratio_threshold',          '1.2',      'number',  'Demand/supply ratio threshold to trigger peak'),
    ('peak_velocity_threshold',       '18',       'number',  'Requests/min velocity threshold for peak'),
    ('min_demand_requests',           '5',        'number',  'Min request volume before demand-peak triggers'),
    ('peak_hours_morning_start',      '8',        'number',  'Morning peak start hour (0-23)'),
    ('peak_hours_morning_end',        '10',       'number',  'Morning peak end hour (0-23)'),
    ('peak_hours_evening_start',      '18',       'number',  'Evening peak start hour (0-23)'),
    ('peak_hours_evening_end',        '21',       'number',  'Evening peak end hour (0-23)'),
    ('weather_surge_mild',            '1.1',      'number',  'Surge multiplier for mild weather (rain)'),
    ('weather_surge_severe',          '1.25',     'number',  'Surge multiplier for severe weather'),
    ('cancellation_penalty',          '50',       'number',  'Rider cancellation penalty after grace'),
    ('cancellation_distance_threshold','300',     'number',  'Meters — driver within this triggers penalty'),
    ('cancellation_driver_share_pct', '80',       'number',  'Share of cancellation penalty to driver'),
    ('cancellation_platform_share_pct','20',      'number',  'Share of cancellation penalty to platform'),
    ('excess_cancellation_per_day',   '5',        'number',  'Daily cancellation threshold before penalty applies'),
    ('config_cache_ttl_seconds',      '300',      'number',  'In-memory cache TTL for pricing config')
ON CONFLICT (setting_key) DO NOTHING;
