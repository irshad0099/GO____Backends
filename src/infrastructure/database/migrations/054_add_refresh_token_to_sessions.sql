-- Add refresh_token column to sessions table if it doesn't exist
-- This migration fixes the missing refresh_token column issue

DO $$
BEGIN
    -- Check if the column exists before adding it
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='sessions' 
        AND column_name='refresh_token'
    ) THEN
        -- Add the refresh_token column
        ALTER TABLE sessions 
        ADD COLUMN refresh_token TEXT UNIQUE;
        
        -- Create index for refresh_token if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 
            FROM pg_indexes 
            WHERE tablename='sessions' 
            AND indexname='idx_sessions_refresh_token'
        ) THEN
            CREATE INDEX idx_sessions_refresh_token ON sessions(refresh_token);
        END IF;
        
        RAISE NOTICE 'refresh_token column added to sessions table';
    ELSE
        RAISE NOTICE 'refresh_token column already exists in sessions table';
    END IF;
END $$;
