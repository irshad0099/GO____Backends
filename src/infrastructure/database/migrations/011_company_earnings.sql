-- 011_company_earnings.sql
-- Company platform fee tracking + Razorpay payout requests

-- ============================================================
-- Table: company_earnings
-- One row per ride — tracks what platform earned
-- ============================================================
CREATE TABLE IF NOT EXISTS company_earnings (
    id              SERIAL PRIMARY KEY,
    ride_id         INTEGER NOT NULL UNIQUE REFERENCES rides(id) ON DELETE CASCADE,
    driver_id       INTEGER NOT NULL REFERENCES drivers(id),
    passenger_id    UUID    NOT NULL REFERENCES users(id),
    payment_method  VARCHAR(20) NOT NULL,   -- cash | wallet | upi_qr
    gross_fare      DECIMAL(10,2) NOT NULL, -- what passenger paid
    platform_fee    DECIMAL(10,2) NOT NULL, -- company ka cut
    gst_on_fee      DECIMAL(10,2) DEFAULT 0,
    net_to_driver   DECIMAL(10,2) NOT NULL, -- driver ka net
    status          VARCHAR(20)  DEFAULT 'earned'
                    CHECK (status IN ('earned','settled','held')),
    -- cash rides pe paise driver ke paas hain — 'held' until deposited
    -- wallet/upi rides pe 'earned' (paisa already company Razorpay mein)
    settled_at      TIMESTAMP,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_company_earnings_ride     ON company_earnings(ride_id);
CREATE INDEX IF NOT EXISTS idx_company_earnings_status   ON company_earnings(status);
CREATE INDEX IF NOT EXISTS idx_company_earnings_date     ON company_earnings(created_at DESC);

-- ============================================================
-- Table: payout_requests
-- Driver withdrawal requests — processed via Razorpay Payout
-- ============================================================
CREATE TABLE IF NOT EXISTS payout_requests (
    id                  SERIAL PRIMARY KEY,
    driver_user_id      UUID    NOT NULL REFERENCES users(id),
    amount              DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    bank_account_number VARCHAR(20),
    ifsc_code           VARCHAR(11),
    upi_id              VARCHAR(100),
    payout_method       VARCHAR(20) NOT NULL CHECK (payout_method IN ('bank','upi')),
    razorpay_payout_id  VARCHAR(100),
    status              VARCHAR(20) DEFAULT 'pending'
                        CHECK (status IN ('pending','processing','success','failed')),
    failure_reason      TEXT,
    initiated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at        TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payout_requests_driver  ON payout_requests(driver_user_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status  ON payout_requests(status);
