-- ─────────────────────────────────────────────────────────────────────────────
-- ALTER RIDES TABLE — Lock pricing fields at request time
--
-- convenience_fee aur is_peak request time pe lock honge taaki
-- final fare mein consistent values use ho sakein.
-- surge_protection aur subscription_discount bhi track karein.
-- ─────────────────────────────────────────────────────────────────────────────

-- Convenience fee locked at request time (same value used at completion)
ALTER TABLE rides ADD COLUMN IF NOT EXISTS convenience_fee DECIMAL(10,2) DEFAULT 0;

-- Peak flag locked at request time (time/demand/weather combined)
ALTER TABLE rides ADD COLUMN IF NOT EXISTS is_peak BOOLEAN DEFAULT FALSE;

-- Demand supply ratio at request time (for reference/analytics)
ALTER TABLE rides ADD COLUMN IF NOT EXISTS demand_supply_ratio DECIMAL(5,2) DEFAULT 1.0;

-- Subscription benefit applied (free ride / discount)
ALTER TABLE rides ADD COLUMN IF NOT EXISTS subscription_discount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS is_free_ride BOOLEAN DEFAULT FALSE;
