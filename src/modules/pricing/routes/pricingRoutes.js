import express from 'express';
import {
    getFareEstimate,
    getAllEstimates,
    getFinalFare,
    getCancellation,
    getSurge,
} from '../controllers/pricingController.js';
import {
    fareEstimateSchema,
    allEstimatesSchema,
    finalFareSchema,
    cancellationFeeSchema,
    surgeInfoSchema,
    validate,
} from '../validators/pricingValidator.js';

// Correct paths based on your folder structure
import { authenticate } from '../../auth/middleware/authMiddleware.js';
import { apiLimiter } from '../../../core/middleware/rateLimiter.middleware.js';
const router = express.Router();

// ─── Public routes ────────────────────────────────────────────────────────────

router.get(
    '/estimate',
    apiLimiter,
    validate(fareEstimateSchema, 'query'),
    getFareEstimate
);

router.get(
    '/all-estimates',
    apiLimiter,
    validate(allEstimatesSchema, 'query'),
    getAllEstimates
);

router.get(
    '/surge',
    apiLimiter,
    validate(surgeInfoSchema, 'query'),
    getSurge
);

// ─── Authenticated routes ────────────────────────────────────────────────────

router.use(authenticate);

router.post(
    '/final-fare',
    validate(finalFareSchema),
    getFinalFare
);

router.post(
    '/cancellation-fee',
    validate(cancellationFeeSchema),
    getCancellation
);

export default router;