-- ─────────────────────────────────────────────────────────────────────────────
--  KYC v2 — single pipeline tables
--  Replaces: rider_kyc, driver_aadhaar/pan/bank/license, driver_document_expiry
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kyc_documents (
    id               SERIAL PRIMARY KEY,
    user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_type    VARCHAR(30)  NOT NULL,
                     -- AADHAAR | PAN | DRIVING_LICENCE | VEHICLE_RC | BANK_ACCOUNT | SELFIE
    method           VARCHAR(20)  NOT NULL,
                     -- OCR | PENNY_DROP | FACE_MATCH
    status           VARCHAR(20)  NOT NULL DEFAULT 'pending',
                     -- pending | auto_verified | manual_review | approved | rejected
    extracted_data   JSONB,
    confidence_score INTEGER,
    fraud_score      INTEGER      DEFAULT 0,
    document_number  VARCHAR(50),
    document_hash    VARCHAR(64),
    file_url         TEXT,
    rejection_reason TEXT,
    attempt_count    INTEGER      DEFAULT 1,
    reviewed_by      UUID         REFERENCES users(id),
    created_at       TIMESTAMPTZ  DEFAULT NOW(),
    verified_at      TIMESTAMPTZ,
    updated_at       TIMESTAMPTZ  DEFAULT NOW()
);

-- Prevent same Aadhaar/PAN/DL/RC being registered to two drivers
CREATE UNIQUE INDEX IF NOT EXISTS ux_kyc_doc_type_hash
    ON kyc_documents(document_type, document_hash)
    WHERE document_hash IS NOT NULL;

-- One active record per user per document type
CREATE UNIQUE INDEX IF NOT EXISTS ux_kyc_user_doc_type
    ON kyc_documents(user_id, document_type);

CREATE INDEX IF NOT EXISTS idx_kyc_user_status
    ON kyc_documents(user_id, status);

CREATE INDEX IF NOT EXISTS idx_kyc_review_queue
    ON kyc_documents(status, created_at)
    WHERE status = 'manual_review';

-- ─────────────────────────────────────────────────────────────────────────────
--  Driver-level aggregate (single-row read on every login)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS driver_kyc_status (
    user_id              UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    overall_status       VARCHAR(20) NOT NULL DEFAULT 'not_started',
                         -- not_started | in_progress | pending_review | verified | rejected | suspended
    submitted_docs_count INTEGER     DEFAULT 0,
    verified_docs_count  INTEGER     DEFAULT 0,
    last_activity_at     TIMESTAMPTZ,
    verified_at          TIMESTAMPTZ,
    suspended_at         TIMESTAMPTZ,
    suspension_reason    TEXT
);

-- ─────────────────────────────────────────────────────────────────────────────
--  Fraud flags (append-only)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kyc_fraud_flags (
    id          SERIAL PRIMARY KEY,
    document_id INTEGER     NOT NULL REFERENCES kyc_documents(id) ON DELETE CASCADE,
    flag_type   VARCHAR(40) NOT NULL,
                -- DUPLICATE_NUMBER | NAME_MISMATCH | VELOCITY | TEMPLATE_TAMPERING
                -- | FACE_MISMATCH | EXPIRED_DOC | LOW_CONFIDENCE | CROSS_DOC_MISMATCH
    severity    VARCHAR(10) NOT NULL,   -- LOW | MEDIUM | HIGH
    details     JSONB,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
--  Audit log (append-only, regulator-friendly)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kyc_audit_log (
    id           SERIAL PRIMARY KEY,
    user_id      UUID,
    document_id  INTEGER,
    action       VARCHAR(40) NOT NULL,
                 -- SUBMITTED | AUTO_VERIFIED | MANUAL_REVIEW_ASSIGNED
                 -- | APPROVED | REJECTED | SUSPENDED | FRAUD_FLAGGED | RETRIED
    actor_type   VARCHAR(20),   -- driver | admin | system
    actor_id     UUID,
    before_state JSONB,
    after_state  JSONB,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);
