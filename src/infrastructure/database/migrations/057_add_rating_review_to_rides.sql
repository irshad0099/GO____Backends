-- 057_add_rating_review_to_rides.sql
-- Add rating and review columns to rides table for ride ratings feature

ALTER TABLE rides ADD COLUMN IF NOT EXISTS rating DECIMAL(2,1);
ALTER TABLE rides ADD COLUMN IF NOT EXISTS review TEXT;

-- Add constraint to ensure rating is between 1 and 5 (if it doesn't exist)
DO $$
BEGIN
    BEGIN
        ALTER TABLE rides ADD CONSTRAINT rides_rating_check CHECK (
            rating IS NULL OR (rating >= 1 AND rating <= 5)
        );
    EXCEPTION WHEN duplicate_object THEN
        -- Constraint already exists, skip
    END;
END $$;

CREATE INDEX IF NOT EXISTS idx_rides_rating ON rides(rating) WHERE rating IS NOT NULL;
