-- ─────────────────────────────────────────────────────────────────────────────
-- RIDER KYC — PostgreSQL Schema
-- Digital verification via Cashfree Verification Suite
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rider_kyc (
    id                      SERIAL PRIMARY KEY,
    user_id                 UUID            NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

    -- ─── Overall Status ────────────────────────────────────────────────────
    kyc_status              VARCHAR(20)     NOT NULL DEFAULT 'pending'
                                CHECK (kyc_status IN ('pending','in_progress','approved','rejected','manual_review')),

    -- ─── Aadhaar ──────────────────────────────────────────────────────────
    aadhaar_status          VARCHAR(20)     NOT NULL DEFAULT 'pending'
                                CHECK (aadhaar_status IN ('pending','otp_sent','verified','failed')),
    aadhaar_ref_id          VARCHAR(100),                           -- Cashfree ref_id for OTP flow
    aadhaar_name            VARCHAR(100),
    aadhaar_number_masked   VARCHAR(20),                            -- e.g. XXXX XXXX 3456
    aadhaar_dob             DATE,
    aadhaar_gender          VARCHAR(10),
    aadhaar_state           VARCHAR(60),
    aadhaar_attempts        INTEGER         NOT NULL DEFAULT 0,
    aadhaar_verified_at     TIMESTAMP,

    -- ─── PAN ──────────────────────────────────────────────────────────────
    pan_status              VARCHAR(20)     NOT NULL DEFAULT 'pending'
                                CHECK (pan_status IN ('pending','verified','failed')),
    pan_name                VARCHAR(100),
    pan_number_masked       VARCHAR(20),                            -- e.g. ABCXX1234X
    pan_dob                 DATE,
    pan_attempts            INTEGER         NOT NULL DEFAULT 0,
    pan_verified_at         TIMESTAMP,

    -- ─── Bank Account ─────────────────────────────────────────────────────
    bank_status             VARCHAR(20)     NOT NULL DEFAULT 'pending'
                                CHECK (bank_status IN ('pending','verified','failed')),
    bank_account_masked     VARCHAR(30),                            -- last 4 digits visible
    bank_ifsc               VARCHAR(20),
    bank_holder_name        VARCHAR(100),
    bank_name               VARCHAR(100),
    bank_verified_at        TIMESTAMP,

    -- ─── Selfie / Face Match ──────────────────────────────────────────────
    face_status             VARCHAR(20)     NOT NULL DEFAULT 'pending'
                                CHECK (face_status IN ('pending','verified','failed')),
    face_match_score        DECIMAL(5,2),                           -- 0–100
    face_verified_at        TIMESTAMP,

    -- ─── Manual Review ────────────────────────────────────────────────────
    -- Flagged automatically when rules trigger (name mismatch, low face score, underage)
    manual_review_reason    TEXT,
    reviewed_by             UUID            REFERENCES users(id),
    reviewed_at             TIMESTAMP,
    rejection_reason        TEXT,

    created_at              TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP       DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rider_kyc_user_id     ON rider_kyc(user_id);
CREATE INDEX idx_rider_kyc_status      ON rider_kyc(kyc_status);
CREATE INDEX idx_rider_kyc_manual      ON rider_kyc(kyc_status) WHERE kyc_status = 'manual_review';
