-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION: Add payment tracking columns to rides table
-- ─────────────────────────────────────────────────────────────────────────────

-- Add payment_collected_at column for cash payment tracking
ALTER TABLE rides
    ADD COLUMN IF NOT EXISTS payment_collected_at TIMESTAMP;

-- Add payment_confirmed_at column for payment confirmation tracking
ALTER TABLE rides
    ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMP;

-- Update payment_method check constraint to include qr
ALTER TABLE rides
    DROP CONSTRAINT IF EXISTS rides_payment_method_check;

ALTER TABLE rides
    ADD CONSTRAINT rides_payment_method_check
    CHECK (payment_method IN ('cash', 'card', 'wallet', 'upi', 'qr'));

-- Update payment_status check constraint to include cash payment statuses
-- First, update any invalid payment_status values to 'pending'
UPDATE rides
SET payment_status = 'pending'
WHERE payment_status NOT IN ('pending', 'completed', 'failed', 'refunded', 'cash_collected', 'cash_confirmed')
  AND payment_status IS NOT NULL;

ALTER TABLE rides
    DROP CONSTRAINT IF EXISTS rides_payment_status_check;

ALTER TABLE rides
    ADD CONSTRAINT rides_payment_status_check
    CHECK (payment_status IN (
        'pending', 'completed', 'failed', 'refunded',
        'cash_collected', 'cash_confirmed'
    ));
