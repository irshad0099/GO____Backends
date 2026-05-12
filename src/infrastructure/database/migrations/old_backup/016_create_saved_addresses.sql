-- ─────────────────────────────────────────────────────────────────────────────
-- SAVED ADDRESSES — Home / Work / Favorites
-- Passenger apni frequently used locations save karta hai
-- Har baar type nahi karna padta — Rapido/Ola style "Home", "Work", "Other"
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS saved_addresses (
    id              SERIAL PRIMARY KEY,
    user_id         UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Label: home, work ya custom name (e.g. "Gym", "Mom's House")
    label           VARCHAR(50)     NOT NULL,

    -- Type: quick filter ke liye — home/work special, baaki other
    type            VARCHAR(10)     NOT NULL CHECK (type IN ('home', 'work', 'other')) DEFAULT 'other',

    -- Full address details
    latitude        DECIMAL(10,8)   NOT NULL,
    longitude       DECIMAL(11,8)   NOT NULL,
    address         TEXT            NOT NULL,
    landmark        VARCHAR(255),
    place_id        VARCHAR(255),           -- Google Maps place_id for future autocomplete

    -- Ordering: user manually arrange kar sake starred/recent
    is_default      BOOLEAN         NOT NULL DEFAULT FALSE,

    created_at      TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,

    -- Ek user ke paas ek hi "home" aur ek hi "work" hoga
    -- "other" type ke multiple allowed hain
    UNIQUE (user_id, type, label)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
-- User ki saari addresses quickly fetch karne ke liye
CREATE INDEX idx_saved_addresses_user_id ON saved_addresses(user_id);

-- Home/Work fast lookup (profile screen pe)
CREATE INDEX idx_saved_addresses_user_type ON saved_addresses(user_id, type);
