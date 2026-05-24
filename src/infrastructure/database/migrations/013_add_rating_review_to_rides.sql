-- 057_add_rating_review_to_rides.sql
-- Add rating and review columns to rides table for ride ratings feature

ALTER TABLE rides ADD COLUMN IF NOT EXISTS rating DECIMAL(2,1);
ALTER TABLE rides ADD COLUMN IF NOT EXISTS review TEXT;

CREATE INDEX IF NOT EXISTS idx_rides_rating ON rides(rating) WHERE rating IS NOT NULL;
