-- ─────────────────────────────────────────────────────────────────────────────
--  KYC legacy cleanup — drop old tables, strip cf_ columns from driver_vehicle
--  Run AFTER migration 044 is live and verified.
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop indexes added in 034 for old tables
DROP INDEX IF EXISTS idx_driver_license_cf_status;
DROP INDEX IF EXISTS idx_driver_vehicle_cf_status;
DROP INDEX IF EXISTS idx_driver_license_manual_review;
DROP INDEX IF EXISTS idx_driver_vehicle_manual_review;

-- Drop old KYC tables (CASCADE removes FKs automatically)
DROP TABLE IF EXISTS driver_aadhaar          CASCADE;
DROP TABLE IF EXISTS driver_pan              CASCADE;
DROP TABLE IF EXISTS driver_bank             CASCADE;
DROP TABLE IF EXISTS driver_license          CASCADE;
DROP TABLE IF EXISTS rider_kyc               CASCADE;
DROP TABLE IF EXISTS driver_document_expiry  CASCADE;

-- Strip Cashfree/digital-KYC columns from driver_vehicle (keep vehicle info)
ALTER TABLE driver_vehicle
    DROP COLUMN IF EXISTS cf_reference_id,
    DROP COLUMN IF EXISTS cf_verified_owner_name,
    DROP COLUMN IF EXISTS cf_verified_model,
    DROP COLUMN IF EXISTS cf_verified_fuel_type,
    DROP COLUMN IF EXISTS cf_registration_date,
    DROP COLUMN IF EXISTS cf_vehicle_class,
    DROP COLUMN IF EXISTS cf_status,
    DROP COLUMN IF EXISTS rc_attempts,
    DROP COLUMN IF EXISTS rc_verified_at,
    DROP COLUMN IF EXISTS rc_manual_review_reason;
