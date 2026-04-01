-- ─────────────────────────────────────────────────────────────────────────────
-- ALTER RIDES TABLE — Missing columns for new features
--
-- Yeh columns rides table mein add hone chahiye:
-- 1. ride_otp — passenger ko dikha, driver enter kare (safety)
-- 2. scheduled_ride_id — agar scheduled ride se create hui to link
-- 3. coupon_id — agar coupon use kiya to reference
-- 4. invoice_generated — invoice bani ya nahi (flag)
-- 5. is_scheduled — scheduled ride thi ya instant
-- ─────────────────────────────────────────────────────────────────────────────

-- Ride OTP (4-digit code — ride start ke liye)
ALTER TABLE rides ADD COLUMN IF NOT EXISTS ride_otp VARCHAR(10);

-- Kya yeh scheduled ride thi
ALTER TABLE rides ADD COLUMN IF NOT EXISTS is_scheduled BOOLEAN DEFAULT FALSE;

-- Scheduled ride se link (agar advance booking thi)
ALTER TABLE rides ADD COLUMN IF NOT EXISTS scheduled_ride_id INTEGER REFERENCES scheduled_rides(id) ON DELETE SET NULL;

-- Coupon reference (agar discount coupon use kiya)
ALTER TABLE rides ADD COLUMN IF NOT EXISTS coupon_id INTEGER REFERENCES coupons(id) ON DELETE SET NULL;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS coupon_discount DECIMAL(10,2) DEFAULT 0;

-- Invoice generate hui ya nahi (ride complete ke baad)
ALTER TABLE rides ADD COLUMN IF NOT EXISTS invoice_generated BOOLEAN DEFAULT FALSE;

-- Tip amount (passenger ne driver ko diya)
ALTER TABLE rides ADD COLUMN IF NOT EXISTS tip_amount DECIMAL(10,2) DEFAULT 0;

-- ─── Indexes on new columns ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_rides_scheduled ON rides(is_scheduled) WHERE is_scheduled = TRUE;
CREATE INDEX IF NOT EXISTS idx_rides_coupon ON rides(coupon_id) WHERE coupon_id IS NOT NULL;
