-- ─────────────────────────────────────────────────────────────────────────────
-- SUBSCRIPTION SYSTEM — PostgreSQL Schema
-- Ola Pass / Uber One / Rapido Prime style
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── subscription_plans ───────────────────────────────────────────────────────
-- Master table — defines available plans (seeded by admin)
CREATE TABLE IF NOT EXISTS subscription_plans (
    id                  SERIAL PRIMARY KEY,
    name                VARCHAR(100)   NOT NULL,               -- 'Rapido Prime', 'Ola Pass'
    slug                VARCHAR(100)   NOT NULL UNIQUE,        -- 'rapido-prime', 'ola-pass'
    description         TEXT,
    price               DECIMAL(10,2)  NOT NULL,               -- ₹149, ₹299 etc.
    duration_days       INTEGER        NOT NULL,               -- 30, 90, 365
    ride_discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,     -- e.g. 10 = 10% off rides
    free_rides_per_month  INTEGER      NOT NULL DEFAULT 0,     -- e.g. 5 free rides/month
    priority_booking    BOOLEAN        NOT NULL DEFAULT FALSE, -- skip queue
    cancellation_waiver BOOLEAN        NOT NULL DEFAULT FALSE, -- no cancellation fee
    surge_protection    BOOLEAN        NOT NULL DEFAULT FALSE, -- no surge pricing
    is_active           BOOLEAN        NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP      DEFAULT CURRENT_TIMESTAMP
);

-- ─── user_subscriptions ───────────────────────────────────────────────────────
-- Tracks which user has which plan and its validity
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id                  SERIAL PRIMARY KEY,
    user_id             UUID           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id             INTEGER        NOT NULL REFERENCES subscription_plans(id),
    status              VARCHAR(20)    NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'expired', 'cancelled', 'pending')),
    started_at          TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at          TIMESTAMP      NOT NULL,
    cancelled_at        TIMESTAMP,
    cancel_reason       TEXT,
    auto_renew          BOOLEAN        NOT NULL DEFAULT TRUE,
    payment_method      VARCHAR(50)    CHECK (payment_method IN ('cash', 'card', 'wallet', 'upi')),
    transaction_id      INTEGER        REFERENCES transactions(id),
    free_rides_used     INTEGER        NOT NULL DEFAULT 0,      -- used this month
    free_rides_reset_at TIMESTAMP,                              -- when counter resets
    metadata            JSONB          DEFAULT '{}',
    created_at          TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP      DEFAULT CURRENT_TIMESTAMP
);

-- ─── subscription_payments ────────────────────────────────────────────────────
-- Full payment history for subscriptions
CREATE TABLE IF NOT EXISTS subscription_payments (
    id                      SERIAL PRIMARY KEY,
    user_id                 UUID           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id         INTEGER        NOT NULL REFERENCES user_subscriptions(id),
    plan_id                 INTEGER        NOT NULL REFERENCES subscription_plans(id),
    amount                  DECIMAL(10,2)  NOT NULL,
    payment_method          VARCHAR(50)    CHECK (payment_method IN ('cash', 'card', 'wallet', 'upi')),
    payment_gateway         VARCHAR(50),                        -- 'razorpay', 'stripe'
    gateway_transaction_id  VARCHAR(255),
    status                  VARCHAR(20)    NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'success', 'failed', 'refunded')),
    description             TEXT,
    metadata                JSONB          DEFAULT '{}',
    created_at              TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP      DEFAULT CURRENT_TIMESTAMP
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX idx_user_subscriptions_user_id   ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_status    ON user_subscriptions(status);
CREATE INDEX idx_user_subscriptions_expires   ON user_subscriptions(expires_at);
CREATE INDEX idx_sub_payments_user_id         ON subscription_payments(user_id);
CREATE INDEX idx_sub_payments_subscription_id ON subscription_payments(subscription_id);

-- ─── Seed: Default Plans ──────────────────────────────────────────────────────
INSERT INTO subscription_plans
    (name, slug, description, price, duration_days, ride_discount_percent, free_rides_per_month, priority_booking, cancellation_waiver, surge_protection)
VALUES
    ('Basic Pass',   'basic-pass',   'Save on every ride',              99.00,  30,  5,  0, FALSE, FALSE, FALSE),
    ('Prime Pass',   'prime-pass',   'Best value for daily commuters',  199.00, 30, 10,  5, TRUE,  TRUE,  FALSE),
    ('Elite Pass',   'elite-pass',   'Ultimate ride experience',        399.00, 30, 20, 10, TRUE,  TRUE,  TRUE),
    ('Annual Pass',  'annual-pass',  'Best price — pay once for a year',999.00, 365,15,  5, TRUE,  TRUE,  FALSE)
ON CONFLICT (slug) DO NOTHING;
