CREATE TABLE IF NOT EXISTS driver_aadhaar (
    id SERIAL PRIMARY KEY,
    driver_id INTEGER UNIQUE NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,

    aadhaar_name VARCHAR(100) NOT NULL,
    aadhaar_number VARCHAR(12) UNIQUE NOT NULL,
    aadhaar_front TEXT NOT NULL,
    aadhaar_back TEXT NOT NULL,

    consent_given BOOLEAN DEFAULT FALSE,

    verification_status VARCHAR(20) DEFAULT 'pending'
    CHECK (verification_status IN ('pending','verified','rejected')),

    verified_at TIMESTAMP,
    rejected_reason TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_driver_aadhaar_driver_id ON driver_aadhaar(driver_id);