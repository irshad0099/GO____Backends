-- 009_pricing.sql

-- Pricing: pricing_vehicle_config, pricing_convenience_fee, pricing_distance_tiers, pricing_subscriber_rules, pricing_gst_config, pricing_penalty_config, pricing_settings

-- Generated from live DB schema


-- ============================================================
-- Table: pricing_vehicle_config
-- ============================================================
CREATE TABLE IF NOT EXISTS pricing_vehicle_config (
    id SERIAL NOT NULL,
    vehicle_type VARCHAR(20) NOT NULL,
    display_name VARCHAR(50) NOT NULL,
    base_fare DECIMAL(10,2) NOT NULL,
    per_km_rate DECIMAL(10,2) NOT NULL,
    minimum_fare DECIMAL(10,2) NOT NULL,
    platform_fee DECIMAL(10,2) DEFAULT 0 NOT NULL,
    platform_fee_daily_cap INTEGER DEFAULT 10 NOT NULL,
    avg_speed_kmph DECIMAL(5,2) DEFAULT 30 NOT NULL,
    pickup_free_km DECIMAL(5,2) DEFAULT 2.5 NOT NULL,
    pickup_rate_per_km DECIMAL(10,2) DEFAULT 0 NOT NULL,
    waiting_grace_minutes INTEGER DEFAULT 7 NOT NULL,
    waiting_rate_per_min DECIMAL(10,2) DEFAULT 0 NOT NULL,
    traffic_grace_minutes INTEGER DEFAULT 30 NOT NULL,
    traffic_rate_per_min DECIMAL(10,2) DEFAULT 0 NOT NULL,
    max_vehicle_age_years INTEGER,
    min_engine_cc INTEGER,
    ac_required BOOLEAN DEFAULT FALSE NOT NULL,
    category_notes TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    sort_order INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pricing_vehicle_config_pkey PRIMARY KEY (id),
    CONSTRAINT pricing_vehicle_config_vehicle_type_key UNIQUE (vehicle_type)
);

CREATE INDEX IF NOT EXISTS idx_pricing_vehicle_active ON public.pricing_vehicle_config USING btree (is_active, sort_order);

CREATE UNIQUE INDEX IF NOT EXISTS pricing_vehicle_config_vehicle_type_key ON public.pricing_vehicle_config USING btree (vehicle_type);

-- ============================================================
-- Table: pricing_convenience_fee
-- ============================================================
CREATE TABLE IF NOT EXISTS pricing_convenience_fee (
    id SERIAL NOT NULL,
    vehicle_type VARCHAR(20) NOT NULL,
    off_peak_base DECIMAL(10,2) NOT NULL,
    peak_base DECIMAL(10,2) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pricing_convenience_fee_pkey PRIMARY KEY (id),
    CONSTRAINT pricing_convenience_fee_vehicle_type_key UNIQUE (vehicle_type),
    CONSTRAINT pricing_convenience_fee_vehicle_type_fkey FOREIGN KEY (vehicle_type) REFERENCES pricing_vehicle_config(vehicle_type) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS pricing_convenience_fee_vehicle_type_key ON public.pricing_convenience_fee USING btree (vehicle_type);

-- ============================================================
-- Table: pricing_distance_tiers
-- ============================================================
CREATE TABLE IF NOT EXISTS pricing_distance_tiers (
    id SERIAL NOT NULL,
    tier_name VARCHAR(30) NOT NULL,
    min_km DECIMAL(6,2) NOT NULL,
    max_km DECIMAL(6,2),
    multiplier DECIMAL(4,2) DEFAULT 1.0 NOT NULL,
    sort_order INTEGER DEFAULT 0 NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pricing_distance_tiers_pkey PRIMARY KEY (id),
    CONSTRAINT pricing_distance_tiers_tier_name_key UNIQUE (tier_name)
);

CREATE INDEX IF NOT EXISTS idx_pricing_tiers_order ON public.pricing_distance_tiers USING btree (is_active, sort_order);

CREATE UNIQUE INDEX IF NOT EXISTS pricing_distance_tiers_tier_name_key ON public.pricing_distance_tiers USING btree (tier_name);

-- ============================================================
-- Table: pricing_subscriber_rules
-- ============================================================
CREATE TABLE IF NOT EXISTS pricing_subscriber_rules (
    id SERIAL NOT NULL,
    tier_name VARCHAR(30) NOT NULL,
    free_km DECIMAL(5,2) DEFAULT 0 NOT NULL,
    discount_pct_beyond DECIMAL(5,2) DEFAULT 0 NOT NULL,
    surge_cap DECIMAL(4,2) DEFAULT 1.75 NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pricing_subscriber_rules_pkey PRIMARY KEY (id),
    CONSTRAINT pricing_subscriber_rules_tier_name_key UNIQUE (tier_name)
);

CREATE UNIQUE INDEX IF NOT EXISTS pricing_subscriber_rules_tier_name_key ON public.pricing_subscriber_rules USING btree (tier_name);

-- ============================================================
-- Table: pricing_gst_config
-- ============================================================
CREATE TABLE IF NOT EXISTS pricing_gst_config (
    id SERIAL NOT NULL,
    gst_enabled BOOLEAN DEFAULT FALSE NOT NULL,
    rider_rate_pct DECIMAL(5,2) DEFAULT 5.00 NOT NULL,
    platform_rate_pct DECIMAL(5,2) DEFAULT 18.00 NOT NULL,
    rider_sac_code VARCHAR(10) DEFAULT '9964' NOT NULL,
    platform_sac_code VARCHAR(10) DEFAULT '9985' NOT NULL,
    gst_registration_no VARCHAR(30),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pricing_gst_config_pkey PRIMARY KEY (id)
);

-- ============================================================
-- Table: pricing_penalty_config
-- ============================================================
CREATE TABLE IF NOT EXISTS pricing_penalty_config (
    id SERIAL NOT NULL,
    offense_type VARCHAR(50) NOT NULL,
    offense_count INTEGER NOT NULL,
    penalty_amount DECIMAL(10,2) DEFAULT 0 NOT NULL,
    suspension_days INTEGER DEFAULT 0 NOT NULL,
    requires_rekyc BOOLEAN DEFAULT FALSE NOT NULL,
    is_permanent_ban BOOLEAN DEFAULT FALSE NOT NULL,
    rider_refund_amount DECIMAL(10,2) DEFAULT 0 NOT NULL,
    escalation_window_days INTEGER DEFAULT 90 NOT NULL,
    action_notes TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pricing_penalty_config_pkey PRIMARY KEY (id),
    CONSTRAINT pricing_penalty_config_offense_type_offense_count_key UNIQUE (offense_type, offense_count)
);

CREATE INDEX IF NOT EXISTS idx_pricing_penalty_offense ON public.pricing_penalty_config USING btree (offense_type, offense_count);

CREATE UNIQUE INDEX IF NOT EXISTS pricing_penalty_config_offense_type_offense_count_key ON public.pricing_penalty_config USING btree (offense_type, offense_count);

-- ============================================================
-- Table: pricing_settings
-- ============================================================
CREATE TABLE IF NOT EXISTS pricing_settings (
    setting_key VARCHAR(80) NOT NULL,
    setting_value TEXT NOT NULL,
    value_type VARCHAR(10) DEFAULT 'string' NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pricing_settings_value_type_check CHECK (((value_type)::text = ANY ((ARRAY['string'::character varying, 'number'::character varying, 'boolean'::character varying, 'json'::character varying])::text[]))),
    CONSTRAINT pricing_settings_pkey PRIMARY KEY (setting_key)
);

-- ============================================================
-- Seed Data (ON CONFLICT DO NOTHING — safe to re-run)
-- ============================================================

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

INSERT INTO pricing_convenience_fee (vehicle_type, off_peak_base, peak_base) VALUES
    ('bike',     5,  10),
    ('auto',    10,  20),
    ('car',     20,  35),
    ('xl',      30,  55),
    ('premium', 40,  70),
    ('luxury',  60, 100)
ON CONFLICT (vehicle_type) DO NOTHING;

INSERT INTO pricing_distance_tiers (tier_name, min_km, max_km, multiplier, sort_order) VALUES
    ('short',      0,   3,    0.75, 10),
    ('standard',   3,   7,    1.00, 20),
    ('long',       7,   15,   1.20, 30),
    ('very_long',  15,  NULL, 1.40, 40)
ON CONFLICT (tier_name) DO NOTHING;

INSERT INTO pricing_subscriber_rules (tier_name, free_km, discount_pct_beyond, surge_cap) VALUES
    ('none',      0, 0,   1.75),
    ('basic',     6, 50,  1.25),
    ('standard',  6, 50,  1.25),
    ('premium',   6, 50,  1.10),
    ('annual',    6, 50,  1.25)
ON CONFLICT (tier_name) DO NOTHING;

INSERT INTO pricing_gst_config (id, gst_enabled, rider_rate_pct, platform_rate_pct)
VALUES (1, FALSE, 5.00, 18.00)
ON CONFLICT (id) DO NOTHING;

INSERT INTO pricing_penalty_config (
    offense_type, offense_count, penalty_amount, suspension_days,
    requires_rekyc, is_permanent_ban, rider_refund_amount, escalation_window_days, action_notes
) VALUES
    ('wrong_vehicle_rc',       1,  500,   0, FALSE, FALSE, 0,   90,  'Warning notice issued'),
    ('wrong_vehicle_rc',       2, 1000,   7, TRUE,  FALSE, 0,   90,  'Re-KYC mandatory'),
    ('wrong_vehicle_rc',       3, 2500,   0, FALSE, TRUE,  0,   90,  'Reported to RTO'),
    ('category_misrep',        1, 1000,   0, FALSE, FALSE, 0,  180,  'Immediate category downgrade'),
    ('category_misrep',        2, 2500,  14, FALSE, FALSE, 0,  180,  'Re-inspection mandatory'),
    ('category_misrep',        3, 5000,   0, FALSE, TRUE,  0,  180,  'Refund issued to rider'),
    ('route_deviation',        1,  200,   0, FALSE, FALSE, 100, 30,  '20%+ longer route without traffic explanation'),
    ('route_deviation',        3,    0,   7, FALSE, FALSE, 0,   30,  '3rd deviation in 30 days = 7-day suspension'),
    ('excess_cancellation',    1,   50,   0, FALSE, FALSE, 0,    7,  'More than 5/day without valid reason'),
    ('excess_cancellation',   15,    0,   3, FALSE, FALSE, 0,    7,  '15+ excess cancellations in 7 days = 3-day suspension')
ON CONFLICT (offense_type, offense_count) DO NOTHING;

INSERT INTO pricing_settings (setting_key, setting_value, value_type, description) VALUES
    ('surge_max_multiplier',           '1.75',  'number',  'Global cap on surge multiplier (non-subscriber)'),
    ('peak_ratio_threshold',           '1.2',   'number',  'Demand/supply ratio threshold to trigger peak'),
    ('peak_velocity_threshold',        '18',    'number',  'Requests/min velocity threshold for peak'),
    ('min_demand_requests',            '5',     'number',  'Min request volume before demand-peak triggers'),
    ('peak_hours_morning_start',       '8',     'number',  'Morning peak start hour (0-23)'),
    ('peak_hours_morning_end',         '10',    'number',  'Morning peak end hour (0-23)'),
    ('peak_hours_evening_start',       '18',    'number',  'Evening peak start hour (0-23)'),
    ('peak_hours_evening_end',         '21',    'number',  'Evening peak end hour (0-23)'),
    ('weather_surge_mild',             '1.1',   'number',  'Surge multiplier for mild weather (rain)'),
    ('weather_surge_severe',           '1.25',  'number',  'Surge multiplier for severe weather'),
    ('cancellation_penalty',           '50',    'number',  'Rider cancellation penalty after grace'),
    ('cancellation_distance_threshold','300',   'number',  'Meters — driver within this triggers penalty'),
    ('cancellation_driver_share_pct',  '80',    'number',  'Share of cancellation penalty to driver'),
    ('cancellation_platform_share_pct','20',    'number',  'Share of cancellation penalty to platform'),
    ('excess_cancellation_per_day',    '5',     'number',  'Daily cancellation threshold before penalty applies'),
    ('config_cache_ttl_seconds',       '300',   'number',  'In-memory cache TTL for pricing config')
ON CONFLICT (setting_key) DO NOTHING;
