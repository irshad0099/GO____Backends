-- ─────────────────────────────────────────────────────────────────────────────
-- EXTEND rides.payment_status VALUES
-- Adding: 'paid', 'collected_by_driver'
--
-- Why: rideCompletionWorker sets 'paid' (wallet/UPI/card) and
--      'collected_by_driver' (cash) — original CHECK only allowed 'completed'.
-- ─────────────────────────────────────────────────────────────────────────────

-- Normalize any existing 'completed' values to 'paid'
UPDATE rides
SET payment_status = 'paid'
WHERE payment_status = 'completed';

ALTER TABLE rides
    DROP CONSTRAINT IF EXISTS rides_payment_status_check;

ALTER TABLE rides
    ADD CONSTRAINT rides_payment_status_check
    CHECK (payment_status IN (
        'pending',              -- abhi paid nahi hua
        'paid',                 -- wallet/UPI/card se settle ho gaya
        'collected_by_driver',  -- cash — driver ne hath mein le liya
        'failed',               -- payment attempt fail
        'refunded'              -- refund ho gaya
    ));
