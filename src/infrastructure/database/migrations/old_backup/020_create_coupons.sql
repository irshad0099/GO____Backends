-- ─────────────────────────────────────────────────────────────────────────────
-- COUPONS / PROMO CODES
--
-- 2 tables:
-- 1) coupons — admin create karta hai promo codes (FIRST50, RIDE100, etc.)
-- 2) coupon_usages — track karta hai ki kisne kab use kiya
--
-- Discount types:
--   - percentage: 20% off (max_discount cap ke saath)
--   - flat: Rs 50 off
--
-- Conditions:
--   - min ride amount, specific vehicle types, first-ride-only, city-specific
--   - per-user usage limit, total usage limit, expiry date
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── coupons (master table — admin managed) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS coupons (
    id                  SERIAL PRIMARY KEY,

    -- Code jo user enter karega (uppercase, unique)
    code                VARCHAR(30)     NOT NULL UNIQUE,
    title               VARCHAR(100)    NOT NULL,       -- "Get 50% off your first ride!"
    description         TEXT,

    -- Discount type aur value
    discount_type       VARCHAR(10)     NOT NULL CHECK (discount_type IN ('percentage', 'flat')),
    discount_value      DECIMAL(10,2)   NOT NULL CHECK (discount_value > 0),
    max_discount        DECIMAL(10,2),                  -- percentage type mein cap (e.g. max Rs 100)

    -- Conditions
    min_ride_amount     DECIMAL(10,2)   DEFAULT 0,      -- minimum ride amount to apply
    vehicle_types       TEXT[]          DEFAULT '{bike,auto,car}',  -- kin vehicles pe valid hai
    first_ride_only     BOOLEAN         NOT NULL DEFAULT FALSE,     -- sirf new users ke liye

    -- Usage limits
    max_uses_total      INTEGER,                        -- total kitni baar use ho sakta hai (NULL = unlimited)
    max_uses_per_user   INTEGER         NOT NULL DEFAULT 1,         -- ek user kitni baar use kar sakta hai
    current_uses        INTEGER         NOT NULL DEFAULT 0,         -- counter — har use pe increment

    -- Validity period
    valid_from          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_until         TIMESTAMP       NOT NULL,

    -- Status
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,

    created_at          TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP       DEFAULT CURRENT_TIMESTAMP
);

-- ─── coupon_usages (tracking — kisne kab use kiya) ──────────────────────────
CREATE TABLE IF NOT EXISTS coupon_usages (
    id              SERIAL PRIMARY KEY,
    coupon_id       INTEGER         NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
    user_id         UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ride_id         INTEGER         REFERENCES rides(id) ON DELETE SET NULL,

    -- Kitna discount mila tha is usage mein
    discount_applied DECIMAL(10,2)  NOT NULL,
    ride_amount      DECIMAL(10,2)  NOT NULL,       -- original ride amount before discount

    used_at         TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,

    -- Ek user ek coupon ek ride pe sirf ek baar use kar sakta
    UNIQUE (coupon_id, user_id, ride_id)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
-- Code se coupon lookup (user ne code enter kiya → validate karo)
CREATE INDEX idx_coupons_code ON coupons(code);

-- Active + valid coupons list (available coupons screen pe)
CREATE INDEX idx_coupons_active_valid ON coupons(is_active, valid_until) WHERE is_active = TRUE;

-- User ke usage count check (per-user limit enforce karne ke liye)
CREATE INDEX idx_coupon_usages_user_coupon ON coupon_usages(user_id, coupon_id);

-- Ride se usage lookup
CREATE INDEX idx_coupon_usages_ride ON coupon_usages(ride_id);
