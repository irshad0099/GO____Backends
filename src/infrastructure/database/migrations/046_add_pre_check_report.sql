-- Add pre_check_report to driver_kyc_status
-- Stores cross-document verification results for admin visibility
ALTER TABLE driver_kyc_status
    ADD COLUMN IF NOT EXISTS pre_check_report JSONB;
