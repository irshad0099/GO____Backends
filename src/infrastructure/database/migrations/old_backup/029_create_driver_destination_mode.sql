-- ─────────────────────────────────────────────────────────────────────────────
-- DRIVER DESTINATION MODE — "Going Home" Filter
--
-- Driver set karta hai: "Main Andheri ja raha hoon"
-- System sirf wahi rides dikhata hai jo usi direction mein hain
-- Rapido/Uber mein hai — drivers love this feature
--
-- Flow:
--   1. Driver sets destination (lat, lng, address)
--   2. System ride matching mein direction filter lagata hai
--   3. Auto-expire after X hours ya destination reach pe
--   4. Max 2 uses per day (to prevent abuse)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS driver_destination_mode (
    id                  SERIAL PRIMARY KEY,
    driver_id           INTEGER         NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,

    -- Destination details
    dest_latitude       DECIMAL(10,8)   NOT NULL,
    dest_longitude      DECIMAL(11,8)   NOT NULL,
    dest_address        TEXT            NOT NULL,

    -- Tolerance radius (km) — kitna door tak ki rides accept karein
    radius_km           DECIMAL(5,2)    NOT NULL DEFAULT 3.0,

    -- Active/expired
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,

    -- Auto-expire (max 2 hours ya destination reach pe)
    expires_at          TIMESTAMP       NOT NULL,

    -- Usage count for the day (max 2 per day)
    used_date           DATE            NOT NULL DEFAULT CURRENT_DATE,

    deactivated_at      TIMESTAMP,
    deactivation_reason VARCHAR(30)     CHECK (deactivation_reason IN (
        'manual',           -- driver ne khud off kiya
        'expired',          -- time expire ho gaya
        'destination_reached', -- destination pe pahuch gaya
        'ride_completed'    -- destination direction wali ride complete hui
    )),

    created_at          TIMESTAMP       DEFAULT CURRENT_TIMESTAMP
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
-- Driver ka active destination mode check (ride matching ke time)
CREATE INDEX idx_dest_mode_active ON driver_destination_mode(driver_id, is_active)
    WHERE is_active = TRUE;

-- Daily usage count check (max 2 per day enforce karne ke liye)
CREATE INDEX idx_dest_mode_daily ON driver_destination_mode(driver_id, used_date);

-- Expired modes cleanup (cron job)
CREATE INDEX idx_dest_mode_expires ON driver_destination_mode(expires_at)
    WHERE is_active = TRUE;
