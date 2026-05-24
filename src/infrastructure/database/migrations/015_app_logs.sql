-- 059_app_logs.sql
-- Global application logging table for all events (api, socket, auth, database, etc.)

CREATE TABLE IF NOT EXISTS app_logs (
    id BIGSERIAL NOT NULL,
    level VARCHAR(20) NOT NULL,                    -- 'info', 'error', 'warn', 'debug'
    log_type VARCHAR(50) NOT NULL,                 -- 'api', 'socket', 'auth', 'database', 'business'
    message TEXT NOT NULL,
    module VARCHAR(100),                           -- 'rides', 'payments', 'auth', 'drivers', etc.
    event_name VARCHAR(100),                       -- API path, socket event, function name, etc.
    user_id UUID,
    driver_id INTEGER,
    ride_id INTEGER,
    status VARCHAR(20),                            -- 'success', 'error', 'pending', 'received', 'sent'
    metadata JSONB,                                -- All extra details (request, response, etc.)
    error_message TEXT,
    stack_trace TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT app_logs_pkey PRIMARY KEY (id),
    CONSTRAINT app_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT app_logs_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL,
    CONSTRAINT app_logs_ride_id_fkey FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_app_logs_created_at ON app_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_logs_level ON app_logs(level);
CREATE INDEX IF NOT EXISTS idx_app_logs_log_type ON app_logs(log_type);
CREATE INDEX IF NOT EXISTS idx_app_logs_module ON app_logs(module);
CREATE INDEX IF NOT EXISTS idx_app_logs_user_id ON app_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_app_logs_driver_id ON app_logs(driver_id);
CREATE INDEX IF NOT EXISTS idx_app_logs_ride_id ON app_logs(ride_id);
CREATE INDEX IF NOT EXISTS idx_app_logs_created_level ON app_logs(created_at DESC, level);
CREATE INDEX IF NOT EXISTS idx_app_logs_log_type_created ON app_logs(log_type, created_at DESC);
