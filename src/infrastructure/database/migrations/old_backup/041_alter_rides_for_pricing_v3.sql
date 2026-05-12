-- ─────────────────────────────────────────────────────────────────────────────
-- ALTER RIDES — Pricing Engine v3.0 fields
--
-- Snapshot locked values at request time (edge case 10.2 — sub expiry mid-ride)
-- Plus GST, pickup surcharge, waiting charges breakdown.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Snapshotted subscription / surge cap at ride request ────────────────────
ALTER TABLE rides ADD COLUMN IF NOT EXISTS locked_is_subscribed    BOOLEAN         DEFAULT FALSE;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS locked_subscriber_tier  VARCHAR(20);
ALTER TABLE rides ADD COLUMN IF NOT EXISTS locked_surge_cap        DECIMAL(4,2)    DEFAULT 1.75;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS locked_is_peak          BOOLEAN         DEFAULT FALSE;

-- ── GST breakdown ───────────────────────────────────────────────────────────
ALTER TABLE rides ADD COLUMN IF NOT EXISTS gst_on_fare             DECIMAL(10,2)   DEFAULT 0;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS gst_on_platform_fee     DECIMAL(10,2)   DEFAULT 0;

-- ── Final fare breakdown (computed at completion) ───────────────────────────
ALTER TABLE rides ADD COLUMN IF NOT EXISTS fare_before_gst         DECIMAL(10,2)   DEFAULT 0;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS passenger_total         DECIMAL(10,2)   DEFAULT 0;

-- ── Driver compensation breakdown ───────────────────────────────────────────
ALTER TABLE rides ADD COLUMN IF NOT EXISTS pickup_compensation     DECIMAL(10,2)   DEFAULT 0;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS waiting_charges         DECIMAL(10,2)   DEFAULT 0;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS traffic_compensation    DECIMAL(10,2)   DEFAULT 0;

-- ── Pending recoveries flag on users (edge 10.1) ────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_payment_defaulter    BOOLEAN         DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_locked_until    TIMESTAMP;

-- ── Pending recoveries table (edge 10.1) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS pending_recoveries (
    id                  SERIAL PRIMARY KEY,
    ride_id             INTEGER         NOT NULL REFERENCES rides(id)  ON DELETE CASCADE,
    rider_id            UUID            NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    amount              DECIMAL(10,2)   NOT NULL,
    attempt_count       INTEGER         NOT NULL DEFAULT 0,
    last_attempt_at     TIMESTAMP,
    status              VARCHAR(20)     NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','recovered','failed','manual_review')),
    failure_reason      TEXT,
    created_at          TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP       DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pending_recoveries_status
    ON pending_recoveries(status, created_at);
CREATE INDEX IF NOT EXISTS idx_pending_recoveries_rider
    ON pending_recoveries(rider_id);
