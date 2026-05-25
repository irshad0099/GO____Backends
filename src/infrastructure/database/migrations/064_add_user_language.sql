-- ============================================================
-- Add app language preference to users
--
-- Stores user's chosen UI language as a free-form string sent
-- from the frontend. Default: 'en'. No CHECK constraint —
-- whatever the client sends gets saved.
--
-- Idempotent — re-run safe.
-- ============================================================

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS language VARCHAR(20) DEFAULT 'en';
