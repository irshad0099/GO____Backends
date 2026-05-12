-- 005_kyc.sql

-- KYC domain: driver_kyc_status, kyc_documents, kyc_audit_log, kyc_fraud_flags

-- Generated from live DB schema


-- ============================================================
-- Table: driver_kyc_status
-- ============================================================
CREATE TABLE IF NOT EXISTS driver_kyc_status (
    user_id UUID NOT NULL,
    overall_status VARCHAR(20) DEFAULT 'not_started' NOT NULL,
    submitted_docs_count INTEGER DEFAULT 0,
    verified_docs_count INTEGER DEFAULT 0,
    last_activity_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    suspended_at TIMESTAMPTZ,
    suspension_reason TEXT,
    pre_check_report JSONB,
    CONSTRAINT driver_kyc_status_pkey PRIMARY KEY (user_id),
    CONSTRAINT driver_kyc_status_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
-- Table: kyc_documents
-- ============================================================
CREATE TABLE IF NOT EXISTS kyc_documents (
    id SERIAL NOT NULL,
    user_id UUID NOT NULL,
    document_type VARCHAR(30) NOT NULL,
    method VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    extracted_data JSONB,
    confidence_score INTEGER,
    fraud_score INTEGER DEFAULT 0,
    document_number VARCHAR(50),
    document_hash VARCHAR(64),
    file_url TEXT,
    rejection_reason TEXT,
    attempt_count INTEGER DEFAULT 1,
    reviewed_by UUID,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT kyc_documents_pkey PRIMARY KEY (id),
    CONSTRAINT kyc_documents_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES users(id),
    CONSTRAINT kyc_documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_kyc_review_queue ON public.kyc_documents USING btree (status, created_at) WHERE ((status)::text = 'manual_review'::text);

CREATE INDEX IF NOT EXISTS idx_kyc_user_status ON public.kyc_documents USING btree (user_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS ux_kyc_doc_type_hash ON public.kyc_documents USING btree (document_type, document_hash) WHERE (document_hash IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS ux_kyc_user_doc_type ON public.kyc_documents USING btree (user_id, document_type);

-- ============================================================
-- Table: kyc_audit_log
-- ============================================================
CREATE TABLE IF NOT EXISTS kyc_audit_log (
    id SERIAL NOT NULL,
    user_id UUID,
    document_id INTEGER,
    action VARCHAR(40) NOT NULL,
    actor_type VARCHAR(20),
    actor_id UUID,
    before_state JSONB,
    after_state JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT kyc_audit_log_pkey PRIMARY KEY (id)
);

-- ============================================================
-- Table: kyc_fraud_flags
-- ============================================================
CREATE TABLE IF NOT EXISTS kyc_fraud_flags (
    id SERIAL NOT NULL,
    document_id INTEGER NOT NULL,
    flag_type VARCHAR(40) NOT NULL,
    severity VARCHAR(10) NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT kyc_fraud_flags_pkey PRIMARY KEY (id),
    CONSTRAINT kyc_fraud_flags_document_id_fkey FOREIGN KEY (document_id) REFERENCES kyc_documents(id) ON DELETE CASCADE
);
