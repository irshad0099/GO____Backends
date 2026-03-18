ALTER TABLE drivers
    DROP COLUMN IF EXISTS vehicle_type,
    DROP COLUMN IF EXISTS vehicle_number,
    DROP COLUMN IF EXISTS vehicle_model,
    DROP COLUMN IF EXISTS vehicle_color,
    DROP COLUMN IF EXISTS license_number,
    DROP COLUMN IF EXISTS license_expiry;

ALTER TABLE driver_vehicle
    ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(50),
    ADD COLUMN IF NOT EXISTS vehicle_model VARCHAR(100),
    ADD COLUMN IF NOT EXISTS vehicle_color VARCHAR(50);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'driver_vehicle_vehicle_type_check'
    ) THEN
        ALTER TABLE driver_vehicle
            ADD CONSTRAINT driver_vehicle_vehicle_type_check
            CHECK (vehicle_type IN ('bike', 'auto', 'car'));
    END IF;
END$$;
