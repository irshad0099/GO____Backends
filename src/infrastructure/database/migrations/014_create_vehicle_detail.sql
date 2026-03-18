CREATE TABLE IF NOT EXISTS driver_vehicle (
    id SERIAL PRIMARY KEY,
    driver_id INTEGER UNIQUE NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,

    vehicle_type VARCHAR(50) NOT NULL CHECK (vehicle_type IN ('bike', 'auto', 'car')),
    vehicle_model VARCHAR(100),
    vehicle_color VARCHAR(50),

    -- RC Details
    rc_number VARCHAR(50) UNIQUE NOT NULL,
    vehicle_number VARCHAR(20) UNIQUE NOT NULL,
    owner_name VARCHAR(100) NOT NULL,
    rc_front TEXT NOT NULL,
    rc_back TEXT NOT NULL,

    -- Insurance Details
    policy_number VARCHAR(50),
    insurance_provider VARCHAR(100),
    insurance_front TEXT,
    insurance_back TEXT,
    insurance_valid_until DATE,

    -- Permit Details
    permit_number VARCHAR(50),
    permit_type VARCHAR(50),
    permit_document TEXT,
    permit_valid_until DATE,

    verification_status VARCHAR(20) DEFAULT 'pending'
    CHECK (verification_status IN ('pending','verified','rejected')),

    verified_at TIMESTAMP,
    rejected_reason TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_driver_vehicle_driver_id ON driver_vehicle(driver_id);