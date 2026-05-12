-- Per-ride cash collection records
-- Jab driver "Collect Cash" tap karta hai tab ek record banta hai
-- driver_cash_balance mein aggregate hota hai, yahan per-ride detail rehti hai

CREATE TABLE IF NOT EXISTS cash_collections (
    id                  SERIAL PRIMARY KEY,
    ride_id             INTEGER         NOT NULL REFERENCES rides(id) ON DELETE CASCADE UNIQUE,
    driver_id           INTEGER         NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    passenger_id        UUID            NOT NULL REFERENCES users(id),

    final_fare          DECIMAL(10,2)   NOT NULL CHECK (final_fare > 0),
    platform_fee        DECIMAL(10,2)   NOT NULL DEFAULT 0 CHECK (platform_fee >= 0),
    net_earnings        DECIMAL(10,2)   NOT NULL DEFAULT 0 CHECK (net_earnings >= 0),

    collection_method   VARCHAR(20)     NOT NULL CHECK (collection_method IN ('cash', 'personal_upi')),
    status              VARCHAR(20)     NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'disputed', 'settled')),

    created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cash_collections_driver  ON cash_collections(driver_id);
CREATE INDEX IF NOT EXISTS idx_cash_collections_ride    ON cash_collections(ride_id);
CREATE INDEX IF NOT EXISTS idx_cash_collections_created ON cash_collections(created_at DESC);
