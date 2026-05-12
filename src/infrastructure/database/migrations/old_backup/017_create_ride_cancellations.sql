-- ─────────────────────────────────────────────────────────────────────────────
-- RIDE CANCELLATIONS — Passenger + Driver dono cancel kar sakte hain
-- rides table mein sirf status change hota hai, yahan detailed log rehta hai
-- Penalty calculation, refund eligibility, analytics sab isi se hoga
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ride_cancellations (
    id                  SERIAL PRIMARY KEY,
    ride_id             INTEGER         NOT NULL REFERENCES rides(id) ON DELETE CASCADE UNIQUE,
    cancelled_by_user   UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Kisne cancel kiya — passenger/driver/system (auto-expire)
    cancelled_by_role   VARCHAR(20)     NOT NULL CHECK (cancelled_by_role IN ('passenger', 'driver', 'system')),

    -- Predefined reasons + custom text for analytics
    reason_code         VARCHAR(50)     NOT NULL CHECK (reason_code IN (
        'driver_too_far',           -- passenger: driver bohot door hai
        'changed_plan',             -- passenger: plan badal gaya
        'found_another_ride',       -- passenger: doosri ride mil gayi
        'driver_asked_to_cancel',   -- passenger: driver ne bola cancel karo
        'wrong_pickup',             -- passenger: galat pickup daal diya
        'long_wait',                -- passenger: driver aa nahi raha
        'personal_emergency',       -- dono: emergency aa gayi
        'rider_not_at_pickup',      -- driver: passenger pickup pe nahi mila
        'wrong_route',              -- driver: route issue
        'vehicle_issue',            -- driver: gaadi kharab ho gayi
        'rider_misbehavior',        -- driver: passenger ka behavior kharab
        'system_timeout',           -- system: koi driver accept nahi kiya
        'other'                     -- custom reason
    )),
    reason_text         TEXT,           -- Optional custom explanation

    -- Cancellation ke time driver kitna door tha (penalty calc ke liye)
    driver_distance_meters  INTEGER     DEFAULT 0,

    -- Penalty lagi ya nahi
    penalty_applied     BOOLEAN         NOT NULL DEFAULT FALSE,
    penalty_amount      DECIMAL(10,2)   DEFAULT 0.00,

    -- Penalty ka split — driver ko kitna, platform ko kitna
    driver_share        DECIMAL(10,2)   DEFAULT 0.00,
    platform_share      DECIMAL(10,2)   DEFAULT 0.00,

    -- Ride kis stage pe cancel hui — analytics ke liye important
    ride_status_at_cancel VARCHAR(50)   NOT NULL CHECK (ride_status_at_cancel IN (
        'requested', 'driver_assigned', 'driver_arrived', 'in_progress'
    )),

    cancelled_at        TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    created_at          TIMESTAMP       DEFAULT CURRENT_TIMESTAMP
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
-- Ride se cancellation lookup (1:1 mapping)
CREATE INDEX idx_ride_cancellations_ride_id ON ride_cancellations(ride_id);

-- User ke cancellation history (penalty patterns dekhne ke liye)
CREATE INDEX idx_ride_cancellations_user ON ride_cancellations(cancelled_by_user);

-- Analytics: kis reason se sabse zyada cancel ho raha
CREATE INDEX idx_ride_cancellations_reason ON ride_cancellations(reason_code);

-- Time-based analytics (daily/weekly cancel trends)
CREATE INDEX idx_ride_cancellations_time ON ride_cancellations(cancelled_at);
