import express from 'express';
import { createRidePayment, calculateRidePayment, getRidePaymentStatus } from '../controllers/ridePaymentController.js';
import { authenticate } from '../../../core/middleware/auth.middleware.js';
import Joi from 'joi';

const router = express.Router();

// All ride payment routes require authentication
router.use(authenticate);

// ─── Custom Joi Validation Middleware ─────────────────────────────────────
const validateJoi = (schema) => (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
    });

    if (error) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            data: {},
            errorFull: error.details.map(d => ({ field: d.path.join('.'), message: d.message }))
        });
    }

    req.body = value;
    next();
};

// ─── Validation Schemas ─────────────────────────────────────────────

const createPaymentSchema = Joi.object({
    ride_id: Joi.number().integer().positive().required(),
    payment_method: Joi.string().valid('cash', 'card', 'wallet', 'upi', 'qr').required(),
    payment_gateway: Joi.string().valid('razorpay', 'stripe').optional(),
});

const calculatePaymentSchema = Joi.object({
    vehicleType: Joi.string().required(),
    pickupLatitude: Joi.number().required(),
    pickupLongitude: Joi.number().required(),
    dropoffLatitude: Joi.number().required(),
    dropoffLongitude: Joi.number().required(),
    payment_method: Joi.string().valid('cash', 'card', 'wallet', 'upi', 'qr').default('card'),
});

// ─── Routes ─────────────────────────────────────────────────────────

// POST /api/v1/rides/payments/calculate
// Calculate fare and create payment order for upcoming ride
router.post(
    '/calculate',
    validateJoi(calculatePaymentSchema),
    calculateRidePayment
);

// POST /api/v1/rides/payments
// Create payment order for completed ride
router.post(
    '/',
    validateJoi(createPaymentSchema),
    createRidePayment
);

// GET /api/v1/rides/payments/:ride_id/status
// Get payment status for a specific ride
router.get(
    '/:ride_id/status',
    getRidePaymentStatus
);

export default router;
