-- ─────────────────────────────────────────────────────────────────────────────
-- REVIEW SYSTEM — PostgreSQL Schema
-- Driver & Passenger reviews, ratings, feedback
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── reviews ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
    id                  SERIAL PRIMARY KEY,

    ride_id             INTEGER         NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
    reviewer_id         INTEGER         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reviewee_id         INTEGER         NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Who is reviewing whom
    reviewer_type       VARCHAR(10)     NOT NULL CHECK (reviewer_type IN ('passenger', 'driver')),
    reviewee_type       VARCHAR(10)     NOT NULL CHECK (reviewee_type IN ('passenger', 'driver')),

    -- Rating: 1 to 5 stars
    rating              DECIMAL(2,1)    NOT NULL CHECK (rating >= 1 AND rating <= 5),

    -- Written feedback
    comment             TEXT,

    -- Tags (quick feedback chips like Ola/Uber)
    -- e.g. ['clean_car', 'good_driving', 'polite']
    tags                TEXT[]          DEFAULT '{}',

    -- Tip given by passenger to driver (optional)
    tip_amount          DECIMAL(10,2)   DEFAULT 0,

    -- Visibility
    is_visible          BOOLEAN         NOT NULL DEFAULT TRUE,   -- can be hidden by admin
    is_flagged          BOOLEAN         NOT NULL DEFAULT FALSE,  -- flagged for abuse

    created_at          TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,

    -- One review per ride per direction (passenger→driver OR driver→passenger)
    UNIQUE (ride_id, reviewer_id, reviewee_id)
);

-- ─── review_responses ────────────────────────────────────────────────────────
-- Driver/passenger can respond to a review (like Google reviews)
CREATE TABLE IF NOT EXISTS review_responses (
    id                  SERIAL PRIMARY KEY,
    review_id           INTEGER         NOT NULL REFERENCES reviews(id) ON DELETE CASCADE UNIQUE,
    responder_id        INTEGER         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    response            TEXT            NOT NULL,
    created_at          TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP       DEFAULT CURRENT_TIMESTAMP
);

-- ─── rating_summaries ────────────────────────────────────────────────────────
-- Cached aggregate ratings — updated on every new review
-- Avoids expensive AVG() queries on every profile load
CREATE TABLE IF NOT EXISTS rating_summaries (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER         NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    user_type           VARCHAR(10)     NOT NULL CHECK (user_type IN ('passenger', 'driver')),
    average_rating      DECIMAL(3,2)    NOT NULL DEFAULT 0,
    total_reviews       INTEGER         NOT NULL DEFAULT 0,
    five_star           INTEGER         NOT NULL DEFAULT 0,
    four_star           INTEGER         NOT NULL DEFAULT 0,
    three_star          INTEGER         NOT NULL DEFAULT 0,
    two_star            INTEGER         NOT NULL DEFAULT 0,
    one_star            INTEGER         NOT NULL DEFAULT 0,
    updated_at          TIMESTAMP       DEFAULT CURRENT_TIMESTAMP
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX idx_reviews_ride_id      ON reviews(ride_id);
CREATE INDEX idx_reviews_reviewer_id  ON reviews(reviewer_id);
CREATE INDEX idx_reviews_reviewee_id  ON reviews(reviewee_id);
CREATE INDEX idx_reviews_rating       ON reviews(rating);
CREATE INDEX idx_rating_summaries_uid ON rating_summaries(user_id);
