-- 003_rides.sql

-- Rides domain: rides, ride_cancellations, ride_otps, ride_rejections, scheduled_rides, ride_invoices, pending_recoveries

-- Generated from live DB schema


-- ============================================================
-- Table: rides
-- ============================================================
CREATE TABLE IF NOT EXISTS rides (
    id SERIAL NOT NULL,
    ride_number VARCHAR(50) NOT NULL,
    passenger_id UUID NOT NULL,
    driver_id INTEGER,
    vehicle_type VARCHAR(50) NOT NULL,
    pickup_latitude DECIMAL(10,8) NOT NULL,
    pickup_longitude DECIMAL(11,8) NOT NULL,
    pickup_address TEXT NOT NULL,
    pickup_location_name VARCHAR(255),
    dropoff_latitude DECIMAL(10,8) NOT NULL,
    dropoff_longitude DECIMAL(11,8) NOT NULL,
    dropoff_address TEXT NOT NULL,
    dropoff_location_name VARCHAR(255),
    distance_km DECIMAL(10,2) NOT NULL,
    duration_minutes INTEGER NOT NULL,
    base_fare DECIMAL(10,2) NOT NULL,
    distance_fare DECIMAL(10,2) NOT NULL,
    time_fare DECIMAL(10,2) NOT NULL,
    surge_multiplier DECIMAL(3,2) DEFAULT 1.0,
    estimated_fare DECIMAL(10,2) NOT NULL,
    actual_fare DECIMAL(10,2),
    discount_amount DECIMAL(10,2) DEFAULT 0.0,
    final_fare DECIMAL(10,2),
    status VARCHAR(50) DEFAULT 'requested' NOT NULL,
    payment_status VARCHAR(50) DEFAULT 'pending',
    payment_method VARCHAR(50),
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    driver_assigned_at TIMESTAMP,
    driver_arrived_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    cancelled_by VARCHAR(20),
    cancellation_reason TEXT,
    driver_current_latitude DECIMAL(10,8),
    driver_current_longitude DECIMAL(11,8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ride_otp VARCHAR(10),
    is_scheduled BOOLEAN DEFAULT FALSE,
    scheduled_ride_id INTEGER,
    coupon_id INTEGER,
    coupon_discount DECIMAL(10,2) DEFAULT 0,
    invoice_generated BOOLEAN DEFAULT FALSE,
    tip_amount DECIMAL(10,2) DEFAULT 0,
    driver_pickup_distance_km DECIMAL(10,2) DEFAULT 0,
    convenience_fee DECIMAL(10,2) DEFAULT 0,
    is_peak BOOLEAN DEFAULT FALSE,
    demand_supply_ratio DECIMAL(5,2) DEFAULT 1.0,
    subscription_discount DECIMAL(10,2) DEFAULT 0,
    is_free_ride BOOLEAN DEFAULT FALSE,
    collection_confirmed_at TIMESTAMP,
    collection_method_actual VARCHAR(20),
    platform_share DECIMAL(10,2) DEFAULT 0,
    locked_is_subscribed BOOLEAN DEFAULT FALSE,
    locked_subscriber_tier VARCHAR(20),
    locked_surge_cap DECIMAL(4,2) DEFAULT 1.75,
    locked_is_peak BOOLEAN DEFAULT FALSE,
    gst_on_fare DECIMAL(10,2) DEFAULT 0,
    gst_on_platform_fee DECIMAL(10,2) DEFAULT 0,
    fare_before_gst DECIMAL(10,2) DEFAULT 0,
    passenger_total DECIMAL(10,2) DEFAULT 0,
    pickup_compensation DECIMAL(10,2) DEFAULT 0,
    waiting_charges DECIMAL(10,2) DEFAULT 0,
    traffic_compensation DECIMAL(10,2) DEFAULT 0,
    actual_distance_km DECIMAL(10,2),
    payment_collected_at TIMESTAMP,
    payment_confirmed_at TIMESTAMP,
    cash_confirmed_by_driver INTEGER,
    cash_confirmed_at TIMESTAMP,
    CONSTRAINT rides_cancelled_by_check CHECK (((cancelled_by)::text = ANY ((ARRAY['passenger'::character varying, 'driver'::character varying, 'system'::character varying])::text[]))),
    CONSTRAINT rides_collection_method_actual_check CHECK (((collection_method_actual IS NULL) OR ((collection_method_actual)::text = ANY ((ARRAY['cash'::character varying, 'personal_upi'::character varying])::text[])))),
    CONSTRAINT rides_payment_method_check CHECK (((payment_method)::text = ANY ((ARRAY['cash'::character varying, 'card'::character varying, 'wallet'::character varying, 'upi'::character varying, 'qr'::character varying])::text[]))),
    CONSTRAINT rides_payment_status_check CHECK (((payment_status)::text = ANY ((ARRAY['pending'::character varying, 'completed'::character varying, 'failed'::character varying, 'refunded'::character varying, 'cash_collected'::character varying, 'cash_confirmed'::character varying])::text[]))),
    CONSTRAINT rides_status_check CHECK (((status)::text = ANY ((ARRAY['requested'::character varying, 'driver_assigned'::character varying, 'driver_arrived'::character varying, 'in_progress'::character varying, 'completed'::character varying, 'cancelled'::character varying, 'expired'::character varying])::text[]))),
    CONSTRAINT rides_vehicle_type_check CHECK (((vehicle_type)::text = ANY ((ARRAY['bike'::character varying, 'auto'::character varying, 'car'::character varying])::text[]))),
    CONSTRAINT rides_pkey PRIMARY KEY (id),
    CONSTRAINT rides_ride_number_key UNIQUE (ride_number),
    CONSTRAINT rides_cash_confirmed_by_driver_fkey FOREIGN KEY (cash_confirmed_by_driver) REFERENCES drivers(id),
    CONSTRAINT rides_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE SET NULL,
    CONSTRAINT rides_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES drivers(id),
    CONSTRAINT rides_passenger_id_fkey FOREIGN KEY (passenger_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT rides_scheduled_ride_id_fkey FOREIGN KEY (scheduled_ride_id) REFERENCES scheduled_rides(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_rides_coupon ON public.rides USING btree (coupon_id) WHERE (coupon_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_rides_driver_id ON public.rides USING btree (driver_id);

CREATE INDEX IF NOT EXISTS idx_rides_passenger_id ON public.rides USING btree (passenger_id);

CREATE INDEX IF NOT EXISTS idx_rides_pickup_location ON public.rides USING btree (pickup_latitude, pickup_longitude) WHERE ((status)::text = 'requested'::text);

CREATE INDEX IF NOT EXISTS idx_rides_requested_at ON public.rides USING btree (requested_at);

CREATE INDEX IF NOT EXISTS idx_rides_scheduled ON public.rides USING btree (is_scheduled) WHERE (is_scheduled = true);

CREATE INDEX IF NOT EXISTS idx_rides_status ON public.rides USING btree (status);

CREATE INDEX IF NOT EXISTS idx_rides_surge_lookup ON public.rides USING btree (vehicle_type, status, requested_at);

CREATE INDEX IF NOT EXISTS idx_rides_vehicle_type ON public.rides USING btree (vehicle_type);

CREATE UNIQUE INDEX IF NOT EXISTS rides_ride_number_key ON public.rides USING btree (ride_number);

-- ============================================================
-- Table: ride_cancellations
-- ============================================================
CREATE TABLE IF NOT EXISTS ride_cancellations (
    id SERIAL NOT NULL,
    ride_id INTEGER NOT NULL,
    cancelled_by_user UUID NOT NULL,
    cancelled_by_role VARCHAR(20) NOT NULL,
    reason_code VARCHAR(50) NOT NULL,
    reason_text TEXT,
    driver_distance_meters INTEGER DEFAULT 0,
    penalty_applied BOOLEAN DEFAULT FALSE NOT NULL,
    penalty_amount DECIMAL(10,2) DEFAULT 0.00,
    driver_share DECIMAL(10,2) DEFAULT 0.00,
    platform_share DECIMAL(10,2) DEFAULT 0.00,
    ride_status_at_cancel VARCHAR(50) NOT NULL,
    cancelled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ride_cancellations_cancelled_by_role_check CHECK (((cancelled_by_role)::text = ANY ((ARRAY['passenger'::character varying, 'driver'::character varying, 'system'::character varying])::text[]))),
    CONSTRAINT ride_cancellations_reason_code_check CHECK (((reason_code)::text = ANY ((ARRAY['driver_too_far'::character varying, 'changed_plan'::character varying, 'found_another_ride'::character varying, 'driver_asked_to_cancel'::character varying, 'wrong_pickup'::character varying, 'long_wait'::character varying, 'personal_emergency'::character varying, 'rider_not_at_pickup'::character varying, 'wrong_route'::character varying, 'vehicle_issue'::character varying, 'rider_misbehavior'::character varying, 'system_timeout'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT ride_cancellations_ride_status_at_cancel_check CHECK (((ride_status_at_cancel)::text = ANY ((ARRAY['requested'::character varying, 'driver_assigned'::character varying, 'driver_arrived'::character varying, 'in_progress'::character varying])::text[]))),
    CONSTRAINT ride_cancellations_pkey PRIMARY KEY (id),
    CONSTRAINT ride_cancellations_ride_id_key UNIQUE (ride_id),
    CONSTRAINT ride_cancellations_cancelled_by_user_fkey FOREIGN KEY (cancelled_by_user) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT ride_cancellations_ride_id_fkey FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ride_cancellations_reason ON public.ride_cancellations USING btree (reason_code);

CREATE INDEX IF NOT EXISTS idx_ride_cancellations_ride_id ON public.ride_cancellations USING btree (ride_id);

CREATE INDEX IF NOT EXISTS idx_ride_cancellations_time ON public.ride_cancellations USING btree (cancelled_at);

CREATE INDEX IF NOT EXISTS idx_ride_cancellations_user ON public.ride_cancellations USING btree (cancelled_by_user);

CREATE UNIQUE INDEX IF NOT EXISTS ride_cancellations_ride_id_key ON public.ride_cancellations USING btree (ride_id);

-- ============================================================
-- Table: ride_otps
-- ============================================================
CREATE TABLE IF NOT EXISTS ride_otps (
    id SERIAL NOT NULL,
    ride_id INTEGER NOT NULL,
    otp_code VARCHAR(10) NOT NULL,
    attempts INTEGER DEFAULT 0 NOT NULL,
    max_attempts INTEGER DEFAULT 3 NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE NOT NULL,
    verified_at TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ride_otps_pkey PRIMARY KEY (id),
    CONSTRAINT ride_otps_ride_id_otp_code_key UNIQUE (ride_id, otp_code),
    CONSTRAINT ride_otps_ride_id_fkey FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ride_otps_expires ON public.ride_otps USING btree (expires_at) WHERE (is_verified = false);

CREATE INDEX IF NOT EXISTS idx_ride_otps_ride_id ON public.ride_otps USING btree (ride_id);

CREATE UNIQUE INDEX IF NOT EXISTS ride_otps_ride_id_otp_code_key ON public.ride_otps USING btree (ride_id, otp_code);

-- ============================================================
-- Table: ride_rejections
-- ============================================================
CREATE TABLE IF NOT EXISTS ride_rejections (
    id SERIAL NOT NULL,
    ride_id INTEGER NOT NULL,
    driver_id INTEGER NOT NULL,
    reason_code VARCHAR(30) NOT NULL,
    reason_text TEXT,
    is_auto_reject BOOLEAN DEFAULT FALSE NOT NULL,
    rejected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ride_rejections_reason_code_check CHECK (((reason_code)::text = ANY ((ARRAY['too_far'::character varying, 'wrong_direction'::character varying, 'low_fare'::character varying, 'bad_area'::character varying, 'busy'::character varying, 'ending_shift'::character varying, 'timeout'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT ride_rejections_pkey PRIMARY KEY (id),
    CONSTRAINT ride_rejections_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
    CONSTRAINT ride_rejections_ride_id_fkey FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ride_rejections_driver ON public.ride_rejections USING btree (driver_id);

CREATE INDEX IF NOT EXISTS idx_ride_rejections_driver_time ON public.ride_rejections USING btree (driver_id, rejected_at DESC);

CREATE INDEX IF NOT EXISTS idx_ride_rejections_reason ON public.ride_rejections USING btree (reason_code);

CREATE INDEX IF NOT EXISTS idx_ride_rejections_ride ON public.ride_rejections USING btree (ride_id);

CREATE INDEX IF NOT EXISTS idx_ride_rejections_time ON public.ride_rejections USING btree (rejected_at);

-- ============================================================
-- Table: scheduled_rides
-- ============================================================
CREATE TABLE IF NOT EXISTS scheduled_rides (
    id SERIAL NOT NULL,
    passenger_id UUID NOT NULL,
    pickup_latitude DECIMAL(10,8) NOT NULL,
    pickup_longitude DECIMAL(11,8) NOT NULL,
    pickup_address TEXT NOT NULL,
    pickup_location_name VARCHAR(255),
    dropoff_latitude DECIMAL(10,8) NOT NULL,
    dropoff_longitude DECIMAL(11,8) NOT NULL,
    dropoff_address TEXT NOT NULL,
    dropoff_location_name VARCHAR(255),
    vehicle_type VARCHAR(50) NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'cash',
    pickup_time TIMESTAMP NOT NULL,
    estimated_fare DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'scheduled' NOT NULL,
    ride_id INTEGER,
    cancelled_at TIMESTAMP,
    cancel_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT scheduled_rides_payment_method_check CHECK (((payment_method)::text = ANY ((ARRAY['cash'::character varying, 'card'::character varying, 'wallet'::character varying, 'upi'::character varying])::text[]))),
    CONSTRAINT scheduled_rides_status_check CHECK (((status)::text = ANY ((ARRAY['scheduled'::character varying, 'triggered'::character varying, 'ride_created'::character varying, 'completed'::character varying, 'cancelled'::character varying, 'failed'::character varying])::text[]))),
    CONSTRAINT scheduled_rides_vehicle_type_check CHECK (((vehicle_type)::text = ANY ((ARRAY['bike'::character varying, 'auto'::character varying, 'car'::character varying])::text[]))),
    CONSTRAINT scheduled_rides_pkey PRIMARY KEY (id),
    CONSTRAINT scheduled_rides_passenger_id_fkey FOREIGN KEY (passenger_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT scheduled_rides_ride_id_fkey FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_scheduled_rides_passenger ON public.scheduled_rides USING btree (passenger_id);

CREATE INDEX IF NOT EXISTS idx_scheduled_rides_status ON public.scheduled_rides USING btree (status);

CREATE INDEX IF NOT EXISTS idx_scheduled_rides_trigger ON public.scheduled_rides USING btree (pickup_time, status) WHERE ((status)::text = 'scheduled'::text);

-- ============================================================
-- Table: ride_invoices
-- ============================================================
CREATE TABLE IF NOT EXISTS ride_invoices (
    id SERIAL NOT NULL,
    ride_id INTEGER NOT NULL,
    invoice_number VARCHAR(50) NOT NULL,
    base_fare DECIMAL(10,2) DEFAULT 0 NOT NULL,
    distance_fare DECIMAL(10,2) DEFAULT 0 NOT NULL,
    time_fare DECIMAL(10,2) DEFAULT 0 NOT NULL,
    surge_charge DECIMAL(10,2) DEFAULT 0 NOT NULL,
    convenience_fee DECIMAL(10,2) DEFAULT 0 NOT NULL,
    platform_fee DECIMAL(10,2) DEFAULT 0 NOT NULL,
    waiting_charges DECIMAL(10,2) DEFAULT 0 NOT NULL,
    pickup_charges DECIMAL(10,2) DEFAULT 0 NOT NULL,
    discount_amount DECIMAL(10,2) DEFAULT 0 NOT NULL,
    coupon_code VARCHAR(30),
    subscription_discount DECIMAL(10,2) DEFAULT 0 NOT NULL,
    toll_charges DECIMAL(10,2) DEFAULT 0 NOT NULL,
    tax_amount DECIMAL(10,2) DEFAULT 0 NOT NULL,
    tax_percent DECIMAL(5,2) DEFAULT 0 NOT NULL,
    tip_amount DECIMAL(10,2) DEFAULT 0 NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(5) DEFAULT 'INR' NOT NULL,
    payment_method VARCHAR(50),
    payment_status VARCHAR(20),
    paid_at TIMESTAMP,
    vehicle_type VARCHAR(50) NOT NULL,
    distance_km DECIMAL(10,2) NOT NULL,
    duration_minutes INTEGER NOT NULL,
    pickup_address TEXT NOT NULL,
    dropoff_address TEXT NOT NULL,
    ride_date TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ride_invoices_payment_method_check CHECK (((payment_method)::text = ANY ((ARRAY['cash'::character varying, 'card'::character varying, 'wallet'::character varying, 'upi'::character varying])::text[]))),
    CONSTRAINT ride_invoices_payment_status_check CHECK (((payment_status)::text = ANY ((ARRAY['pending'::character varying, 'paid'::character varying, 'refunded'::character varying])::text[]))),
    CONSTRAINT ride_invoices_pkey PRIMARY KEY (id),
    CONSTRAINT ride_invoices_invoice_number_key UNIQUE (invoice_number),
    CONSTRAINT ride_invoices_ride_id_key UNIQUE (ride_id),
    CONSTRAINT ride_invoices_ride_id_fkey FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ride_invoices_number ON public.ride_invoices USING btree (invoice_number);

CREATE INDEX IF NOT EXISTS idx_ride_invoices_ride ON public.ride_invoices USING btree (ride_id);

CREATE UNIQUE INDEX IF NOT EXISTS ride_invoices_invoice_number_key ON public.ride_invoices USING btree (invoice_number);

CREATE UNIQUE INDEX IF NOT EXISTS ride_invoices_ride_id_key ON public.ride_invoices USING btree (ride_id);

-- ============================================================
-- Table: pending_recoveries
-- ============================================================
CREATE TABLE IF NOT EXISTS pending_recoveries (
    id SERIAL NOT NULL,
    ride_id INTEGER NOT NULL,
    rider_id UUID NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    attempt_count INTEGER DEFAULT 0 NOT NULL,
    last_attempt_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    failure_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pending_recoveries_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'recovered'::character varying, 'failed'::character varying, 'manual_review'::character varying])::text[]))),
    CONSTRAINT pending_recoveries_pkey PRIMARY KEY (id),
    CONSTRAINT pending_recoveries_ride_id_fkey FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE,
    CONSTRAINT pending_recoveries_rider_id_fkey FOREIGN KEY (rider_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pending_recoveries_rider ON public.pending_recoveries USING btree (rider_id);

CREATE INDEX IF NOT EXISTS idx_pending_recoveries_status ON public.pending_recoveries USING btree (status, created_at);
