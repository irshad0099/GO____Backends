-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION: Add QR payment method to payment_orders table
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop existing constraint
ALTER TABLE payment_orders
    DROP CONSTRAINT IF EXISTS payment_orders_payment_method_check;

-- Add updated constraint with 'qr' as valid payment method
ALTER TABLE payment_orders
    ADD CONSTRAINT payment_orders_payment_method_check
    CHECK (payment_method IN ('cash', 'card', 'wallet', 'upi', 'qr'));
