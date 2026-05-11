import express from 'express';
import { authenticate, authorize } from '../../../core/middleware/auth.middleware.js';
import { ridePaymentLimiter } from '../../../core/middleware/rateLimiter.middleware.js';
import * as controller from '../controllers/qrPaymentController.js';
import { body } from 'express-validator';

const router = express.Router();

// ─── QR Payment Generation (Driver only) ───────────────────────────────────
// Driver generates QR after ride completion
router.post(
    '/generate',
    authenticate,
    authorize('driver'),
    ridePaymentLimiter,
    [
        body('ride_id').isInt().withMessage('Valid ride ID is required')
    ],
    controller.generatePaymentQR
);

// ─── QR Payment Verification (Passenger only) ───────────────────────────────
// Passenger scans QR and completes payment
router.post(
    '/verify',
    authenticate,
    authorize('passenger'),
    ridePaymentLimiter,
    [
        body('order_number').notEmpty().withMessage('Order number is required'),
        body('gateway_payment_id').notEmpty().withMessage('Gateway payment ID is required'),
        body('gateway_signature').notEmpty().withMessage('Gateway signature is required')
    ],
    controller.verifyQRPayment
);

// ─── QR Payment Status ────────────────────────────────────────────────────
router.get(
    '/status/:order_number',
    authenticate,
    controller.getQRPaymentStatus
);

// ─── Close QR Payment ────────────────────────────────────────────────────────
router.post(
    '/close',
    authenticate,
    ridePaymentLimiter,
    controller.closeQRPayment
);

export default router;
