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
    event_name VARCHAR(100) NOT NULL,
    direction VARCHAR(3) NOT NULL,
    socket_id VARCHAR(100) NOT NULL,
    user_id UUID,
    driver_id INTEGER,
    ride_id INTEGER,
    request_payload JSONB,
    response_payload JSONB,
    status VARCHAR(20),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT socket_logs_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_socket_logs_created_at ON public.socket_logs USING btree (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_socket_logs_event_name ON public.socket_logs USING btree (event_name);

CREATE INDEX IF NOT EXISTS idx_socket_logs_direction ON public.socket_logs USING btree (direction);

CREATE INDEX IF NOT EXISTS idx_socket_logs_socket_id ON public.socket_logs USING btree (socket_id);

CREATE INDEX IF NOT EXISTS idx_socket_logs_user_id ON public.socket_logs USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_socket_logs_ride_id ON public.socket_logs USING btree (ride_id);

CREATE INDEX IF NOT EXISTS idx_socket_logs_driver_id ON public.socket_logs USING btree (driver_id);
