-- 001_users.sql

-- Users domain: users, sessions, otps, saved_addresses, notifications

-- Generated from live DB schema


CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS citext;


-- ============================================================
-- Table: users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT uuid_generate_v4() NOT NULL,
    phone_number VARCHAR(15) NOT NULL,
    email VARCHAR(255),
    full_name VARCHAR(100),
    profile_picture TEXT,
    role VARCHAR(20) NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fcm_token VARCHAR(500),
    is_payment_defaulter BOOLEAN DEFAULT FALSE,
    payment_locked_until TIMESTAMP,
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['passenger'::character varying, 'driver'::character varying, 'admin'::character varying, 'super_admin'::character varying])::text[]))),
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_email_role_key UNIQUE (email, role),
    CONSTRAINT users_phone_number_role_key UNIQUE (phone_number, role)
);

CREATE INDEX IF NOT EXISTS idx_users_is_verified ON public.users USING btree (is_verified);

CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users USING btree (phone_number);

CREATE INDEX IF NOT EXISTS idx_users_role ON public.users USING btree (role);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_role_key ON public.users USING btree (email, role);

CREATE UNIQUE INDEX IF NOT EXISTS users_phone_number_role_key ON public.users USING btree (phone_number, role);

-- ============================================================
-- Table: sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL NOT NULL,
    user_id UUID NOT NULL,
    access_token TEXT NOT NULL,
    device_id VARCHAR(255),
    device_type VARCHAR(50),
    device_model VARCHAR(100),
    os_version VARCHAR(50),
    app_version VARCHAR(20),
    ip_address INET,
    user_agent TEXT,
    location JSONB,
    is_revoked BOOLEAN DEFAULT FALSE,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT sessions_device_type_check CHECK (((device_type)::text = ANY ((ARRAY['android'::character varying, 'ios'::character varying, 'web'::character varying])::text[]))),
    CONSTRAINT sessions_pkey PRIMARY KEY (id),
    CONSTRAINT unique_access_token UNIQUE (access_token),
    CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_access_token ON public.sessions USING btree (access_token);

CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON public.sessions USING btree (expires_at);

CREATE INDEX IF NOT EXISTS idx_sessions_is_revoked ON public.sessions USING btree (is_revoked);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions USING btree (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS unique_access_token ON public.sessions USING btree (access_token);

-- ============================================================
-- Table: otps
-- ============================================================
CREATE TABLE IF NOT EXISTS otps (
    id UUID DEFAULT uuid_generate_v4() NOT NULL,
    phone_number VARCHAR(255) NOT NULL,
    otp_code VARCHAR(6) NOT NULL,
    purpose VARCHAR(20) DEFAULT 'signin',
    attempts INTEGER DEFAULT 0,
    is_used BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT otps_purpose_check CHECK (((purpose)::text = ANY ((ARRAY['signup'::character varying, 'signin'::character varying, 'reset_password'::character varying, 'verify_phone'::character varying])::text[]))),
    CONSTRAINT otps_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_otps_expires_at ON public.otps USING btree (expires_at);

CREATE INDEX IF NOT EXISTS idx_otps_is_used ON public.otps USING btree (is_used);

CREATE INDEX IF NOT EXISTS idx_otps_otp_code ON public.otps USING btree (otp_code);

CREATE INDEX IF NOT EXISTS idx_otps_phone_number ON public.otps USING btree (phone_number);

-- ============================================================
-- Table: saved_addresses
-- ============================================================
CREATE TABLE IF NOT EXISTS saved_addresses (
    id SERIAL NOT NULL,
    user_id UUID NOT NULL,
    label VARCHAR(50) NOT NULL,
    type VARCHAR(10) DEFAULT 'other' NOT NULL,
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    address TEXT NOT NULL,
    landmark VARCHAR(255),
    place_id VARCHAR(255),
    is_default BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT saved_addresses_type_check CHECK (((type)::text = ANY ((ARRAY['home'::character varying, 'work'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT saved_addresses_pkey PRIMARY KEY (id),
    CONSTRAINT saved_addresses_user_id_type_label_key UNIQUE (user_id, type, label),
    CONSTRAINT saved_addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_saved_addresses_user_id ON public.saved_addresses USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_saved_addresses_user_type ON public.saved_addresses USING btree (user_id, type);

CREATE UNIQUE INDEX IF NOT EXISTS saved_addresses_user_id_type_label_key ON public.saved_addresses USING btree (user_id, type, label);

-- ============================================================
-- Table: notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL NOT NULL,
    user_id UUID NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    ride_id INTEGER,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT notifications_pkey PRIMARY KEY (id),
    CONSTRAINT notifications_ride_id_fkey FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE SET NULL,
    CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications USING btree (user_id, is_read);
