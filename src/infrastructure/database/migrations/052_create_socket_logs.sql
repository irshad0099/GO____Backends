CREATE TABLE IF NOT EXISTS socket_logs (
    id BIGSERIAL PRIMARY KEY,
    level VARCHAR(10) NOT NULL,
    event VARCHAR(100),
    message TEXT NOT NULL,
    socket_id VARCHAR(100),
    user_id INTEGER,
    ride_id INTEGER,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_socket_logs_level ON socket_logs(level);
CREATE INDEX IF NOT EXISTS idx_socket_logs_user_id ON socket_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_socket_logs_ride_id ON socket_logs(ride_id);
CREATE INDEX IF NOT EXISTS idx_socket_logs_created_at ON socket_logs(created_at DESC);
