-- ─────────────────────────────────────────────────────────────────────────────
-- Add Driving License and Vehicle RC columns to rider_kyc
-- For riders who are also drivers (multi-modal users)
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Driving License ───────────────────────────────────────────────────────────
ALTER TABLE rider_kyc ADD COLUMN IF NOT EXISTS dl_status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (dl_status IN ('pending','verified','failed'));

ALTER TABLE rider_kyc ADD COLUMN IF NOT EXISTS dl_number_masked VARCHAR(30);
ALTER TABLE rider_kyc ADD COLUMN IF NOT EXISTS dl_verified_name VARCHAR(100);
ALTER TABLE rider_kyc ADD COLUMN IF NOT EXISTS dl_verified_dob DATE;
ALTER TABLE rider_kyc ADD COLUMN IF NOT EXISTS dl_issuing_authority VARCHAR(100);
ALTER TABLE rider_kyc ADD COLUMN IF NOT EXISTS dl_cf_reference_id VARCHAR(100);
ALTER TABLE rider_kyc ADD COLUMN IF NOT EXISTS dl_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE rider_kyc ADD COLUMN IF NOT EXISTS dl_verified_at TIMESTAMP;
ALTER TABLE rider_kyc ADD COLUMN IF NOT EXISTS dl_manual_review_reason TEXT;

-- ─── Vehicle RC ───────────────────────────────────────────────────────────────
ALTER TABLE rider_kyc ADD COLUMN IF NOT EXISTS rc_status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (rc_status IN ('pending','verified','failed'));

ALTER TABLE rider_kyc ADD COLUMN IF NOT EXISTS rc_number_masked VARCHAR(30);
ALTER TABLE rider_kyc ADD COLUMN IF NOT EXISTS rc_owner_name VARCHAR(100);
ALTER TABLE rider_kyc ADD COLUMN IF NOT EXISTS rc_vehicle_model VARCHAR(100);
ALTER TABLE rider_kyc ADD COLUMN IF NOT EXISTS rc_fuel_type VARCHAR(50);
ALTER TABLE rider_kyc ADD COLUMN IF NOT EXISTS rc_registration_date DATE;
ALTER TABLE rider_kyc ADD COLUMN IF NOT EXISTS rc_vehicle_class VARCHAR(50);
ALTER TABLE rider_kyc ADD COLUMN IF NOT EXISTS rc_cf_reference_id VARCHAR(100);
ALTER TABLE rider_kyc ADD COLUMN IF NOT EXISTS rc_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE rider_kyc ADD COLUMN IF NOT EXISTS rc_verified_at TIMESTAMP;
ALTER TABLE rider_kyc ADD COLUMN IF NOT EXISTS rc_manual_review_reason TEXT;

-- Create indexes for DL and RC lookups
CREATE INDEX IF NOT EXISTS idx_rider_kyc_dl_status ON rider_kyc(dl_status);
CREATE INDEX IF NOT EXISTS idx_rider_kyc_rc_status ON rider_kyc(rc_status);
