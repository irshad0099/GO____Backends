-- ============================================================
-- Global API Logs Table
-- Har request ka payload + response yahan store hoga
-- ============================================================

CREATE TABLE IF NOT EXISTS api_logs (
    id              BIGSERIAL PRIMARY KEY,
    module          VARCHAR(50)  NOT NULL DEFAULT 'unknown',  -- auth, users, rides, etc.
    method          VARCHAR(10)  NOT NULL,                    -- GET, POST, PUT, DELETE
    path            TEXT         NOT NULL,                    -- /api/v1/auth/signin
    status_code     INTEGER      NOT NULL,
    user_id         UUID,                                     -- NULL for unauthenticated requests
    ip_address      VARCHAR(50),
    user_agent      TEXT,
    request_body    JSONB        DEFAULT '{}',
    request_params  JSONB        DEFAULT '{}',
    request_query   JSONB        DEFAULT '{}',
    response_body   JSONB        DEFAULT '{}',
    duration_ms     INTEGER,                                  -- response time in ms
    is_error        BOOLEAN      NOT NULL DEFAULT FALSE,
    error_message   TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_api_logs_module       ON api_logs (module);
CREATE INDEX IF NOT EXISTS idx_api_logs_user_id      ON api_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_api_logs_status_code  ON api_logs (status_code);
CREATE INDEX IF NOT EXISTS idx_api_logs_is_error     ON api_logs (is_error);
CREATE INDEX IF NOT EXISTS idx_api_logs_created_at   ON api_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_logs_module_time  ON api_logs (module, created_at DESC);

-- ============================================================
-- Module-level Views (per module filtered queries)
-- ============================================================

CREATE OR REPLACE VIEW auth_logs          AS SELECT * FROM api_logs WHERE module = 'auth';
CREATE OR REPLACE VIEW users_logs         AS SELECT * FROM api_logs WHERE module = 'users';
CREATE OR REPLACE VIEW drivers_logs       AS SELECT * FROM api_logs WHERE module = 'drivers';
CREATE OR REPLACE VIEW rides_logs         AS SELECT * FROM api_logs WHERE module = 'rides';
CREATE OR REPLACE VIEW wallet_logs        AS SELECT * FROM api_logs WHERE module = 'wallet';
CREATE OR REPLACE VIEW subscriptions_logs AS SELECT * FROM api_logs WHERE module = 'subscriptions';
CREATE OR REPLACE VIEW payments_logs      AS SELECT * FROM api_logs WHERE module = 'payments';
CREATE OR REPLACE VIEW pricing_logs       AS SELECT * FROM api_logs WHERE module = 'pricing';
CREATE OR REPLACE VIEW reviews_logs       AS SELECT * FROM api_logs WHERE module = 'reviews';
CREATE OR REPLACE VIEW sos_logs           AS SELECT * FROM api_logs WHERE module = 'sos';
CREATE OR REPLACE VIEW coupons_logs       AS SELECT * FROM api_logs WHERE module = 'coupons';
CREATE OR REPLACE VIEW support_logs       AS SELECT * FROM api_logs WHERE module = 'support';
CREATE OR REPLACE VIEW kyc_logs           AS SELECT * FROM api_logs WHERE module = 'kyc';
CREATE OR REPLACE VIEW drivers_kyc_logs   AS SELECT * FROM api_logs WHERE module = 'driver-kyc';
CREATE OR REPLACE VIEW admin_logs         AS SELECT * FROM api_logs WHERE module = 'admin';
CREATE OR REPLACE VIEW error_logs         AS SELECT * FROM api_logs WHERE is_error = TRUE ORDER BY created_at DESC;
