import express from 'express';
import { authenticate } from '../../../core/middleware/auth.middleware.js';
import { validate } from '../../../core/middleware/validation.middleware.js';
import * as controller from '../controllers/cashPaymentController.js';
import { body } from 'express-validator';

const router = express.Router();

// ─── Driver confirms cash collection ─────────────────────────────────────
router.post(
    '/confirm',
    authenticate,
    validate([
        body('ride_id').isInt().withMessage('Invalid ride ID')
    ]),
    controller.confirmCashPayment
);

// ─── Get cash payment status ─────────────────────────────────────────────
router.get(
    '/status/:ride_id',
    authenticate,
    controller.getCashPaymentStatus
);

export default router;
