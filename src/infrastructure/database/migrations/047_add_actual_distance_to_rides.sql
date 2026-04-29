-- Real-time GPS-tracked distance — OTP confirm se ride complete tak
ALTER TABLE rides ADD COLUMN IF NOT EXISTS actual_distance_km DECIMAL(10, 2);
