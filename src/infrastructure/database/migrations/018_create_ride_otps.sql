-- ─────────────────────────────────────────────────────────────────────────────
-- RIDE OTP — Safety Verification
-- Jab driver arrive karta hai, passenger ko 4-digit OTP milta hai
-- Driver wo OTP enter karega tabhi ride start hogi
-- Rapido/Ola/Uber sab mein hai — rider safety ke liye must-have
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ride_otps (
    id              SERIAL PRIMARY KEY,
    ride_id         INTEGER         NOT NULL REFERENCES rides(id) ON DELETE CASCADE,

    -- 4-digit OTP (hashed store karna better hai production mein)
    otp_code        VARCHAR(10)     NOT NULL,

    -- Kitni baar galat OTP daala — 3 attempts ke baad block
    attempts        INTEGER         NOT NULL DEFAULT 0,
    max_attempts    INTEGER         NOT NULL DEFAULT 3,

    -- OTP verified hua ya nahi
    is_verified     BOOLEAN         NOT NULL DEFAULT FALSE,
    verified_at     TIMESTAMP,

    -- OTP expiry — 10 min ke baad expire, naya generate hoga
    expires_at      TIMESTAMP       NOT NULL,

    created_at      TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,

    -- Ek ride ke liye latest OTP hi active rehna chahiye
    -- Purana expire ho gaya to naya generate hoga, lekin uniqueness ride + otp combo pe
    UNIQUE (ride_id, otp_code)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
-- Ride se OTP fast lookup (driver ne OTP enter kiya → verify karo)
CREATE INDEX idx_ride_otps_ride_id ON ride_otps(ride_id);

-- Expired OTP cleanup job ke liye
CREATE INDEX idx_ride_otps_expires ON ride_otps(expires_at) WHERE is_verified = FALSE;
