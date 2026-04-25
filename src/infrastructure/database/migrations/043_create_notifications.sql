CREATE TABLE IF NOT EXISTS notifications (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type          VARCHAR(50) NOT NULL,
    title         VARCHAR(255) NOT NULL,
    body          TEXT NOT NULL,
    is_read       BOOLEAN DEFAULT FALSE,
    ride_id       INTEGER REFERENCES rides(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read);
