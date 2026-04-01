-- ─────────────────────────────────────────────────────────────────────────────
-- DRIVER PENALTIES / WARNINGS
--
-- Rapido/Ola mein driver ko penalty milti hai agar:
--   - Bohot zyada rides reject/cancel kare
--   - Passenger complaint aaye (rude behavior, unsafe driving)
--   - Fake rides kare
--   - Rating consistently low rahe
--
-- Penalty types:
--   - warning: sirf notification (first time)
--   - fine: wallet se paisa kat jayega
--   - temporary_ban: X hours/days ke liye offline
--   - permanent_ban: account deactivate
--
-- Points system: har offense ke points hain, threshold cross → escalate
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS driver_penalties (
    id                  SERIAL PRIMARY KEY,
    driver_id           INTEGER         NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,

    -- Kya hua tha
    offense_type        VARCHAR(30)     NOT NULL CHECK (offense_type IN (
        'high_cancellation',    -- bohot zyada cancel kiya
        'low_acceptance',       -- rides accept nahi karta
        'passenger_complaint',  -- passenger ne complaint kiya
        'safety_violation',     -- unsafe driving, SOS triggered
        'fake_ride',            -- fake ride create ki
        'low_rating',           -- rating threshold se neeche gayi
        'document_expired',     -- document expire ho gaya
        'fraud',                -- fraud activity
        'other'
    )),

    -- Kya action liya
    penalty_type        VARCHAR(20)     NOT NULL CHECK (penalty_type IN (
        'warning',          -- sirf warning notification
        'fine',             -- wallet se paisa kat jayega
        'temporary_ban',    -- X hours offline
        'permanent_ban'     -- account deactivate
    )),

    -- Fine amount (penalty_type = fine ke liye)
    fine_amount         DECIMAL(10,2)   DEFAULT 0,
    fine_deducted       BOOLEAN         NOT NULL DEFAULT FALSE,

    -- Ban duration (temporary_ban ke liye)
    ban_until           TIMESTAMP,

    -- Penalty points (accumulate hote hain — threshold pe escalate)
    points              INTEGER         NOT NULL DEFAULT 0,

    -- Details
    description         TEXT            NOT NULL,
    ride_id             INTEGER         REFERENCES rides(id) ON DELETE SET NULL,     -- related ride (if any)

    -- Kya driver ne dekha (acknowledge kiya)
    is_acknowledged     BOOLEAN         NOT NULL DEFAULT FALSE,
    acknowledged_at     TIMESTAMP,

    -- Admin ne lagayi
    issued_by           UUID            REFERENCES users(id),

    -- Appeal (driver contest kar sakta hai)
    is_appealed         BOOLEAN         NOT NULL DEFAULT FALSE,
    appeal_reason       TEXT,
    appeal_status       VARCHAR(20)     CHECK (appeal_status IN ('pending', 'accepted', 'rejected')),
    appeal_resolved_at  TIMESTAMP,

    created_at          TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP       DEFAULT CURRENT_TIMESTAMP
);

-- ─── driver_penalty_summary (cached aggregate — jaise rating_summaries) ─────
-- Har driver ka total penalty points, active bans, etc.
CREATE TABLE IF NOT EXISTS driver_penalty_summary (
    id                  SERIAL PRIMARY KEY,
    driver_id           INTEGER         NOT NULL REFERENCES drivers(id) ON DELETE CASCADE UNIQUE,

    total_points        INTEGER         NOT NULL DEFAULT 0,
    total_warnings      INTEGER         NOT NULL DEFAULT 0,
    total_fines         INTEGER         NOT NULL DEFAULT 0,
    total_fine_amount   DECIMAL(10,2)   NOT NULL DEFAULT 0,
    total_bans          INTEGER         NOT NULL DEFAULT 0,

    -- Current status
    is_banned           BOOLEAN         NOT NULL DEFAULT FALSE,
    ban_until           TIMESTAMP,
    ban_reason          TEXT,

    updated_at          TIMESTAMP       DEFAULT CURRENT_TIMESTAMP
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
-- Driver ke penalties list
CREATE INDEX idx_driver_penalties_driver ON driver_penalties(driver_id);

-- Active bans check (login pe check karna — banned hai to block karo)
CREATE INDEX idx_driver_penalty_summary_banned ON driver_penalty_summary(is_banned)
    WHERE is_banned = TRUE;

-- Offense type analytics (kaunsa offense sabse common hai)
CREATE INDEX idx_driver_penalties_offense ON driver_penalties(offense_type);

-- Pending appeals (admin dashboard)
CREATE INDEX idx_driver_penalties_appeal ON driver_penalties(is_appealed, appeal_status)
    WHERE is_appealed = TRUE AND appeal_status = 'pending';

-- Time-based (recent penalties)
CREATE INDEX idx_driver_penalties_time ON driver_penalties(created_at);
