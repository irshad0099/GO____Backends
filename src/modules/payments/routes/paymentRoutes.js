import express from 'express';

import {
    createPaymentOrder,
    verifyPayment,
    initiateRefund,
    getOrder,
    getHistory,
    getSavedMethods,
    saveMethod,
    removeMethod,
    setDefault,
} from '../../payments/controller/paymentController.js';

import {
    createOrderSchema,
    verifyPaymentSchema,
    refundSchema,
    historyFilterSchema,
    saveMethodSchema,
    validate,
} from '../validator/paymentValidator.js';

import { authenticate } from '../../../core/middleware/auth.middleware.js';
import { requireRole }  from '../../../core/middlewares/roleMiddleware.js';
import {
    apiLimiter,
    authLimiter,
    walletRechargeLimiter,
} from '../../../middlewares/rateLimiter.js';

const router = express.Router();

// All payment routes require login
router.use(authenticate);

// ─────────────────────────────────────────────────────────────────────────────
//  PAYMENT FLOW
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/v1/payments/orders
// Step 1 — Create a payment order
// cash/wallet: auto confirmed | UPI/card: returns gateway_order_id for SDK
router.post(
    '/orders',
    authLimiter,                    // 5 per 15 min — prevent order spam
    validate(createOrderSchema),
    createPaymentOrder
);

// POST /api/v1/payments/verify
// Step 2 — Verify Razorpay payment from frontend callback
// Rate limited tightly — signature forgery protection
router.post(
    '/verify',
    authLimiter,
    validate(verifyPaymentSchema),
    verifyPayment
);

// ─────────────────────────────────────────────────────────────────────────────
//  REFUNDS  (admin / system only)
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/v1/payments/refund
// Initiate full or partial refund — wallet (instant) or source (3-5 days)
router.post(
    '/refund',
    requireRole(['admin', 'system']),
    validate(refundSchema),
    initiateRefund
);

// ─────────────────────────────────────────────────────────────────────────────
//  PAYMENT HISTORY
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/v1/payments/history
// Paginated payment history — filter by status, purpose
router.get(
    '/history',
    apiLimiter,
    validate(historyFilterSchema, 'query'),
    getHistory
);

// GET /api/v1/payments/orders/:orderNumber
// Single order detail with all refunds
router.get(
    '/orders/:orderNumber',
    apiLimiter,
    getOrder
);

// ─────────────────────────────────────────────────────────────────────────────
//  SAVED PAYMENT METHODS (like Ola saved cards)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/v1/payments/methods
// All saved cards / UPI IDs
router.get(
    '/methods',
    apiLimiter,
    getSavedMethods
);

// POST /api/v1/payments/methods
// Save new card / UPI (only gateway token — never raw card data)
router.post(
    '/methods',
    authLimiter,
    validate(saveMethodSchema),
    saveMethod
);

// DELETE /api/v1/payments/methods/:methodId
// Remove a saved payment method
router.delete(
    '/methods/:methodId',
    apiLimiter,
    removeMethod
);

// PATCH /api/v1/payments/methods/:methodId/default
// Set as default payment method
router.patch(
    '/methods/:methodId/default',
    apiLimiter,
    setDefault
);

export default router;
