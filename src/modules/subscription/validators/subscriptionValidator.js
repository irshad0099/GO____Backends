import Joi from 'joi';

// ─── Purchase / Subscribe ─────────────────────────────────────────────────────
export const purchaseSchema = Joi.object({
    plan_id: Joi.number().integer().positive().required()
        .messages({ 'any.required': 'plan_id is required' }),

    payment_method: Joi.string()
        .valid('cash', 'card', 'wallet', 'upi')
        .required()
        .messages({
            'any.only':     'payment_method must be: cash, card, wallet, or upi',
            'any.required': 'payment_method is required',
        }),

    payment_gateway: Joi.string().max(50).optional(),
    gateway_transaction_id: Joi.string().max(255).optional(),
    auto_renew: Joi.boolean().default(true),
});

// ─── Cancel Subscription ─────────────────────────────────────────────────────
export const cancelSchema = Joi.object({
    subscription_id: Joi.number().integer().positive().required()
        .messages({ 'any.required': 'subscription_id is required' }),

    reason: Joi.string().trim().max(500).optional(),
});

// ─── Toggle Auto-Renew ────────────────────────────────────────────────────────
export const autoRenewSchema = Joi.object({
    subscription_id: Joi.number().integer().positive().required()
        .messages({ 'any.required': 'subscription_id is required' }),

    auto_renew: Joi.boolean().required()
        .messages({ 'any.required': 'auto_renew (true/false) is required' }),
});

// ─── Apply Ride Benefits ──────────────────────────────────────────────────────
export const rideBenefitsSchema = Joi.object({
    ride_amount: Joi.number().positive().min(1).precision(2).required()
        .messages({
            'any.required': 'ride_amount is required',
            'number.positive': 'ride_amount must be positive',
        }),
});

// ─── Subscription History Filter ─────────────────────────────────────────────
export const historyFilterSchema = Joi.object({
    limit:  Joi.number().integer().min(1).max(50).default(10),
    offset: Joi.number().integer().min(0).default(0),
});

// ─── Admin: Create Plan ───────────────────────────────────────────────────────
export const createPlanSchema = Joi.object({
    name: Joi.string().trim().min(2).max(100).required()
        .messages({ 'any.required': 'Plan name is required' }),

    slug: Joi.string().trim().lowercase().max(100)
        .pattern(/^[a-z0-9-]+$/)
        .required()
        .messages({
            'any.required':   'Slug is required',
            'string.pattern.base': 'Slug must contain only lowercase letters, numbers, and hyphens',
        }),

    description: Joi.string().trim().max(500).optional(),

    price: Joi.number().positive().min(1).precision(2).required()
        .messages({ 'any.required': 'Price is required' }),

    durationDays: Joi.number().integer().min(1).max(365).required()
        .messages({ 'any.required': 'durationDays is required' }),

    rideDiscountPercent: Joi.number().min(0).max(100).default(0),
    freeRidesPerMonth:   Joi.number().integer().min(0).max(100).default(0),
    priorityBooking:     Joi.boolean().default(false),
    cancellationWaiver:  Joi.boolean().default(false),
    surgeProtection:     Joi.boolean().default(false),
});

import { sendValidationError } from '../../../core/utils/response.js';

// ─── Validation Middleware Factory ────────────────────────────────────────────
export const validate = (schema, source = 'body') => (req, res, next) => {
    const data = source === 'query' ? req.query : req.body;

    const { error, value } = schema.validate(data, {
        abortEarly:    false,
        stripUnknown:  true,
    });

    if (error) {
        return sendValidationError(res, error.details.map(d => ({ field: d.path.join('.'), message: d.message })));
    }

    // Express 5: req.query is a read-only getter, use defineProperty to override
    if (source === 'query') Object.defineProperty(req, 'query', { value, writable: true, configurable: true });
    else req.body = value;

    next();
};