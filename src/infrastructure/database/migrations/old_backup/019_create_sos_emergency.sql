-- ─────────────────────────────────────────────────────────────────────────────
-- EMERGENCY CONTACTS + SOS ALERTS
--
-- 2 tables:
-- 1) emergency_contacts — user ke saved emergency contacts (max 5)
-- 2) sos_alerts — jab SOS button press hota hai, alert log hota hai
--
-- Rapido/Ola mein ride ke dauran SOS press karte ho to:
--   - Emergency contacts ko SMS + live location jaata hai
--   - Backend pe log hota hai (admin dashboard pe dikhe)
--   - Optionally police ko bhi alert ja sakta hai
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── emergency_contacts ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS emergency_contacts (
    id              SERIAL PRIMARY KEY,
    user_id         UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    name            VARCHAR(100)    NOT NULL,
    phone           VARCHAR(15)     NOT NULL,
    relationship    VARCHAR(50),            -- e.g. "Father", "Friend", "Wife"

    -- Max 5 contacts per user (app level pe bhi enforce karna)
    created_at      TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,

    -- Ek user ke paas same phone number duplicate nahi hona chahiye
    UNIQUE (user_id, phone)
);

-- ─── sos_alerts ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sos_alerts (
    id              SERIAL PRIMARY KEY,
    ride_id         INTEGER         NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
    triggered_by    UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- SOS ke time location snapshot (exact jagah jahan user tha)
    latitude        DECIMAL(10,8)   NOT NULL,
    longitude       DECIMAL(11,8)   NOT NULL,

    -- Kya action liya gaya
    status          VARCHAR(20)     NOT NULL CHECK (status IN (
        'triggered',        -- SOS press hua
        'contacts_notified',-- SMS/notification bhej diya contacts ko
        'admin_reviewed',   -- Admin ne dekha
        'resolved',         -- Issue resolve ho gaya
        'false_alarm'       -- Galti se press hua (user ne cancel kiya)
    )) DEFAULT 'triggered',

    -- Admin notes (resolve karte waqt kya hua)
    admin_notes     TEXT,
    resolved_by     UUID            REFERENCES users(id),       -- Admin user ID
    resolved_at     TIMESTAMP,

    triggered_at    TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    created_at      TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       DEFAULT CURRENT_TIMESTAMP
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
-- User ke emergency contacts list
CREATE INDEX idx_emergency_contacts_user ON emergency_contacts(user_id);

-- Ride se SOS lookup
CREATE INDEX idx_sos_alerts_ride ON sos_alerts(ride_id);

-- Admin dashboard: pending SOS alerts
CREATE INDEX idx_sos_alerts_status ON sos_alerts(status) WHERE status != 'resolved';

-- User ke SOS history
CREATE INDEX idx_sos_alerts_user ON sos_alerts(triggered_by);
