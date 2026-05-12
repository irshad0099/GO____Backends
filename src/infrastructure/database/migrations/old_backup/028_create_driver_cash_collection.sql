-- ─────────────────────────────────────────────────────────────────────────────
-- DRIVER CASH COLLECTION / SETTLEMENT
--
-- Jab passenger cash mein pay karta hai:
--   - Driver ke paas company ka paisa hota hai (platform fee + commission)
--   - Driver ko wo paisa deposit karna hota hai
--   - Rapido mein: "Cash balance: Rs 450 — Deposit by Sunday"
--
-- 2 tables:
-- 1) driver_cash_balance — current pending cash (real-time balance)
-- 2) cash_deposits — jab driver deposit karta hai (UPI/bank transfer)
--
-- Flow:
--   1. Cash ride complete → driver_cash_balance mein platform_share add
--   2. Driver app pe dikhe: "Pending: Rs 450"
--   3. Driver UPI se company ko pay karta hai
--   4. POST /drivers/cash-deposit → balance kam ho jata hai
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── driver_cash_balance (real-time pending amount) ─────────────────────────
CREATE TABLE IF NOT EXISTS driver_cash_balance (
    id                      SERIAL PRIMARY KEY,
    driver_id               INTEGER         NOT NULL REFERENCES drivers(id) ON DELETE CASCADE UNIQUE,

    -- Total pending cash (company ka hissa jo driver ke paas hai)
    pending_amount          DECIMAL(10,2)   NOT NULL DEFAULT 0 CHECK (pending_amount >= 0),

    -- Lifetime stats
    total_cash_collected    DECIMAL(10,2)   NOT NULL DEFAULT 0,     -- total cash rides se aaya
    total_deposited         DECIMAL(10,2)   NOT NULL DEFAULT 0,     -- total deposited till now
    total_platform_share    DECIMAL(10,2)   NOT NULL DEFAULT 0,     -- company ka total hissa

    -- Deposit deadline (e.g. Sunday raat tak deposit karo)
    deposit_due_date        TIMESTAMP,

    -- Agar limit cross ho gayi to flag karo
    is_limit_exceeded       BOOLEAN         NOT NULL DEFAULT FALSE,
    cash_limit              DECIMAL(10,2)   NOT NULL DEFAULT 2000,  -- max pending allowed

    updated_at              TIMESTAMP       DEFAULT CURRENT_TIMESTAMP
);

-- ─── cash_deposits (deposit history) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cash_deposits (
    id                  SERIAL PRIMARY KEY,
    driver_id           INTEGER         NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,

    -- Deposit details
    amount              DECIMAL(10,2)   NOT NULL CHECK (amount > 0),

    -- Payment method (driver ne kaise deposit kiya)
    deposit_method      VARCHAR(20)     NOT NULL CHECK (deposit_method IN (
        'upi',          -- UPI transfer to company
        'bank_transfer',-- NEFT/IMPS
        'cash_center',  -- physical cash deposit center
        'auto_deduct'   -- system ne wallet se auto-deduct kiya
    )),

    -- Transaction reference
    reference_number    VARCHAR(100),       -- UPI ref / bank txn id
    deposit_proof       TEXT,               -- screenshot URL (S3)

    -- Status
    status              VARCHAR(20)     NOT NULL CHECK (status IN (
        'pending',      -- driver ne submit kiya, verify hona baaki
        'verified',     -- admin/system ne verify kiya
        'rejected'      -- proof galat hai ya amount mismatch
    )) DEFAULT 'pending',

    -- Verification
    verified_by         UUID            REFERENCES users(id),       -- admin
    verified_at         TIMESTAMP,
    rejection_reason    TEXT,

    created_at          TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP       DEFAULT CURRENT_TIMESTAMP
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
-- Driver ka cash balance (har ride complete pe update)
CREATE INDEX idx_driver_cash_balance_driver ON driver_cash_balance(driver_id);

-- Limit exceeded drivers (admin alert: inse paisa collect karo)
CREATE INDEX idx_driver_cash_limit_exceeded ON driver_cash_balance(is_limit_exceeded)
    WHERE is_limit_exceeded = TRUE;

-- Driver ke deposits list
CREATE INDEX idx_cash_deposits_driver ON cash_deposits(driver_id);

-- Pending verification (admin dashboard)
CREATE INDEX idx_cash_deposits_pending ON cash_deposits(status)
    WHERE status = 'pending';
