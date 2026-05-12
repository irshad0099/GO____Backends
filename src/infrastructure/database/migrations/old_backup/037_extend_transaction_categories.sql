-- ─────────────────────────────────────────────────────────────────────────────
-- EXTEND TRANSACTION CATEGORIES
-- Adding: 'ride_earnings', 'subscription', 'driver_incentive', 'tip'
--
-- Why: creditDriverEarnings() uses 'ride_earnings', subscription wallet debit
--      needs 'subscription'. Original CHECK constraint didn't include these.
-- ─────────────────────────────────────────────────────────────────────────────

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
        'tip'
    ));
