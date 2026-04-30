-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION: Add Razorpay subscription columns and update constraints
-- ─────────────────────────────────────────────────────────────────────────────

-- Add razorpay_subscription_id column to user_subscriptions
ALTER TABLE user_subscriptions
    ADD COLUMN IF NOT EXISTS razorpay_subscription_id VARCHAR(255);

-- Update payment_method constraint on user_subscriptions to include 'qr'
ALTER TABLE user_subscriptions
    DROP CONSTRAINT IF EXISTS user_subscriptions_payment_method_check;

ALTER TABLE user_subscriptions
    ADD CONSTRAINT user_subscriptions_payment_method_check
    CHECK (payment_method IN ('cash', 'card', 'wallet', 'upi', 'qr'));

-- Update payment_method constraint on subscription_payments to include 'qr'
ALTER TABLE subscription_payments
    DROP CONSTRAINT IF EXISTS subscription_payments_payment_method_check;

ALTER TABLE subscription_payments
    ADD CONSTRAINT subscription_payments_payment_method_check
    CHECK (payment_method IN ('cash', 'card', 'wallet', 'upi', 'qr'));
