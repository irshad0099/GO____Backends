-- 002_drivers.sql

-- Drivers domain: drivers, driver_vehicle, driver_score, driver_metrics_daily, driver_destination_mode

-- Generated from live DB schema


-- ============================================================
-- Table: drivers
-- ============================================================
CREATE TABLE IF NOT EXISTS drivers (
    id SERIAL NOT NULL,
    user_id UUID NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    is_available BOOLEAN DEFAULT TRUE,
    is_on_duty BOOLEAN DEFAULT FALSE,
    current_latitude DECIMAL(10,8),
    current_longitude DECIMAL(11,8),
    total_rides INTEGER DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0.0,
    total_earnings DECIMAL(10,2) DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP,
    city VARCHAR(100),
    subscription_status VARCHAR(20) DEFAULT 'inactive',
    subscription_expiry TIMESTAMP,
    fcm_token VARCHAR(500),
    CONSTRAINT drivers_subscription_status_check CHECK (((subscription_status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'expired'::character varying])::text[]))),
    CONSTRAINT drivers_pkey PRIMARY KEY (id),
    CONSTRAINT drivers_user_id_key UNIQUE (user_id),
    CONSTRAINT drivers_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS drivers_user_id_key ON public.drivers USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_drivers_is_available ON public.drivers USING btree (is_available);

CREATE INDEX IF NOT EXISTS idx_drivers_location_available ON public.drivers USING btree (current_latitude, current_longitude) WHERE ((is_available = true) AND (is_verified = true) AND (current_latitude IS NOT NULL));

CREATE INDEX IF NOT EXISTS idx_drivers_user_id ON public.drivers USING btree (user_id);

-- ============================================================
-- Table: driver_vehicle
-- ============================================================
CREATE TABLE IF NOT EXISTS driver_vehicle (
    id SERIAL NOT NULL,
    driver_id INTEGER NOT NULL,
    vehicle_type VARCHAR(50) NOT NULL,
    vehicle_model VARCHAR(100),
    vehicle_color VARCHAR(50),
    rc_number VARCHAR(50) NOT NULL,
    vehicle_number VARCHAR(20) NOT NULL,
    owner_name VARCHAR(100) NOT NULL,
    rc_front TEXT NOT NULL,
    rc_back TEXT NOT NULL,
    policy_number VARCHAR(50),
    insurance_provider VARCHAR(100),
    insurance_front TEXT,
    insurance_back TEXT,
    insurance_valid_until DATE,
    permit_number VARCHAR(50),
    permit_type VARCHAR(50),
    permit_document TEXT,
    permit_valid_until DATE,
    verification_status VARCHAR(20) DEFAULT 'pending',
    verified_at TIMESTAMP,
    rejected_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT driver_vehicle_vehicle_type_check CHECK (((vehicle_type)::text = ANY ((ARRAY['bike'::character varying, 'auto'::character varying, 'car'::character varying])::text[]))),
    CONSTRAINT driver_vehicle_verification_status_check CHECK (((verification_status)::text = ANY ((ARRAY['pending'::character varying, 'verified'::character varying, 'rejected'::character varying])::text[]))),
    CONSTRAINT driver_vehicle_pkey PRIMARY KEY (id),
    CONSTRAINT driver_vehicle_driver_id_key UNIQUE (driver_id),
    CONSTRAINT driver_vehicle_rc_number_key UNIQUE (rc_number),
    CONSTRAINT driver_vehicle_vehicle_number_key UNIQUE (vehicle_number),
    CONSTRAINT driver_vehicle_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS driver_vehicle_driver_id_key ON public.driver_vehicle USING btree (driver_id);

CREATE UNIQUE INDEX IF NOT EXISTS driver_vehicle_rc_number_key ON public.driver_vehicle USING btree (rc_number);

CREATE UNIQUE INDEX IF NOT EXISTS driver_vehicle_vehicle_number_key ON public.driver_vehicle USING btree (vehicle_number);

CREATE INDEX IF NOT EXISTS idx_driver_vehicle_driver_id ON public.driver_vehicle USING btree (driver_id);

-- ============================================================
-- Table: driver_score
-- ============================================================
CREATE TABLE IF NOT EXISTS driver_score (
    driver_id INTEGER NOT NULL,
    avg_rating DECIMAL(3,2),
    acceptance_rate DECIMAL(5,2),
    completion_rate DECIMAL(5,2),
    ontime_rate DECIMAL(5,2),
    cancel_rate DECIMAL(5,2),
    complaint_penalty INTEGER DEFAULT 0,
    score_total INTEGER,
    tier VARCHAR(20),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT driver_score_tier_check CHECK (((tier)::text = ANY ((ARRAY['PLATINUM'::character varying, 'GOLD'::character varying, 'SILVER'::character varying, 'WATCHLIST'::character varying])::text[]))),
    CONSTRAINT driver_score_pkey PRIMARY KEY (driver_id),
    CONSTRAINT driver_score_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_driver_score_tier ON public.driver_score USING btree (tier);

-- ============================================================
-- Table: driver_metrics_daily
-- ============================================================
CREATE TABLE IF NOT EXISTS driver_metrics_daily (
    id SERIAL NOT NULL,
    driver_id INTEGER,
    date DATE NOT NULL,
    rides_assigned INTEGER DEFAULT 0,
    rides_accepted INTEGER DEFAULT 0,
    rides_completed INTEGER DEFAULT 0,
    rides_cancelled_driver INTEGER DEFAULT 0,
    rides_cancelled_user INTEGER DEFAULT 0,
    complaints_count INTEGER DEFAULT 0,
    ontime_arrival_count INTEGER DEFAULT 0,
    late_arrival_count INTEGER DEFAULT 0,
    CONSTRAINT driver_metrics_daily_pkey PRIMARY KEY (id),
    CONSTRAINT driver_metrics_daily_driver_id_date_key UNIQUE (driver_id, date),
    CONSTRAINT driver_metrics_daily_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS driver_metrics_daily_driver_id_date_key ON public.driver_metrics_daily USING btree (driver_id, date);

CREATE INDEX IF NOT EXISTS idx_driver_metrics_daily_driver_date ON public.driver_metrics_daily USING btree (driver_id, date);

-- ============================================================
-- Table: driver_destination_mode
-- ============================================================
CREATE TABLE IF NOT EXISTS driver_destination_mode (
    id SERIAL NOT NULL,
    driver_id INTEGER NOT NULL,
    dest_latitude DECIMAL(10,8) NOT NULL,
    dest_longitude DECIMAL(11,8) NOT NULL,
    dest_address TEXT NOT NULL,
    radius_km DECIMAL(5,2) DEFAULT 3.0 NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_date DATE DEFAULT CURRENT_DATE NOT NULL,
    deactivated_at TIMESTAMP,
    deactivation_reason VARCHAR(30),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT driver_destination_mode_deactivation_reason_check CHECK (((deactivation_reason)::text = ANY ((ARRAY['manual'::character varying, 'expired'::character varying, 'destination_reached'::character varying, 'ride_completed'::character varying])::text[]))),
    CONSTRAINT driver_destination_mode_pkey PRIMARY KEY (id),
    CONSTRAINT driver_destination_mode_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dest_mode_active ON public.driver_destination_mode USING btree (driver_id, is_active) WHERE (is_active = true);

CREATE INDEX IF NOT EXISTS idx_dest_mode_daily ON public.driver_destination_mode USING btree (driver_id, used_date);

CREATE INDEX IF NOT EXISTS idx_dest_mode_expires ON public.driver_destination_mode USING btree (expires_at) WHERE (is_active = true);
