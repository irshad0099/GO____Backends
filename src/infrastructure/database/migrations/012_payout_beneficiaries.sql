-- ============================================================
-- Cashfree Payouts — Clean schema
-- ============================================================

-- Driver ka Cashfree beneficiary (bank account ka mapping)
-- Ek driver ka bank change ho sakta hai → multiple records possible
-- Lookup hamesha (driver_user_id + bank_account_number + bank_ifsc) se hoti hai
CREATE TABLE IF NOT EXISTS payout_beneficiaries (
    id                  SERIAL PRIMARY KEY,
    driver_user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    beneficiary_id      VARCHAR(100) NOT NULL UNIQUE,   -- Cashfree beneficiary ID (DRIVER_xxx_timestamp)
    beneficiary_name    VARCHAR(100) NOT NULL,          -- Cashfree-verified bank holder name
    bank_account_number VARCHAR(20)  NOT NULL,
    bank_ifsc           VARCHAR(11)  NOT NULL,
    beneficiary_status  VARCHAR(20)  DEFAULT 'VERIFIED',
    created_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payout_beneficiaries_driver
    ON payout_beneficiaries(driver_user_id);

CREATE INDEX IF NOT EXISTS idx_payout_beneficiaries_driver_bank
    ON payout_beneficiaries(driver_user_id, bank_account_number, bank_ifsc);

-- ============================================================
-- payout_requests cleanup — Razorpay legacy → Cashfree
-- (idempotent — re-runnable)
-- ============================================================

-- Rename razorpay_payout_id → transfer_id (only if old column exists & new doesn't)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'payout_requests' AND column_name = 'razorpay_payout_id')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'payout_requests' AND column_name = 'transfer_id')
    THEN
        ALTER TABLE payout_requests RENAME COLUMN razorpay_payout_id TO transfer_id;
    END IF;
END $$;

-- If neither old nor new exists, just add the new one
ALTER TABLE payout_requests ADD COLUMN IF NOT EXISTS transfer_id    VARCHAR(100);
ALTER TABLE payout_requests ADD COLUMN IF NOT EXISTS cf_transfer_id VARCHAR(100);
ALTER TABLE payout_requests ADD COLUMN IF NOT EXISTS beneficiary_id VARCHAR(100);

-- UPI hata diya — sirf bank transfers
ALTER TABLE payout_requests DROP COLUMN IF EXISTS upi_id;

-- payout_method constraint relax karo (old constraint UPI ko enforce karta tha)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payout_requests_payout_method_check') THEN
        ALTER TABLE payout_requests DROP CONSTRAINT payout_requests_payout_method_check;
    END IF;
    ALTER TABLE payout_requests
        ADD CONSTRAINT payout_requests_payout_method_check CHECK (payout_method = 'bank');
END $$;

-- Webhook lookup ke liye index (transfer_id se search hota hai)
CREATE INDEX IF NOT EXISTS idx_payout_requests_transfer_id
    ON payout_requests(transfer_id);
