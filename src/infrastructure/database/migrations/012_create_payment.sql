-- ─────────────────────────────────────────────────────────────────────────────
-- PAYMENTS SYSTEM — PostgreSQL Schema
-- Ola / Uber / Rapido style
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── payment_orders ───────────────────────────────────────────────────────────
-- Created BEFORE payment gateway call — tracks the intent
CREATE TABLE IF NOT EXISTS payment_orders (
    id                      SERIAL PRIMARY KEY,
    order_number            VARCHAR(60)     NOT NULL UNIQUE,    -- PAY20240101XXXX
    user_id                 INTEGER         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ride_id                 INTEGER         REFERENCES rides(id),
    amount                  DECIMAL(10,2)   NOT NULL CHECK (amount > 0),
    currency                VARCHAR(5)      NOT NULL DEFAULT 'INR',

    -- What this payment is for
    purpose                 VARCHAR(50)     NOT NULL
                                CHECK (purpose IN (
                                    'ride_payment',
                                    'wallet_recharge',
                                    'subscription',
                                    'cancellation_fee',
                                    'tip'
                                )),

    payment_method          VARCHAR(20)
                                CHECK (payment_method IN ('cash', 'card', 'wallet', 'upi')),

    -- Gateway details (Razorpay / Stripe)
    payment_gateway         VARCHAR(50),                        -- 'razorpay', 'stripe'
    gateway_order_id        VARCHAR(255),                       -- from gateway (before payment)
    gateway_payment_id      VARCHAR(255),                       -- from gateway (after payment)
    gateway_signature       VARCHAR(500),                       -- webhook signature verify

    status                  VARCHAR(20)     NOT NULL DEFAULT 'created'
                                CHECK (status IN (
                                    'created',      -- order made, awaiting payment
                                    'attempted',    -- user on payment screen
                                    'success',      -- payment confirmed
                                    'failed',       -- payment failed
                                    'refunded',     -- full refund processed
                                    'partially_refunded',
                                    'cancelled'
                                )),

    failure_reason          TEXT,
    description             TEXT,
    metadata                JSONB           DEFAULT '{}',
    expires_at              TIMESTAMP,                          -- order expiry (15 min)
    paid_at                 TIMESTAMP,
    created_at              TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP       DEFAULT CURRENT_TIMESTAMP
);

-- ─── payment_refunds ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_refunds (
    id                      SERIAL PRIMARY KEY,
    refund_number           VARCHAR(60)     NOT NULL UNIQUE,    -- REF20240101XXXX
    payment_order_id        INTEGER         NOT NULL REFERENCES payment_orders(id),
    user_id                 INTEGER         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ride_id                 INTEGER         REFERENCES rides(id),
    amount                  DECIMAL(10,2)   NOT NULL CHECK (amount > 0),
    reason                  VARCHAR(500),

    status                  VARCHAR(20)     NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'success', 'failed')),

    refund_method           VARCHAR(20)
                                CHECK (refund_method IN ('source', 'wallet')),  -- back to card or to wallet

    gateway_refund_id       VARCHAR(255),
    processed_at            TIMESTAMP,
    metadata                JSONB           DEFAULT '{}',
    created_at              TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP       DEFAULT CURRENT_TIMESTAMP
);

-- ─── saved_payment_methods ────────────────────────────────────────────────────
-- Tokenized cards / UPI IDs saved by user (like Ola's saved cards)
CREATE TABLE IF NOT EXISTS saved_payment_methods (
    id                      SERIAL PRIMARY KEY,
    user_id                 INTEGER         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type                    VARCHAR(20)     NOT NULL
                                CHECK (type IN ('card', 'upi', 'netbanking')),
    -- Card details (masked)
    card_last4              VARCHAR(4),
    card_brand              VARCHAR(20),    -- 'visa', 'mastercard', 'rupay'
    card_exp_month          INTEGER,
    card_exp_year           INTEGER,
    -- UPI
    upi_id                  VARCHAR(100),
    -- Gateway token (never store raw card)
    gateway_token           VARCHAR(500)    NOT NULL,
    gateway_customer_id     VARCHAR(255),
    payment_gateway         VARCHAR(50),
    is_default              BOOLEAN         NOT NULL DEFAULT FALSE,
    is_active               BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP       DEFAULT CURRENT_TIMESTAMP
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX idx_payment_orders_user_id    ON payment_orders(user_id);
CREATE INDEX idx_payment_orders_ride_id    ON payment_orders(ride_id);
CREATE INDEX idx_payment_orders_status     ON payment_orders(status);
CREATE INDEX idx_payment_orders_number     ON payment_orders(order_number);
CREATE INDEX idx_payment_orders_gateway    ON payment_orders(gateway_order_id);
CREATE INDEX idx_payment_refunds_order_id  ON payment_refunds(payment_order_id);
CREATE INDEX idx_payment_refunds_user_id   ON payment_refunds(user_id);
CREATE INDEX idx_saved_methods_user_id     ON saved_payment_methods(user_id);
