-- ─────────────────────────────────────────────────────────────────────────────
-- PAYOUT FLEXIBILITY  (QR payment + "driver direct collect" button + corporate billing)
--
-- Passenger-facing methods (4):
--   wallet       — Go Wallet
--   upi          — UPI / card (SDK or app intent)
--   cash         — Cash in hand (driver may actually receive via his personal UPI —
--                  audited in `collection_method_actual`, but payment_method stays 'cash')
--   corporate    — Corporate billing (company pays monthly; passenger not charged)
--
-- Internal-only (audit / gateway routing):
--   upi_qr       — Razorpay Dynamic QR flavour of 'upi'; persisted separately so
--                  webhook routing can find the right order
--   personal_upi — NEVER on payment_method. Only on rides.collection_method_actual
--                  to record how driver physically received the cash.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. rides.payment_method ─────────────────────────────────────────────────
ALTER TABLE rides
    DROP CONSTRAINT IF EXISTS rides_payment_method_check;

ALTER TABLE rides
    ADD CONSTRAINT rides_payment_method_check
    CHECK (payment_method IN (
        'cash',
        'card',
        'wallet',
        'upi',
        'upi_qr',      -- internal: Razorpay dynamic QR flavour
        'corporate'    -- corporate billing (no immediate settlement)
    ));

-- ─── 2. transactions.payment_method ──────────────────────────────────────────
ALTER TABLE transactions
    DROP CONSTRAINT IF EXISTS transactions_payment_method_check;

ALTER TABLE transactions
    ADD CONSTRAINT transactions_payment_method_check
    CHECK (payment_method IN (
        'cash',
        'card',
        'wallet',
        'upi',
        'upi_qr',
        'corporate'
    ));

-- ─── 3. transactions.category — add commission_due + corporate_billing ───────
ALTER TABLE transactions
    DROP CONSTRAINT IF EXISTS transactions_category_check;

ALTER TABLE transactions
    ADD CONSTRAINT transactions_category_check
    CHECK (category IN (
        'ride_payment',
        'ride_refund',
        'ride_earnings',
        'wallet_recharge',
        'referral_bonus',
        'cancellation_fee',
        'withdrawal',
        'subscription',
        'driver_incentive',
        'tip',
        'commission_due',     -- driver owes platform (direct cash collection)
        'corporate_billing'   -- corporate company ledger entry (owed by company)
    ));

-- ─── 4. rides.payment_status — add billed_corporate ──────────────────────────
ALTER TABLE rides
    DROP CONSTRAINT IF EXISTS rides_payment_status_check;

ALTER TABLE rides
    ADD CONSTRAINT rides_payment_status_check
    CHECK (payment_status IN (
        'pending',
        'paid',
        'collected_by_driver',
        'billed_corporate',    -- corporate monthly invoice cycle
        'failed',
        'refunded'
    ));

-- ─── 5. rides — audit columns for direct collection + commission lock ───────
-- collection_method_actual allows 'cash' | 'personal_upi' (driver's own UPI)
ALTER TABLE rides
    ADD COLUMN IF NOT EXISTS collection_confirmed_at      TIMESTAMP,
    ADD COLUMN IF NOT EXISTS collection_method_actual     VARCHAR(20),
    ADD COLUMN IF NOT EXISTS platform_share               DECIMAL(10,2) DEFAULT 0;

ALTER TABLE rides
    DROP CONSTRAINT IF EXISTS rides_collection_method_actual_check;
ALTER TABLE rides
    ADD CONSTRAINT rides_collection_method_actual_check
    CHECK (collection_method_actual IS NULL OR collection_method_actual IN (
        'cash', 'personal_upi'
    ));

COMMENT ON COLUMN rides.collection_confirmed_at
    IS 'Driver ne collect-confirm button kab daba (direct cash/personal_upi)';
COMMENT ON COLUMN rides.collection_method_actual
    IS 'Driver-side detail: cash (physical) OR personal_upi (driver apni UPI se liya). UI pe passenger ko "cash" hi dikha.';
COMMENT ON COLUMN rides.platform_share
    IS 'Platform commission locked at ride-completion. Used by cash-balance + corporate billing.';
