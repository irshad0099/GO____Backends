-- Add FCM token columns for push notifications
ALTER TABLE users   ADD COLUMN IF NOT EXISTS fcm_token VARCHAR(500);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS fcm_token VARCHAR(500);