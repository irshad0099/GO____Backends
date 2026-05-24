-- ============================================================
-- Expand vehicle_type CHECK constraints
-- bike, auto, car  →  bike, auto, car, xl, premium, luxury
--
-- Reason: pricing_vehicle_config + pricing_convenience_fee me
-- already 6 types seeded hain (migration 009_pricing.sql),
-- par driver_vehicle / rides / scheduled_rides / incentive_plans
-- me constraint sirf 3 types allow karta tha → register hi nahi
-- ho pata tha xl/premium/luxury.
--
-- Idempotent — re-run safe
-- ============================================================

DO $$
DECLARE
    new_check TEXT := 'vehicle_type IN (''bike'', ''auto'', ''car'', ''xl'', ''premium'', ''luxury'')';
BEGIN
    -- ── driver_vehicle ───────────────────────────────────────────────────────
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'driver_vehicle_vehicle_type_check') THEN
        ALTER TABLE driver_vehicle DROP CONSTRAINT driver_vehicle_vehicle_type_check;
    END IF;
    EXECUTE 'ALTER TABLE driver_vehicle ADD CONSTRAINT driver_vehicle_vehicle_type_check CHECK (' || new_check || ')';

    -- ── rides ────────────────────────────────────────────────────────────────
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rides_vehicle_type_check') THEN
        ALTER TABLE rides DROP CONSTRAINT rides_vehicle_type_check;
    END IF;
    EXECUTE 'ALTER TABLE rides ADD CONSTRAINT rides_vehicle_type_check CHECK (' || new_check || ')';

    -- ── scheduled_rides ──────────────────────────────────────────────────────
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'scheduled_rides_vehicle_type_check') THEN
        ALTER TABLE scheduled_rides DROP CONSTRAINT scheduled_rides_vehicle_type_check;
    END IF;
    EXECUTE 'ALTER TABLE scheduled_rides ADD CONSTRAINT scheduled_rides_vehicle_type_check CHECK (' || new_check || ')';

    -- ── incentive_plans (vehicle_type NULL allowed = "all vehicles") ─────────
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'incentive_plans_vehicle_type_check') THEN
        ALTER TABLE incentive_plans DROP CONSTRAINT incentive_plans_vehicle_type_check;
    END IF;
    EXECUTE 'ALTER TABLE incentive_plans ADD CONSTRAINT incentive_plans_vehicle_type_check CHECK (vehicle_type IS NULL OR ' || new_check || ')';
END $$;
