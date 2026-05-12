-- ─────────────────────────────────────────────────────────────────────────────
-- SUPPORT TICKETS — Help / Complaints System
--
-- 2 tables:
-- 1) support_tickets — user ka issue/complaint
-- 2) support_messages — ticket ke andar conversation (user ↔ admin)
--
-- Flow:
--   1. User creates ticket (ride related ya general)
--   2. Admin assigns + responds
--   3. Conversation back-and-forth
--   4. Admin resolves → ticket closed
--
-- Categories: ride_issue, payment_issue, driver_behavior, app_bug, account, other
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── support_tickets ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_tickets (
    id                  SERIAL PRIMARY KEY,

    -- Unique ticket number (format: TKT-YYYYMMDD-XXXXX)
    ticket_number       VARCHAR(50)     NOT NULL UNIQUE,

    user_id             UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ride_id             INTEGER         REFERENCES rides(id) ON DELETE SET NULL,     -- optional: ride se related hai to link karo

    -- Category + subject for routing/filtering
    category            VARCHAR(30)     NOT NULL CHECK (category IN (
        'ride_issue',           -- ride mein koi problem (route, fare, etc.)
        'payment_issue',        -- payment failed, wrong charge, refund needed
        'driver_behavior',      -- driver rude, unsafe driving
        'safety_concern',       -- safety related (escalate fast)
        'app_bug',              -- app crash, feature not working
        'account',              -- profile, login, verification issues
        'other'
    )),
    subject             VARCHAR(200)    NOT NULL,
    description         TEXT            NOT NULL,

    -- Priority (auto-set based on category, admin can override)
    priority            VARCHAR(10)     NOT NULL CHECK (priority IN (
        'low', 'medium', 'high', 'urgent'
    )) DEFAULT 'medium',

    -- Status flow
    status              VARCHAR(20)     NOT NULL CHECK (status IN (
        'open',             -- naya ticket, abhi kisi ne nahi dekha
        'in_progress',      -- admin dekh raha hai
        'waiting_on_user',  -- admin ne reply kiya, user ka response wait
        'resolved',         -- issue fix ho gaya
        'closed'            -- closed (by user or auto after 7 days of resolved)
    )) DEFAULT 'open',

    -- Assignment
    assigned_to         UUID            REFERENCES users(id),           -- admin user
    assigned_at         TIMESTAMP,

    -- Resolution
    resolved_at         TIMESTAMP,
    resolution_notes    TEXT,

    created_at          TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP       DEFAULT CURRENT_TIMESTAMP
);

-- ─── support_messages (ticket ke andar chat) ────────────────────────────────
CREATE TABLE IF NOT EXISTS support_messages (
    id              SERIAL PRIMARY KEY,
    ticket_id       INTEGER         NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    sender_id       UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Kis role se bheja — user ya admin/support
    sender_role     VARCHAR(20)     NOT NULL CHECK (sender_role IN ('user', 'admin')),

    message         TEXT            NOT NULL,

    -- Attachments (screenshots, etc.) — S3 URLs
    attachments     TEXT[]          DEFAULT '{}',

    created_at      TIMESTAMP       DEFAULT CURRENT_TIMESTAMP
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
-- User ke tickets (my tickets screen)
CREATE INDEX idx_support_tickets_user ON support_tickets(user_id);

-- Admin dashboard: open/in_progress tickets
CREATE INDEX idx_support_tickets_status ON support_tickets(status)
    WHERE status NOT IN ('resolved', 'closed');

-- Priority based sorting (urgent pehle)
CREATE INDEX idx_support_tickets_priority ON support_tickets(priority, created_at);

-- Ride se related tickets
CREATE INDEX idx_support_tickets_ride ON support_tickets(ride_id) WHERE ride_id IS NOT NULL;

-- Ticket ke messages (conversation load)
CREATE INDEX idx_support_messages_ticket ON support_messages(ticket_id, created_at);

-- Admin ke assigned tickets
CREATE INDEX idx_support_tickets_assigned ON support_tickets(assigned_to)
    WHERE assigned_to IS NOT NULL;
