-- 010_infra.sql

-- Infrastructure: api_logs, socket_logs

-- Generated from live DB schema


-- ============================================================
-- Table: api_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS api_logs (
    id BIGSERIAL NOT NULL,
    module VARCHAR(50) DEFAULT 'unknown' NOT NULL,
    method VARCHAR(10) NOT NULL,
    path TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    user_id UUID,
    ip_address VARCHAR(50),
    user_agent TEXT,
    request_body JSONB DEFAULT '{}',
    request_params JSONB DEFAULT '{}',
    request_query JSONB DEFAULT '{}',
    response_body JSONB DEFAULT '{}',
    duration_ms INTEGER,
    is_error BOOLEAN DEFAULT FALSE NOT NULL,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT api_logs_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_api_logs_created_at ON public.api_logs USING btree (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_logs_is_error ON public.api_logs USING btree (is_error);

CREATE INDEX IF NOT EXISTS idx_api_logs_module ON public.api_logs USING btree (module);

CREATE INDEX IF NOT EXISTS idx_api_logs_module_time ON public.api_logs USING btree (module, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_logs_status_code ON public.api_logs USING btree (status_code);

CREATE INDEX IF NOT EXISTS idx_api_logs_user_id ON public.api_logs USING btree (user_id);

-- ============================================================
-- Table: socket_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS socket_logs (
    id BIGSERIAL NOT NULL,
    level VARCHAR(10) NOT NULL,
    event VARCHAR(100),
    message TEXT NOT NULL,
    socket_id VARCHAR(100),
    user_id INTEGER,
    ride_id INTEGER,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    direction VARCHAR(3),
    CONSTRAINT socket_logs_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_socket_logs_created_at ON public.socket_logs USING btree (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_socket_logs_level ON public.socket_logs USING btree (level);

CREATE INDEX IF NOT EXISTS idx_socket_logs_ride_id ON public.socket_logs USING btree (ride_id);

CREATE INDEX IF NOT EXISTS idx_socket_logs_user_id ON public.socket_logs USING btree (user_id);
