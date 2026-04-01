-- ─────────────────────────────────────────────────────────────────────────────
-- SCHEDULED RIDES — "Book for Later"
-- Passenger advance mein ride book kar sakta hai
--
-- Flow:
--   1. Passenger pickup_time select karta hai (min 30 min ahead, max 7 days)
--   2. System scheduled_rides mein entry create karta hai
--   3. Cron job: pickup_time se 15 min pehle → auto-trigger ride request
--   4. Normal ride flow start hota hai (driver matching, accept, etc.)
--
-- Agar koi driver nahi mila → passenger ko notification + status = failed
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scheduled_rides (
    id                  SERIAL PRIMARY KEY,
    passenger_id        UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Pickup details
    pickup_latitude     DECIMAL(10,8)   NOT NULL,
    pickup_longitude    DECIMAL(11,8)   NOT NULL,
    pickup_address      TEXT            NOT NULL,
    pickup_location_name VARCHAR(255),

    -- Dropoff details
    dropoff_latitude    DECIMAL(10,8)   NOT NULL,
    dropoff_longitude   DECIMAL(11,8)   NOT NULL,
    dropoff_address     TEXT            NOT NULL,
    dropoff_location_name VARCHAR(255),

    -- Ride preferences
    vehicle_type        VARCHAR(50)     NOT NULL CHECK (vehicle_type IN ('bike', 'auto', 'car')),
    payment_method      VARCHAR(50)     CHECK (payment_method IN ('cash', 'card', 'wallet', 'upi')) DEFAULT 'cash',

    -- Scheduled time (future timestamp)
    pickup_time         TIMESTAMP       NOT NULL,

    -- Estimated fare snapshot (booking time pe jo estimate tha)
    estimated_fare      DECIMAL(10,2),

    -- Status flow
    status              VARCHAR(20)     NOT NULL CHECK (status IN (
        'scheduled',    -- abhi queue mein hai, wait kar raha hai
        'triggered',    -- cron ne ride request trigger kar diya
        'ride_created', -- ride create ho gayi, driver dhundh raha
        'completed',    -- ride successfully complete hui
        'cancelled',    -- passenger ne cancel kiya before trigger
        'failed'        -- koi driver nahi mila after trigger
    )) DEFAULT 'scheduled',

    -- Jab trigger hua to actual ride ka reference
    ride_id             INTEGER         REFERENCES rides(id) ON DELETE SET NULL,

    -- Cancellation
    cancelled_at        TIMESTAMP,
    cancel_reason       TEXT,

    created_at          TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP       DEFAULT CURRENT_TIMESTAMP
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
-- Passenger ke upcoming scheduled rides
CREATE INDEX idx_scheduled_rides_passenger ON scheduled_rides(passenger_id);

-- Cron job: pickup_time aane wala hai, trigger karna hai
-- Sirf 'scheduled' status wale check karne hain
CREATE INDEX idx_scheduled_rides_trigger ON scheduled_rides(pickup_time, status)
    WHERE status = 'scheduled';

-- Status based filter
CREATE INDEX idx_scheduled_rides_status ON scheduled_rides(status);
