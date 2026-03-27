import { pool } from '../../../infrastructure/database/postgres.js';
import logger    from '../../../core/logger/logger.js';

// ─────────────────────────────────────────────────────────────────────────────
//  REVIEWS
// ─────────────────────────────────────────────────────────────────────────────

export const createReview = async (client, data) => {
    const {
        rideId, reviewerId, revieweeId,
        reviewerType, revieweeType,
        rating, comment, tags, tipAmount,
    } = data;

    const result = await client.query(
        `INSERT INTO reviews (
            ride_id, reviewer_id, reviewee_id,
            reviewer_type, reviewee_type,
            rating, comment, tags, tip_amount,
            created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *`,
        [
            rideId, reviewerId, revieweeId,
            reviewerType, revieweeType,
            rating, comment || null,
            tags || [], tipAmount || 0,
        ]
    );
    return result.rows[0];
};

export const getReviewById = async (reviewId) => {
    try {
        const result = await pool.query(
            `SELECT r.*,
                    u1.name AS reviewer_name,
                    u2.name AS reviewee_name
             FROM reviews r
             JOIN users u1 ON r.reviewer_id = u1.id
             JOIN users u2 ON r.reviewee_id = u2.id
             WHERE r.id = $1 AND r.is_visible = TRUE`,
            [reviewId]
        );
        return result.rows[0] || null;
    } catch (error) {
        logger.error('getReviewById error:', error);
        throw error;
    }
};

// Check if review already exists for this ride + reviewer
export const getExistingReview = async (rideId, reviewerId, revieweeId) => {
    try {
        const result = await pool.query(
            `SELECT * FROM reviews
             WHERE ride_id = $1 AND reviewer_id = $2 AND reviewee_id = $3`,
            [rideId, reviewerId, revieweeId]
        );
        return result.rows[0] || null;
    } catch (error) {
        logger.error('getExistingReview error:', error);
        throw error;
    }
};

// Get review for a specific ride by a reviewer
export const getReviewByRideAndReviewer = async (rideId, reviewerId) => {
    try {
        const result = await pool.query(
            `SELECT * FROM reviews WHERE ride_id = $1 AND reviewer_id = $2`,
            [rideId, reviewerId]
        );
        return result.rows[0] || null;
    } catch (error) {
        logger.error('getReviewByRideAndReviewer error:', error);
        throw error;
    }
};

// Get all reviews received by a user (their profile reviews)
export const getReviewsForUser = async (revieweeId, filters) => {
    try {
        const { limit = 10, offset = 0, rating } = filters;

        let query = `
            SELECT r.*,
                   u.name  AS reviewer_name
            FROM reviews r
            JOIN users u ON r.reviewer_id = u.id
            WHERE r.reviewee_id = $1
              AND r.is_visible = TRUE`;

        const params = [revieweeId];
        let idx = 2;

        if (rating) { query += ` AND r.rating = $${idx++}`; params.push(rating); }

        query += ` ORDER BY r.created_at DESC LIMIT $${idx++} OFFSET $${idx}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);
        return result.rows;
    } catch (error) {
        logger.error('getReviewsForUser error:', error);
        throw error;
    }
};

export const getReviewsForUserCount = async (revieweeId, filters = {}) => {
    try {
        const { rating } = filters;
        let query  = `SELECT COUNT(*) FROM reviews WHERE reviewee_id = $1 AND is_visible = TRUE`;
        const params = [revieweeId];
        let idx = 2;
        if (rating) { query += ` AND rating = $${idx++}`; params.push(rating); }
        const result = await pool.query(query, params);
        return parseInt(result.rows[0].count);
    } catch (error) {
        logger.error('getReviewsForUserCount error:', error);
        throw error;
    }
};

// Get both reviews for a ride (passenger→driver AND driver→passenger)
export const getReviewsByRideId = async (rideId) => {
    try {
        const result = await pool.query(
            `SELECT r.*,
                    u1.name AS reviewer_name,
                    u2.name AS reviewee_name
             FROM reviews r
             JOIN users u1 ON r.reviewer_id = u1.id
             JOIN users u2 ON r.reviewee_id = u2.id
             WHERE r.ride_id = $1`,
            [rideId]
        );
        return result.rows;
    } catch (error) {
        logger.error('getReviewsByRideId error:', error);
        throw error;
    }
};

export const flagReview = async (reviewId, isFlagged) => {
    try {
        const result = await pool.query(
            `UPDATE reviews
             SET is_flagged = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2 RETURNING *`,
            [isFlagged, reviewId]
        );
        return result.rows[0] || null;
    } catch (error) {
        logger.error('flagReview error:', error);
        throw error;
    }
};

export const hideReview = async (reviewId) => {
    try {
        const result = await pool.query(
            `UPDATE reviews
             SET is_visible = FALSE, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 RETURNING *`,
            [reviewId]
        );
        return result.rows[0] || null;
    } catch (error) {
        logger.error('hideReview error:', error);
        throw error;
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  REVIEW RESPONSES
// ─────────────────────────────────────────────────────────────────────────────

export const createReviewResponse = async (reviewId, responderId, response) => {
    try {
        const result = await pool.query(
            `INSERT INTO review_responses (review_id, responder_id, response, created_at, updated_at)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             ON CONFLICT (review_id) DO UPDATE
             SET response = $3, updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [reviewId, responderId, response]
        );
        return result.rows[0];
    } catch (error) {
        logger.error('createReviewResponse error:', error);
        throw error;
    }
};

export const getResponseByReviewId = async (reviewId) => {
    try {
        const result = await pool.query(
            `SELECT * FROM review_responses WHERE review_id = $1`,
            [reviewId]
        );
        return result.rows[0] || null;
    } catch (error) {
        logger.error('getResponseByReviewId error:', error);
        throw error;
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  RATING SUMMARIES
// ─────────────────────────────────────────────────────────────────────────────

export const getRatingSummary = async (userId) => {
    try {
        const result = await pool.query(
            `SELECT * FROM rating_summaries WHERE user_id = $1`,
            [userId]
        );
        return result.rows[0] || null;
    } catch (error) {
        logger.error('getRatingSummary error:', error);
        throw error;
    }
};

// Upsert rating summary — called after every new review
export const upsertRatingSummary = async (client, revieweeId, userType) => {
    // Recalculate from scratch to stay accurate
    const stats = await client.query(
        `SELECT
            COUNT(*)                                    AS total_reviews,
            COALESCE(AVG(rating), 0)                    AS average_rating,
            COUNT(*) FILTER (WHERE rating = 5)          AS five_star,
            COUNT(*) FILTER (WHERE rating = 4)          AS four_star,
            COUNT(*) FILTER (WHERE rating = 3)          AS three_star,
            COUNT(*) FILTER (WHERE rating = 2)          AS two_star,
            COUNT(*) FILTER (WHERE rating = 1)          AS one_star
         FROM reviews
         WHERE reviewee_id = $1 AND is_visible = TRUE`,
        [revieweeId]
    );

    const s = stats.rows[0];

    const result = await client.query(
        `INSERT INTO rating_summaries
            (user_id, user_type, average_rating, total_reviews,
             five_star, four_star, three_star, two_star, one_star, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id) DO UPDATE SET
            average_rating = $3,
            total_reviews  = $4,
            five_star      = $5,
            four_star      = $6,
            three_star     = $7,
            two_star       = $8,
            one_star       = $9,
            updated_at     = CURRENT_TIMESTAMP
         RETURNING *`,
        [
            revieweeId, userType,
            parseFloat(parseFloat(s.average_rating).toFixed(2)),
            parseInt(s.total_reviews),
            parseInt(s.five_star),
            parseInt(s.four_star),
            parseInt(s.three_star),
            parseInt(s.two_star),
            parseInt(s.one_star),
        ]
    );
    return result.rows[0];
};

// ─────────────────────────────────────────────────────────────────────────────
//  ADMIN
// ─────────────────────────────────────────────────────────────────────────────

export const getFlaggedReviews = async ({ limit = 20, offset = 0 }) => {
    try {
        const result = await pool.query(
            `SELECT r.*,
                    u1.name AS reviewer_name,
                    u2.name AS reviewee_name
             FROM reviews r
             JOIN users u1 ON r.reviewer_id = u1.id
             JOIN users u2 ON r.reviewee_id = u2.id
             WHERE r.is_flagged = TRUE
             ORDER BY r.created_at DESC
             LIMIT $1 OFFSET $2`,
            [limit, offset]
        );
        return result.rows;
    } catch (error) {
        logger.error('getFlaggedReviews error:', error);
        throw error;
    }
};