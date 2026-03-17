CREATE TABLE IF NOT EXISTS driver_pan (
    id SERIAL PRIMARY KEY,
    driver_id INTEGER UNIQUE NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,

    pan_name VARCHAR(100) NOT NULL,
    pan_number VARCHAR(20) UNIQUE NOT NULL,
    pan_dob DATE NOT NULL,
    pan_front TEXT NOT NULL,

    verification_status VARCHAR(20) DEFAULT 'pending'
    CHECK (verification_status IN ('pending','verified','rejected')),

    verified_at TIMESTAMP,
    rejected_reason TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_driver_pan_driver_id ON driver_pan(driver_id);