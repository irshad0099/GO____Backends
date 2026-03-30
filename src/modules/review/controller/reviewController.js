import logger from '../../../core/logger/logger.js';
import {
    submitReview,
    fetchUserReviews,
    fetchRatingSummary,
    fetchRideReviews,
    respondToReview,
    flagAReview,
    getAvailableTags,
    fetchFlaggedReviews,
    adminHideReview,
    adminUnflagReview,
} from '../services/reviewService.js';

// ─── Error handler ────────────────────────────────────────────────────────────
const handleError = (res, error) => {
    logger.error(`[ReviewController] ${error.message}`);
    return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Internal server error',
    });
};

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/v1/reviews
//  Passenger reviews driver OR driver reviews passenger after ride
// ─────────────────────────────────────────────────────────────────────────────
export const submitReviewController = async (req, res) => {
    try {
        const result = await submitReview(req.user.id, req.body);
        return res.status(201).json(result);
    } catch (error) {
        return handleError(res, error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v1/reviews/user/:userId
//  All reviews received by a user (shown on driver/passenger profile)
// ─────────────────────────────────────────────────────────────────────────────
export const getUserReviews = async (req, res) => {
    try {
        const { limit = 10, offset = 0, rating } = req.query;
        const result = await fetchUserReviews(parseInt(req.params.userId), {
            limit:  parseInt(limit),
            offset: parseInt(offset),
            rating: rating ? parseInt(rating) : undefined,
        });
        return res.status(200).json(result);
    } catch (error) {
        return handleError(res, error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v1/reviews/user/:userId/summary
//  Rating summary — average + star breakdown (shown on profile header)
// ─────────────────────────────────────────────────────────────────────────────
export const getRatingSummaryController = async (req, res) => {
    try {
        const result = await fetchRatingSummary(parseInt(req.params.userId));
        return res.status(200).json(result);
    } catch (error) {
        return handleError(res, error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v1/reviews/ride/:rideId
//  Both reviews for a ride (passenger→driver and driver→passenger)
// ─────────────────────────────────────────────────────────────────────────────
export const getRideReviews = async (req, res) => {
    try {
        const result = await fetchRideReviews(parseInt(req.params.rideId));
        return res.status(200).json(result);
    } catch (error) {
        return handleError(res, error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/v1/reviews/respond
//  Reviewee responds to a review (like Google reviews reply)
// ─────────────────────────────────────────────────────────────────────────────
export const respondToReviewController = async (req, res) => {
    try {
        const result = await respondToReview(req.user.id, req.body);
        return res.status(201).json(result);
    } catch (error) {
        return handleError(res, error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/v1/reviews/:reviewId/flag
//  Report a review for abuse / inappropriate content
// ─────────────────────────────────────────────────────────────────────────────
export const flagReviewController = async (req, res) => {
    try {
        const result = await flagAReview(parseInt(req.params.reviewId));
        return res.status(200).json(result);
    } catch (error) {
        return handleError(res, error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v1/reviews/tags?reviewer_type=passenger
//  Get available quick-feedback tags for review screen
// ─────────────────────────────────────────────────────────────────────────────
export const getTagsController = (req, res) => {
    try {
        const result = getAvailableTags(req.query.reviewer_type);
        return res.status(200).json(result);
    } catch (error) {
        return handleError(res, error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  ADMIN
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/v1/reviews/admin/flagged
export const getFlaggedReviewsController = async (req, res) => {
    try {
        const { limit = 20, offset = 0 } = req.query;
        const result = await fetchFlaggedReviews({
            limit:  parseInt(limit),
            offset: parseInt(offset),
        });
        return res.status(200).json(result);
    } catch (error) {
        return handleError(res, error);
    }
};

// PATCH /api/v1/reviews/admin/:reviewId/hide
export const hideReviewController = async (req, res) => {
    try {
        const result = await adminHideReview(parseInt(req.params.reviewId));
        return res.status(200).json(result);
    } catch (error) {
        return handleError(res, error);
    }
};

// PATCH /api/v1/reviews/admin/:reviewId/unflag
export const unflagReviewController = async (req, res) => {
    try {
        const result = await adminUnflagReview(parseInt(req.params.reviewId));
        return res.status(200).json(result);
    } catch (error) {
        return handleError(res, error);
    }
};