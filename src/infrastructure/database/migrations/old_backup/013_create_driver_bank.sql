CREATE TABLE IF NOT EXISTS driver_bank (
    id SERIAL PRIMARY KEY,
    driver_id INTEGER UNIQUE NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,

    account_holder_name VARCHAR(100) NOT NULL,
    account_number VARCHAR(30) NOT NULL,
    ifsc_code VARCHAR(20) NOT NULL,

    account_type VARCHAR(10)
    CHECK (account_type IN ('saving','current')),

    bank_proof_document TEXT,

    verification_status VARCHAR(20) DEFAULT 'pending'
    CHECK (verification_status IN ('pending','verified','rejected')),

    verified_at TIMESTAMP,
    rejected_reason TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_driver_bank_driver_id ON driver_bank(driver_id);