CREATE TABLE IF NOT EXISTS driver_license (
    id SERIAL PRIMARY KEY,
    driver_id INTEGER UNIQUE NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,

    license_number VARCHAR(50) UNIQUE NOT NULL,
    license_name VARCHAR(100) NOT NULL,
    license_dob DATE NOT NULL,

    license_issue_date DATE NOT NULL,
    license_expiry_date DATE NOT NULL,

    license_front TEXT NOT NULL,
    license_back TEXT NOT NULL,

    verification_status VARCHAR(20) DEFAULT 'pending'
    CHECK (verification_status IN ('pending','verified','rejected')),

    verified_at TIMESTAMP,
    rejected_reason TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_driver_license_driver_id ON driver_license(driver_id);