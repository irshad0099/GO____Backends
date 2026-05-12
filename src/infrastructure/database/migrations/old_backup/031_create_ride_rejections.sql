-- ─────────────────────────────────────────────────────────────────────────────
-- RIDE REJECTIONS — Driver ne ride skip/reject kiya
--
-- Jab ride request aati hai, driver accept ya reject karta hai
-- Rejection track karna important hai:
--   - Acceptance rate calculate hota hai (penalty ke liye)
--   - Analytics: kyun reject ho rahi rides
--   - Next driver ko quickly forward karne ke liye
--
-- Flow:
--   1. Ride request → driver ko notification
--   2. Driver rejects → log yahan + next driver ko forward
--   3. Agar sab reject karein → ride expired
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ride_rejections (
    id              SERIAL PRIMARY KEY,
    ride_id         INTEGER         NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
    driver_id       INTEGER         NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,

    -- Reason code (quick analytics ke liye)
    reason_code     VARCHAR(30)     NOT NULL CHECK (reason_code IN (
        'too_far',          -- pickup bohot door hai
        'wrong_direction',  -- meri direction mein nahi
        'low_fare',         -- fare kam hai
        'bad_area',         -- area mein nahi jaana
        'busy',             -- abhi busy hoon
        'ending_shift',     -- shift khatam ho rahi
        'timeout',          -- response time expire (auto-reject)
        'other'
    )),
    reason_text     TEXT,           -- optional custom explanation

    -- Kya auto-reject hua (timeout se) ya manually
    is_auto_reject  BOOLEAN         NOT NULL DEFAULT FALSE,

    rejected_at     TIMESTAMP       DEFAULT CURRENT_TIMESTAMP
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
-- Ride pe kitne drivers ne reject kiya
CREATE INDEX idx_ride_rejections_ride ON ride_rejections(ride_id);

-- Driver ka rejection history (acceptance rate ke liye)
CREATE INDEX idx_ride_rejections_driver ON ride_rejections(driver_id);

-- Time-based: recent rejection trends
CREATE INDEX idx_ride_rejections_time ON ride_rejections(rejected_at);

-- Reason analytics
CREATE INDEX idx_ride_rejections_reason ON ride_rejections(reason_code);

-- Driver + time combo (acceptance rate calculate: last 7 days mein kitne accept/reject)
CREATE INDEX idx_ride_rejections_driver_time ON ride_rejections(driver_id, rejected_at DESC);
