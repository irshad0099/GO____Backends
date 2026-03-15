-- Add new columns to drivers table for scoring and subscription

ALTER TABLE drivers 
ADD COLUMN IF NOT EXISTS city VARCHAR(100),
ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) CHECK (subscription_status IN ('active', 'inactive', 'expired')) DEFAULT 'inactive',
ADD COLUMN IF NOT EXISTS subscription_expiry TIMESTAMP;