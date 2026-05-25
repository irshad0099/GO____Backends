-- ============================================================
-- Add live-tracking support to rides
--
-- Adds tracking_token + tracking_enabled columns on rides,
-- and creates ride_location_history for per-ride GPS pings.
--
-- Used by src/modules/tracking/* (TrackingService /
-- TrackingRepository). Without these the
-- generateTrackingToken UPDATE blows up at runtime.
--
-- Idempotent — re-run safe.
-- ============================================================

ALTER TABLE rides
    ADD COLUMN IF NOT EXISTS tracking_token   VARCHAR(50) UNIQUE,
    ADD COLUMN IF NOT EXISTS tracking_enabled BOOLEAN DEFAULT true;

CREATE TABLE IF NOT EXISTS ride_location_history (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id    UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
    latitude   DECIMAL(10, 8) NOT NULL,
    longitude  DECIMAL(10, 8) NOT NULL,
    accuracy   FLOAT,
    timestamp  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ride_location_history_ride_id   ON ride_location_history(ride_id);
CREATE INDEX IF NOT EXISTS idx_ride_location_history_timestamp ON ride_location_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_rides_tracking_token            ON rides(tracking_token);
