-- ─────────────────────────────────────────────────────────────────────────────
-- DRIVER DOCUMENT EXPIRY TRACKER
--
-- Yeh table driver ke saare documents ka expiry status ek jagah cache karta hai
-- Instead of 5 alag alag tables query karna (license, insurance, permit, etc.)
-- Ek hi query se pata chal jaye: kya expire ho raha, kya expired hai
--
-- Benefits:
--   - Cron job: daily check → expiring soon? notification bhejo
--   - Driver app pe: "Your license expires in 15 days" warning
--   - Admin dashboard: expired docs wale drivers list
--   - Expired doc → driver ko auto-offline karo (safety)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS driver_document_expiry (
    id                  SERIAL PRIMARY KEY,
    driver_id           INTEGER         NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,

    -- Document type
    document_type       VARCHAR(30)     NOT NULL CHECK (document_type IN (
        'license',          -- driving license
        'insurance',        -- vehicle insurance
        'permit',           -- commercial permit
        'rc',               -- registration certificate (fitness)
        'aadhaar',          -- aadhaar (no expiry, but verification)
        'pan'               -- PAN (no expiry, but verification)
    )),

    -- Document number (reference ke liye)
    document_number     VARCHAR(50),

    -- Expiry date (NULL for non-expiring docs like Aadhaar/PAN)
    expiry_date         DATE,

    -- Current status
    status              VARCHAR(20)     NOT NULL CHECK (status IN (
        'valid',            -- all good
        'expiring_soon',    -- 30 din mein expire hoga
        'expired',          -- expire ho chuka
        'not_uploaded',     -- document upload hi nahi kiya
        'rejected'          -- admin ne reject kiya
    )) DEFAULT 'not_uploaded',

    -- Notification bheja ya nahi (duplicate notification prevent karne ke liye)
    expiry_notified     BOOLEAN         NOT NULL DEFAULT FALSE,
    notified_at         TIMESTAMP,

    -- Last verification
    last_verified_at    TIMESTAMP,
    verified_by         UUID            REFERENCES users(id),

    created_at          TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,

    -- Ek driver ka ek document type ka ek hi entry
    UNIQUE (driver_id, document_type)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
-- Driver ke saare documents status (profile screen pe)
CREATE INDEX idx_doc_expiry_driver ON driver_document_expiry(driver_id);

-- Cron job: expiring soon wale (next 30 days mein expire hone wale)
CREATE INDEX idx_doc_expiry_soon ON driver_document_expiry(expiry_date, status)
    WHERE status IN ('valid', 'expiring_soon') AND expiry_date IS NOT NULL;

-- Admin dashboard: expired documents (action needed)
CREATE INDEX idx_doc_expiry_expired ON driver_document_expiry(status)
    WHERE status = 'expired';

-- Not uploaded (incomplete KYC wale drivers)
CREATE INDEX idx_doc_expiry_not_uploaded ON driver_document_expiry(status)
    WHERE status = 'not_uploaded';
