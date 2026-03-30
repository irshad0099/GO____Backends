import express from 'express';

import {
    getPlans,
    getPlan,
    getActiveSubscription,
    purchase,
    cancel,
    autoRenew,
    applyBenefits,
    getHistory,
    getPayments,
    adminCreatePlan,
    adminTogglePlan,
} from '../controllers/subscriptionController.js';

import {
    purchaseSchema,
    cancelSchema,
    autoRenewSchema,
    rideBenefitsSchema,
    historyFilterSchema,
    createPlanSchema,
    validate,
} from '../validators/subscriptionValidator.js';

// ─── Middlewares ──────────────────────────────────────────────────────────────
import { authenticate } from '../../../core/middleware/auth.middleware.js';
import { requireRole }  from '../../../core/middleware/roleMiddleware.js';
import {
    apiLimiter,
    authLimiter,
} from '../../../core/middleware/rateLimiter.middleware.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
//  PUBLIC — No auth needed (plan listing shown on home/pricing page)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/v1/subscriptions/plans
router.get('/plans',          apiLimiter, getPlans);

// GET /api/v1/subscriptions/plans/:planId
router.get('/plans/:planId',  apiLimiter, getPlan);

// ─────────────────────────────────────────────────────────────────────────────
//  USER — Requires login
// ─────────────────────────────────────────────────────────────────────────────

router.use(authenticate);

// GET /api/v1/subscriptions/active
// Check if user has active subscription + benefits
router.get('/active', getActiveSubscription);

// POST /api/v1/subscriptions/purchase
// Subscribe to a plan
// Rate limited: 3 purchases per hour (prevent accidental double purchase)
router.post(
    '/purchase',
    authLimiter,
    validate(purchaseSchema),
    purchase
);

// POST /api/v1/subscriptions/cancel
// Cancel active subscription
router.post(
    '/cancel',
    validate(cancelSchema),
    cancel
);

// PATCH /api/v1/subscriptions/auto-renew
// Toggle auto-renew on/off
router.patch(
    '/auto-renew',
    validate(autoRenewSchema),
    autoRenew
);

// POST /api/v1/subscriptions/apply-benefits
// Apply discount/free ride to a given ride amount
// Called internally by ride-service before billing
router.post(
    '/apply-benefits',
    validate(rideBenefitsSchema),
    applyBenefits
);

// GET /api/v1/subscriptions/history
// Paginated past subscription list
router.get(
    '/history',
    validate(historyFilterSchema, 'query'),
    getHistory
);

// GET /api/v1/subscriptions/:subscriptionId/payments
// Payment history for a subscription
router.get(
    '/:subscriptionId/payments',
    getPayments
);

// ─────────────────────────────────────────────────────────────────────────────
//  ADMIN — Requires admin role
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/v1/subscriptions/admin/plans
// Create a new plan
router.post(
    '/admin/plans',
    requireRole(['admin']),
    validate(createPlanSchema),
    adminCreatePlan
);

// PATCH /api/v1/subscriptions/admin/plans/:planId/status
// body: { is_active: true/false }
router.patch(
    '/admin/plans/:planId/status',
    requireRole(['admin']),
    adminTogglePlan
);

export default router;