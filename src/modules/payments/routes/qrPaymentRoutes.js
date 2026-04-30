import express from 'express';
import { authenticate } from '../../../core/middleware/auth.middleware.js';
import { ridePaymentLimiter } from '../../../core/middleware/rateLimiter.middleware.js';
import * as controller from '../controllers/qrPaymentController.js';
import { createOrderSchema, verifyPaymentSchema, validate } from '../validators/paymentValidator.js';

const router = express.Router();

// ─── QR Payment Generation ────────────────────────────────────────────────
router.post(
    '/generate',
    authenticate,
    ridePaymentLimiter,
    validate(createOrderSchema),
    controller.generatePaymentQR
);

// ─── QR Payment Verification ────────────────────────────────────────────────
router.post(
    '/verify',
    authenticate,
    ridePaymentLimiter,
    validate(verifyPaymentSchema),
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
