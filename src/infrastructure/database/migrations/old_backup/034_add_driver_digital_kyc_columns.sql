-- ─────────────────────────────────────────────────────────────────────────────
-- DRIVER DIGITAL KYC — Add Cashfree verification columns
-- Adds digital verification tracking to driver_license and driver_vehicle
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── driver_aadhaar ──────────────────────────────────────────────────────────
ALTER TABLE driver_aadhaar
    ADD COLUMN IF NOT EXISTS cf_reference_id    VARCHAR(100),
    ADD COLUMN IF NOT EXISTS aadhaar_dob        DATE,
    ADD COLUMN IF NOT EXISTS aadhaar_gender     VARCHAR(10),
    ADD COLUMN IF NOT EXISTS aadhaar_state      VARCHAR(60),
    ADD COLUMN IF NOT EXISTS aadhaar_attempts   INTEGER NOT NULL DEFAULT 0;

-- ─── driver_pan ───────────────────────────────────────────────────────────────
ALTER TABLE driver_pan
    ADD COLUMN IF NOT EXISTS cf_verified_name   VARCHAR(100),
    ADD COLUMN IF NOT EXISTS pan_attempts       INTEGER NOT NULL DEFAULT 0;

-- ─── driver_bank ──────────────────────────────────────────────────────────────
ALTER TABLE driver_bank
    ADD COLUMN IF NOT EXISTS cf_holder_name     VARCHAR(100),
    ADD COLUMN IF NOT EXISTS cf_bank_name       VARCHAR(100),
    ADD COLUMN IF NOT EXISTS bank_attempts      INTEGER NOT NULL DEFAULT 0;

-- ─── driver_license ──────────────────────────────────────────────────────────
ALTER TABLE driver_license
    ADD COLUMN IF NOT EXISTS cf_reference_id         VARCHAR(100),
    ADD COLUMN IF NOT EXISTS cf_verified_name        VARCHAR(100),
    ADD COLUMN IF NOT EXISTS cf_verified_dob         DATE,
    ADD COLUMN IF NOT EXISTS cf_issuing_authority    VARCHAR(150),
    ADD COLUMN IF NOT EXISTS cf_status               VARCHAR(20)
        CHECK (cf_status IN ('pending', 'verified', 'failed')),
    ADD COLUMN IF NOT EXISTS dl_attempts             INTEGER     NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS dl_verified_at          TIMESTAMP,
    ADD COLUMN IF NOT EXISTS dl_manual_review_reason TEXT;

-- ─── driver_vehicle ───────────────────────────────────────────────────────────
ALTER TABLE driver_vehicle
    ADD COLUMN IF NOT EXISTS cf_reference_id          VARCHAR(100),
    ADD COLUMN IF NOT EXISTS cf_verified_owner_name   VARCHAR(100),
    ADD COLUMN IF NOT EXISTS cf_verified_model        VARCHAR(100),
    ADD COLUMN IF NOT EXISTS cf_verified_fuel_type    VARCHAR(50),
    ADD COLUMN IF NOT EXISTS cf_registration_date     DATE,
    ADD COLUMN IF NOT EXISTS cf_vehicle_class         VARCHAR(100),
    ADD COLUMN IF NOT EXISTS cf_status                VARCHAR(20)
        CHECK (cf_status IN ('pending', 'verified', 'failed')),
    ADD COLUMN IF NOT EXISTS rc_attempts              INTEGER     NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS rc_verified_at           TIMESTAMP,
    ADD COLUMN IF NOT EXISTS rc_manual_review_reason  TEXT;

-- ─── Indexes for manual review admin dashboard ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_driver_license_cf_status
    ON driver_license(cf_status);

CREATE INDEX IF NOT EXISTS idx_driver_vehicle_cf_status
    ON driver_vehicle(cf_status);

CREATE INDEX IF NOT EXISTS idx_driver_license_manual_review
    ON driver_license(driver_id)
    WHERE dl_manual_review_reason IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_driver_vehicle_manual_review
    ON driver_vehicle(driver_id)
    WHERE rc_manual_review_reason IS NOT NULL;
