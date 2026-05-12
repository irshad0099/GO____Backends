-- 006_subscriptions_coupons.sql

-- Subscriptions & Coupons: subscription_plans, user_subscriptions, subscription_payments, coupons, coupon_usages, referrals, referral_codes

-- Generated from live DB schema


-- ============================================================
-- Table: subscription_plans
-- ============================================================
CREATE TABLE IF NOT EXISTS subscription_plans (
    id SERIAL NOT NULL,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    duration_days INTEGER NOT NULL,
    ride_discount_percent DECIMAL(5,2) DEFAULT 0 NOT NULL,
    free_rides_per_month INTEGER DEFAULT 0 NOT NULL,
    priority_booking BOOLEAN DEFAULT FALSE NOT NULL,
    cancellation_waiver BOOLEAN DEFAULT FALSE NOT NULL,
    surge_protection BOOLEAN DEFAULT FALSE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT subscription_plans_pkey PRIMARY KEY (id),
    CONSTRAINT subscription_plans_slug_key UNIQUE (slug)
);

CREATE UNIQUE INDEX IF NOT EXISTS subscription_plans_slug_key ON public.subscription_plans USING btree (slug);

-- ============================================================
-- Table: user_subscriptions
-- ============================================================
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id SERIAL NOT NULL,
    user_id UUID NOT NULL,
    plan_id INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'active' NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    cancelled_at TIMESTAMP,
    cancel_reason TEXT,
    auto_renew BOOLEAN DEFAULT TRUE NOT NULL,
    payment_method VARCHAR(50),
    transaction_id INTEGER,
    free_rides_used INTEGER DEFAULT 0 NOT NULL,
    free_rides_reset_at TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    razorpay_subscription_id VARCHAR(255),
    CONSTRAINT user_subscriptions_payment_method_check CHECK (((payment_method)::text = ANY ((ARRAY['cash'::character varying, 'card'::character varying, 'wallet'::character varying, 'upi'::character varying, 'qr'::character varying])::text[]))),
    CONSTRAINT user_subscriptions_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'expired'::character varying, 'cancelled'::character varying, 'pending'::character varying])::text[]))),
    CONSTRAINT user_subscriptions_pkey PRIMARY KEY (id),
    CONSTRAINT user_subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES subscription_plans(id),
    CONSTRAINT user_subscriptions_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES transactions(id),
    CONSTRAINT user_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_expires ON public.user_subscriptions USING btree (expires_at);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON public.user_subscriptions USING btree (status);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON public.user_subscriptions USING btree (user_id);

-- ============================================================
-- Table: subscription_payments
-- ============================================================
CREATE TABLE IF NOT EXISTS subscription_payments (
    id SERIAL NOT NULL,
    user_id UUID NOT NULL,
    subscription_id INTEGER NOT NULL,
    plan_id INTEGER NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50),
    payment_gateway VARCHAR(50),
    gateway_transaction_id VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT subscription_payments_payment_method_check CHECK (((payment_method)::text = ANY ((ARRAY['cash'::character varying, 'card'::character varying, 'wallet'::character varying, 'upi'::character varying, 'qr'::character varying])::text[]))),
    CONSTRAINT subscription_payments_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'success'::character varying, 'failed'::character varying, 'refunded'::character varying])::text[]))),
    CONSTRAINT subscription_payments_pkey PRIMARY KEY (id),
    CONSTRAINT subscription_payments_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES subscription_plans(id),
    CONSTRAINT subscription_payments_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES user_subscriptions(id),
    CONSTRAINT subscription_payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sub_payments_subscription_id ON public.subscription_payments USING btree (subscription_id);

CREATE INDEX IF NOT EXISTS idx_sub_payments_user_id ON public.subscription_payments USING btree (user_id);

-- ============================================================
-- Table: coupons
-- ============================================================
CREATE TABLE IF NOT EXISTS coupons (
    id SERIAL NOT NULL,
    code VARCHAR(30) NOT NULL,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    discount_type VARCHAR(10) NOT NULL,
    discount_value DECIMAL(10,2) NOT NULL,
    max_discount DECIMAL(10,2),
    min_ride_amount DECIMAL(10,2) DEFAULT 0,
    vehicle_types TEXT[] DEFAULT '{bike,auto,car}'::text[],
    first_ride_only BOOLEAN DEFAULT FALSE NOT NULL,
    max_uses_total INTEGER,
    max_uses_per_user INTEGER DEFAULT 1 NOT NULL,
    current_uses INTEGER DEFAULT 0 NOT NULL,
    valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    valid_until TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT coupons_discount_type_check CHECK (((discount_type)::text = ANY ((ARRAY['percentage'::character varying, 'flat'::character varying])::text[]))),
    CONSTRAINT coupons_discount_value_check CHECK ((discount_value > (0)::numeric)),
    CONSTRAINT coupons_pkey PRIMARY KEY (id),
    CONSTRAINT coupons_code_key UNIQUE (code)
);

CREATE UNIQUE INDEX IF NOT EXISTS coupons_code_key ON public.coupons USING btree (code);

CREATE INDEX IF NOT EXISTS idx_coupons_active_valid ON public.coupons USING btree (is_active, valid_until) WHERE (is_active = true);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON public.coupons USING btree (code);

-- ============================================================
-- Table: coupon_usages
-- ============================================================
CREATE TABLE IF NOT EXISTS coupon_usages (
    id SERIAL NOT NULL,
    coupon_id INTEGER NOT NULL,
    user_id UUID NOT NULL,
    ride_id INTEGER,
    discount_applied DECIMAL(10,2) NOT NULL,
    ride_amount DECIMAL(10,2) NOT NULL,
    used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT coupon_usages_pkey PRIMARY KEY (id),
    CONSTRAINT coupon_usages_coupon_id_user_id_ride_id_key UNIQUE (coupon_id, user_id, ride_id),
    CONSTRAINT coupon_usages_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
    CONSTRAINT coupon_usages_ride_id_fkey FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE SET NULL,
    CONSTRAINT coupon_usages_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS coupon_usages_coupon_id_user_id_ride_id_key ON public.coupon_usages USING btree (coupon_id, user_id, ride_id);

CREATE INDEX IF NOT EXISTS idx_coupon_usages_ride ON public.coupon_usages USING btree (ride_id);

CREATE INDEX IF NOT EXISTS idx_coupon_usages_user_coupon ON public.coupon_usages USING btree (user_id, coupon_id);

-- ============================================================
-- Table: referrals
-- ============================================================
CREATE TABLE IF NOT EXISTS referrals (
    id SERIAL NOT NULL,
    referrer_id UUID NOT NULL,
    referred_id UUID NOT NULL,
    referral_code VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    referrer_bonus DECIMAL(10,2) DEFAULT 0.00,
    referred_bonus DECIMAL(10,2) DEFAULT 0.00,
    completed_at TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT referrals_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'completed'::character varying, 'expired'::character varying])::text[]))),
    CONSTRAINT referrals_pkey PRIMARY KEY (id),
    CONSTRAINT referrals_referred_id_key UNIQUE (referred_id),
    CONSTRAINT referrals_referred_id_fkey FOREIGN KEY (referred_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT referrals_referrer_id_fkey FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_referrals_expires ON public.referrals USING btree (expires_at) WHERE ((status)::text = 'pending'::text);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals USING btree (referrer_id);

CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals USING btree (status) WHERE ((status)::text = 'pending'::text);

CREATE UNIQUE INDEX IF NOT EXISTS referrals_referred_id_key ON public.referrals USING btree (referred_id);

-- ============================================================
-- Table: referral_codes
-- ============================================================
CREATE TABLE IF NOT EXISTS referral_codes (
    id SERIAL NOT NULL,
    user_id UUID NOT NULL,
    code VARCHAR(20) NOT NULL,
    total_referrals INTEGER DEFAULT 0 NOT NULL,
    total_earned DECIMAL(10,2) DEFAULT 0.00 NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT referral_codes_pkey PRIMARY KEY (id),
    CONSTRAINT referral_codes_code_key UNIQUE (code),
    CONSTRAINT referral_codes_user_id_key UNIQUE (user_id),
    CONSTRAINT referral_codes_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON public.referral_codes USING btree (code);

CREATE INDEX IF NOT EXISTS idx_referral_codes_user ON public.referral_codes USING btree (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS referral_codes_code_key ON public.referral_codes USING btree (code);

CREATE UNIQUE INDEX IF NOT EXISTS referral_codes_user_id_key ON public.referral_codes USING btree (user_id);
