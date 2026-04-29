import express from 'express';
import { authenticate } from '../../../core/middleware/auth.middleware.js';
import { validate } from '../../../core/middleware/validation.middleware.js';
import * as controller from '../controllers/cashPaymentController.js';
import * as validator from '../validators/rideValidator.js';

const router = express.Router();

// ─── Driver confirms cash collection ─────────────────────────────────────
router.post(
    '/confirm',
    authenticate,
    validate(validator.rideIdValidator),
    controller.confirmCashPayment
);

// ─── Get cash payment status ─────────────────────────────────────────────
router.get(
    '/status/:ride_id',
    authenticate,
    controller.getCashPaymentStatus
);

export default router;
