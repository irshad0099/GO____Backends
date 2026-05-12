-- Driver location bounding-box index
-- findNearbyDrivers query mein full table scan hoti thi
-- Yeh index bounding-box pre-filter enable karta hai — 10x+ speedup on large driver tables

CREATE INDEX IF NOT EXISTS idx_drivers_location_available
    ON drivers (current_latitude, current_longitude)
    WHERE is_available = true AND is_verified = true AND current_latitude IS NOT NULL;

-- Rides table pe Haversine queries ke liye partial index
CREATE INDEX IF NOT EXISTS idx_rides_pickup_location
    ON rides (pickup_latitude, pickup_longitude)
    WHERE status = 'requested';

-- Rides surge detection queries ke liye composite index
CREATE INDEX IF NOT EXISTS idx_rides_surge_lookup
    ON rides (vehicle_type, status, requested_at);
