-- ─────────────────────────────────────────────────────────────────────────────
-- REFERRAL SYSTEM
--
-- 2 tables:
-- 1) referral_codes — har user ka unique referral code
-- 2) referrals — track: kisne kisko refer kiya, status kya hai
--
-- Flow:
--   1. User A signup karta hai → auto-generate referral code (e.g. AKASH7X)
--   2. User A share karta hai code friend ko
--   3. User B signup karta hai + code enter karta hai
--   4. User B first ride complete karta hai → dono ko bonus milta hai
--
-- Wallet mein already referral_bonus category hai — yahan sirf tracking hai
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── referral_codes (har user ka unique code) ───────────────────────────────
CREATE TABLE IF NOT EXISTS referral_codes (
    id              SERIAL PRIMARY KEY,
    user_id         UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,

    -- Unique referral code (6-8 chars, alphanumeric)
    code            VARCHAR(20)     NOT NULL UNIQUE,

    -- Kitne log refer kiye successfully
    total_referrals INTEGER         NOT NULL DEFAULT 0,

    -- Total bonus earned from referrals
    total_earned    DECIMAL(10,2)   NOT NULL DEFAULT 0.00,

    -- Active hai ya admin ne disable kiya (abuse prevention)
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,

    created_at      TIMESTAMP       DEFAULT CURRENT_TIMESTAMP
);

-- ─── referrals (individual referral tracking) ───────────────────────────────
CREATE TABLE IF NOT EXISTS referrals (
    id              SERIAL PRIMARY KEY,

    -- Kisne refer kiya (referrer)
    referrer_id     UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Kisko refer kiya (referred user)
    referred_id     UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Kis code se aaya
    referral_code   VARCHAR(20)     NOT NULL,

    -- Status flow: pending → completed (after first ride) ya expired
    status          VARCHAR(20)     NOT NULL CHECK (status IN (
        'pending',      -- code apply hua, first ride abhi nahi hui
        'completed',    -- first ride complete — bonus credited
        'expired'       -- 30 din mein first ride nahi hui → expire
    )) DEFAULT 'pending',

    -- Bonus amounts (configurable — abhi ENV se aata hai)
    referrer_bonus  DECIMAL(10,2)   DEFAULT 0.00,   -- jisne refer kiya usko
    referred_bonus  DECIMAL(10,2)   DEFAULT 0.00,   -- jo naya aaya usko

    -- Kab bonus credit hua
    completed_at    TIMESTAMP,

    -- Expiry (30 days from signup — agar first ride nahi hui to expire)
    expires_at      TIMESTAMP       NOT NULL,

    created_at      TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,

    -- Ek user ek hi baar refer ho sakta hai
    UNIQUE (referred_id)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
-- Code se lookup (signup screen pe code validate karna)
CREATE INDEX idx_referral_codes_code ON referral_codes(code);

-- User ka referral code fetch
CREATE INDEX idx_referral_codes_user ON referral_codes(user_id);

-- Referrer ke saare referrals (history screen)
CREATE INDEX idx_referrals_referrer ON referrals(referrer_id);

-- Pending referrals check (cron job: first ride complete hone pe bonus do)
CREATE INDEX idx_referrals_status ON referrals(status) WHERE status = 'pending';

-- Expiry check (cron job: expire karo old pending referrals)
CREATE INDEX idx_referrals_expires ON referrals(expires_at) WHERE status = 'pending';
