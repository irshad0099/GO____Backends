import { pool } from '../../../infrastructure/database/postgres.js';
import logger    from '../../../core/logger/logger.js';
import {
    createReview,
    getReviewById,
    getExistingReview,
    getReviewByRideAndReviewer,
    getReviewsForUser,
    getReviewsForUserCount,
    getReviewsByRideId,
    flagReview,
    hideReview,
    createReviewResponse,
    getResponseByReviewId,
    getRatingSummary,
    upsertRatingSummary,
    getFlaggedReviews,
} from '../repository/review.Repository.js';

// ─────────────────────────────────────────────────────────────────────────────
//  Quick feedback tags (like Ola / Uber chips)
// ─────────────────────────────────────────────────────────────────────────────

export const PASSENGER_TAGS = [
    'polite',
    'on_time',
    'clean_seating',
    'followed_route',
    'no_complaints',
];

export const DRIVER_TAGS = [
    'clean_car',
    'safe_driving',
    'polite_driver',
    'on_time_pickup',
    'good_navigation',
    'ac_working',
    'smooth_ride',
];

// ─────────────────────────────────────────────────────────────────────────────
//  Formatters
// ─────────────────────────────────────────────────────────────────────────────

const formatReview = (r) => ({
    reviewId:       r.id,
    rideId:         r.ride_id,
    reviewerName:   r.reviewer_name   || null,
    revieweeId:     r.reviewee_id,
    revieweeName:   r.reviewee_name   || null,
    reviewerType:   r.reviewer_type,
    revieweeType:   r.reviewee_type,
    rating:         parseFloat(r.rating),
    comment:        r.comment         || null,
    tags:           r.tags            || [],
    tipAmount:      parseFloat(r.tip_amount || 0),
    isFlagged:      r.is_flagged,
    createdAt:      r.created_at,
});

const formatSummary = (s) => ({
    userId:         s.user_id,
    userType:       s.user_type,
    averageRating:  parseFloat(s.average_rating),
    totalReviews:   s.total_reviews,
    breakdown: {
        fiveStar:   s.five_star,
        fourStar:   s.four_star,
        threeStar:  s.three_star,
        twoStar:    s.two_star,
        oneStar:    s.one_star,
    },
});

// ─────────────────────────────────────────────────────────────────────────────
//  1. Submit Review
//     passenger reviews driver OR driver reviews passenger after ride
// ─────────────────────────────────────────────────────────────────────────────

export const submitReview = async (reviewerId, {
    ride_id,
    reviewee_id,
    reviewer_type,   // 'passenger' | 'driver'
    reviewee_type,   // 'driver'    | 'passenger'
    rating,
    comment,
    tags,
    tip_amount,
}) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Idempotency — one review per ride per direction
        const existing = await getExistingReview(ride_id, reviewerId, reviewee_id);
        if (existing) {
            await client.query('ROLLBACK');
            const err = new Error('You have already reviewed this ride');
            err.statusCode = 409;
            throw err;
        }

        // Validate tags against allowed list
        const allowedTags = reviewer_type === 'passenger' ? DRIVER_TAGS : PASSENGER_TAGS;
        const validTags   = (tags || []).filter(t => allowedTags.includes(t));

        const review = await createReview(client, {
            rideId:       ride_id,
            reviewerId,
            revieweeId:   reviewee_id,
            reviewerType: reviewer_type,
            revieweeType: reviewee_type,
            rating,
            comment,
            tags:         validTags,
            tipAmount:    tip_amount || 0,
        });

        // Update cached rating summary for the reviewee
        await upsertRatingSummary(client, reviewee_id, reviewee_type);

        await client.query('COMMIT');

        logger.info(
            `[Review] Submitted | Ride: ${ride_id} | ` +
            `${reviewer_type} → ${reviewee_type} | Rating: ${rating}⭐`
        );

        return {
            success: true,
            message: 'Review submitted successfully',
            data:    formatReview({ ...review, reviewer_name: null, reviewee_name: null }),
        };
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error(`[Review] submitReview error:`, error);
        throw error;
    } finally {
        client.release();
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  2. Get reviews for a user (driver/passenger profile page)
// ─────────────────────────────────────────────────────────────────────────────

export const fetchUserReviews = async (revieweeId, filters) => {
    const [reviews, total] = await Promise.all([
        getReviewsForUser(revieweeId, filters),
        getReviewsForUserCount(revieweeId, filters),
    ]);

    // Attach responses
    const reviewsWithResponse = await Promise.all(
        reviews.map(async (r) => {
            const response = await getResponseByReviewId(r.id);
            return { ...formatReview(r), response: response?.response || null };
        })
    );

    return {
        success: true,
        data: {
            reviews: reviewsWithResponse,
            pagination: {
                total,
                limit:   filters.limit  || 10,
                offset:  filters.offset || 0,
                hasMore: (filters.offset || 0) + (filters.limit || 10) < total,
            },
        },
    };
};

// ─────────────────────────────────────────────────────────────────────────────
//  3. Get rating summary for a user
// ─────────────────────────────────────────────────────────────────────────────

export const fetchRatingSummary = async (userId) => {
    const summary = await getRatingSummary(userId);

    if (!summary) {
        return {
            success: true,
            data: {
                userId,
                averageRating: 0,
                totalReviews:  0,
                breakdown: {
                    fiveStar: 0, fourStar: 0, threeStar: 0,
                    twoStar:  0, oneStar:  0,
                },
            },
        };
    }

    return {
        success: true,
        data:    formatSummary(summary),
    };
};

// ─────────────────────────────────────────────────────────────────────────────
//  4. Get both reviews for a ride
// ─────────────────────────────────────────────────────────────────────────────

export const fetchRideReviews = async (rideId) => {
    const reviews = await getReviewsByRideId(rideId);

    const passengerReview = reviews.find(r => r.reviewer_type === 'passenger') || null;
    const driverReview    = reviews.find(r => r.reviewer_type === 'driver')    || null;

    return {
        success: true,
        data: {
            rideId,
            passengerToDriver: passengerReview ? formatReview(passengerReview) : null,
            driverToPassenger: driverReview    ? formatReview(driverReview)    : null,
            bothReviewed:      !!(passengerReview && driverReview),
        },
    };
};

// ─────────────────────────────────────────────────────────────────────────────
//  5. Respond to a review (driver/passenger replies)
// ─────────────────────────────────────────────────────────────────────────────

export const respondToReview = async (responderId, { review_id, response }) => {
    const review = await getReviewById(review_id);

    if (!review) {
        const err = new Error('Review not found');
        err.statusCode = 404;
        throw err;
    }

    // Only the reviewee can respond
    if (review.reviewee_id !== responderId) {
        const err = new Error('You can only respond to reviews about yourself');
        err.statusCode = 403;
        throw err;
    }

    const result = await createReviewResponse(review_id, responderId, response);

    logger.info(`[Review] Response added | Review: ${review_id} | User: ${responderId}`);

    return {
        success: true,
        message: 'Response added successfully',
        data: {
            reviewId:    review_id,
            response:    result.response,
            responderId: result.responder_id,
            createdAt:   result.created_at,
        },
    };
};

// ─────────────────────────────────────────────────────────────────────────────
//  6. Flag a review (report abuse)
// ─────────────────────────────────────────────────────────────────────────────

export const flagAReview = async (reviewId) => {
    const review = await getReviewById(reviewId);
    if (!review) {
        const err = new Error('Review not found');
        err.statusCode = 404;
        throw err;
    }

    await flagReview(reviewId, true);

    logger.info(`[Review] Flagged | Review: ${reviewId}`);

    return {
        success: true,
        message: 'Review flagged for moderation. Our team will review it shortly.',
    };
};

// ─────────────────────────────────────────────────────────────────────────────
//  7. Get available tags
// ─────────────────────────────────────────────────────────────────────────────

export const getAvailableTags = (reviewerType) => {
    const tags = reviewerType === 'passenger' ? DRIVER_TAGS : PASSENGER_TAGS;
    return {
        success: true,
        data:    { reviewerType, tags },
    };
};

// ─────────────────────────────────────────────────────────────────────────────
//  ADMIN SERVICES
// ─────────────────────────────────────────────────────────────────────────────

export const fetchFlaggedReviews = async ({ limit, offset }) => {
    const reviews = await getFlaggedReviews({ limit, offset });
    return {
        success: true,
        data:    reviews.map(formatReview),
    };
};

export const adminHideReview = async (reviewId) => {
    const review = await hideReview(reviewId);
    if (!review) {
        const err = new Error('Review not found');
        err.statusCode = 404;
        throw err;
    }

    // Refresh rating summary after hiding
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await upsertRatingSummary(client, review.reviewee_id, review.reviewee_type);
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
    } finally {
        client.release();
    }

    logger.info(`[Review] Hidden by admin | Review: ${reviewId}`);

    return {
        success: true,
        message: 'Review hidden successfully',
    };
};

export const adminUnflagReview = async (reviewId) => {
    await flagReview(reviewId, false);
    return {
        success: true,
        message: 'Review unflagged successfully',
    };
};