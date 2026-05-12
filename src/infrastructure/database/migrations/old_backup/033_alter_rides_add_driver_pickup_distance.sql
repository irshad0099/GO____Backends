-- ─────────────────────────────────────────────────────────────────────────────
-- ALTER RIDES TABLE — Add driver_pickup_distance_km
--
-- Driver jab ride accept kare tab uski current location se pickup point
-- ka actual distance save hoga. Driver earnings mein pickup compensation
-- is value pe depend karti hai.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE rides ADD COLUMN IF NOT EXISTS driver_pickup_distance_km DECIMAL(10,2) DEFAULT 0;
