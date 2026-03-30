import express from 'express';

import {
    submitReviewController,
    getUserReviews,
    getRatingSummaryController,
    getRideReviews,
    respondToReviewController,
    flagReviewController,
    getTagsController,
    getFlaggedReviewsController,
    hideReviewController,
    unflagReviewController,
} from '../controller/reviewController.js';

import {
    submitReviewSchema,
    respondSchema,
    reviewFilterSchema,
    adminFilterSchema,
    validate,
} from '../validator/reviewValidator.js';

import { authenticate } from '../../../core/middleware/auth.middleware.js';
import { requireRole }  from '../../../core/middleware/roleMiddleware.js';
import { apiLimiter, authLimiter } from '../../../core/middleware/rateLimiter.middleware.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
//  PUBLIC — No auth needed
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/v1/reviews/tags?reviewer_type=passenger
// Fetch available feedback tags for review screen
router.get('/tags', apiLimiter, getTagsController);

// GET /api/v1/reviews/user/:userId
// All reviews for a user's profile page
router.get(
    '/user/:userId',
    apiLimiter,
    validate(reviewFilterSchema, 'query'),
    getUserReviews
);

// GET /api/v1/reviews/user/:userId/summary
// Rating summary — average stars, breakdown
router.get('/user/:userId/summary', apiLimiter, getRatingSummaryController);

// ─────────────────────────────────────────────────────────────────────────────
//  AUTHENTICATED
// ─────────────────────────────────────────────────────────────────────────────

router.use(authenticate);

// POST /api/v1/reviews
// Submit review after ride — passenger→driver or driver→passenger
router.post(
    '/',
    authLimiter,
    validate(submitReviewSchema),
    submitReviewController
);

// GET /api/v1/reviews/ride/:rideId
// Both reviews for a specific ride
router.get('/ride/:rideId', getRideReviews);

// POST /api/v1/reviews/respond
// Respond to a review (only reviewee can respond)
router.post(
    '/respond',
    validate(respondSchema),
    respondToReviewController
);

// POST /api/v1/reviews/:reviewId/flag
// Report a review for abuse
router.post('/:reviewId/flag', flagReviewController);

// ─────────────────────────────────────────────────────────────────────────────
//  ADMIN
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/v1/reviews/admin/flagged
router.get(
    '/admin/flagged',
    requireRole(['admin']),
    validate(adminFilterSchema, 'query'),
    getFlaggedReviewsController
);

// PATCH /api/v1/reviews/admin/:reviewId/hide
router.patch(
    '/admin/:reviewId/hide',
    requireRole(['admin']),
    hideReviewController
);

// PATCH /api/v1/reviews/admin/:reviewId/unflag
router.patch(
    '/admin/:reviewId/unflag',
    requireRole(['admin']),
    unflagReviewController
);

export default router;