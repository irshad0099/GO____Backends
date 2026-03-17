import { body, param, query } from 'express-validator';

// ==================== Plan validators ====================
export const validatePlanSlug = () => param('slug').isString().notEmpty();

export const validatePlanId = () => param('planId').isInt().withMessage('Invalid plan ID');

export const validateCreatePlan = [
    body('name').notEmpty().isString(),
    body('slug').notEmpty().isString().matches(/^[a-z0-9-]+$/).withMessage('Slug must be lowercase, numbers, and hyphens only'),
    body('description').optional().isString(),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('duration_days').isInt({ min: 1 }).withMessage('Duration days must be at least 1'),
    body('ride_discount_percent').optional().isFloat({ min: 0, max: 100 }).default(0),
    body('free_rides_per_month').optional().isInt({ min: 0 }).default(0),
    body('priority_booking').optional().isBoolean().default(false),
    body('cancellation_waiver').optional().isBoolean().default(false),
    body('surge_protection').optional().isBoolean().default(false)
];

export const validateUpdatePlan = [
    param('planId').isInt().withMessage('Invalid plan ID'),
    body('name').optional().isString(),
    body('description').optional().isString(),
    body('price').optional().isFloat({ min: 0 }),
    body('duration_days').optional().isInt({ min: 1 }),
    body('ride_discount_percent').optional().isFloat({ min: 0, max: 100 }),
    body('free_rides_per_month').optional().isInt({ min: 0 }),
    body('priority_booking').optional().isBoolean(),
    body('cancellation_waiver').optional().isBoolean(),
    body('surge_protection').optional().isBoolean(),
    body('is_active').optional().isBoolean()
];

// ==================== User subscription validators ====================
export const validatePurchase = [
    body('planId').isInt().withMessage('Plan ID is required'),
    body('paymentMethod').isIn(['cash', 'card', 'wallet', 'upi']).withMessage('Invalid payment method'),
    body('paymentDetails').optional().isObject()
];

export const validateCancel = [
    param('subscriptionId').isInt().withMessage('Invalid subscription ID'),
    body('reason').optional().isString()
];