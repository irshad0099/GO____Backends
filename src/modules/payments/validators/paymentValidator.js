import Joi from 'joi';

// ─── Create Payment Order ─────────────────────────────────────────────────────
export const createOrderSchema = Joi.object({
    amount: Joi.number().positive().min(1).max(100000).precision(2).required()
        .messages({
            'number.positive': 'Amount must be positive',
            'number.min':      'Minimum payment amount is ₹1',
            'number.max':      'Maximum payment amount is ₹1,00,000',
            'any.required':    'Amount is required',
        }),

    purpose: Joi.string()
        .valid('ride_payment', 'wallet_recharge', 'subscription', 'cancellation_fee', 'tip')
        .required()
        .messages({
            'any.only':     'purpose must be: ride_payment, wallet_recharge, subscription, cancellation_fee, or tip',
            'any.required': 'purpose is required',
        }),

    payment_method: Joi.string()
        .valid('cash', 'card', 'wallet', 'upi')
        .required()
        .messages({
            'any.only':     'payment_method must be: cash, card, wallet, or upi',
            'any.required': 'payment_method is required',
        }),

    payment_gateway: Joi.string().valid('razorpay', 'stripe').optional(),

    ride_id: Joi.number().integer().positive().optional()
        .when('purpose', {
            is:   Joi.valid('ride_payment', 'cancellation_fee', 'tip'),
            then: Joi.required(),
        })
        .messages({ 'any.required': 'ride_id is required for ride payments' }),

    description: Joi.string().trim().max(500).optional(),
    metadata:    Joi.object().optional(),
});

// ─── Verify Payment (Razorpay callback) ──────────────────────────────────────
export const verifyPaymentSchema = Joi.object({
    gateway_order_id: Joi.string().required()
        .messages({ 'any.required': 'gateway_order_id is required' }),

    gateway_payment_id: Joi.string().required()
        .messages({ 'any.required': 'gateway_payment_id is required' }),

    gateway_signature: Joi.string().required()
        .messages({ 'any.required': 'gateway_signature is required' }),
});

// ─── Process Refund ───────────────────────────────────────────────────────────
export const refundSchema = Joi.object({
    order_number: Joi.string().required()
        .messages({ 'any.required': 'order_number is required' }),

    amount: Joi.number().positive().min(1).precision(2).required()
        .messages({ 'any.required': 'Refund amount is required' }),

    reason: Joi.string().trim().max(500).required()
        .messages({ 'any.required': 'Refund reason is required' }),

    refund_method: Joi.string().valid('wallet', 'source').default('wallet')
        .messages({ 'any.only': 'refund_method must be wallet or source' }),

    ride_id: Joi.number().integer().positive().optional(),
});

// ─── Payment History Filters ──────────────────────────────────────────────────
export const historyFilterSchema = Joi.object({
    limit:   Joi.number().integer().min(1).max(100).default(20),
    offset:  Joi.number().integer().min(0).default(0),
    status:  Joi.string()
        .valid('created', 'attempted', 'success', 'failed', 'refunded', 'partially_refunded', 'cancelled')
        .optional(),
    purpose: Joi.string()
        .valid('ride_payment', 'wallet_recharge', 'subscription', 'cancellation_fee', 'tip')
        .optional(),
});

// ─── Save Payment Method ──────────────────────────────────────────────────────
export const saveMethodSchema = Joi.object({
    type: Joi.string().valid('card', 'upi', 'netbanking').required()
        .messages({ 'any.required': 'type is required' }),

    // Card fields — required if type is 'card'
    cardLast4: Joi.string().length(4).optional()
        .when('type', { is: 'card', then: Joi.required() }),
    cardBrand: Joi.string().valid('visa', 'mastercard', 'rupay', 'amex').optional()
        .when('type', { is: 'card', then: Joi.required() }),
    cardExpMonth: Joi.number().integer().min(1).max(12).optional()
        .when('type', { is: 'card', then: Joi.required() }),
    cardExpYear: Joi.number().integer().min(new Date().getFullYear()).optional()
        .when('type', { is: 'card', then: Joi.required() }),

    // UPI fields — required if type is 'upi'
    upiId: Joi.string().max(100).optional()
        .when('type', { is: 'upi', then: Joi.required() }),

    gatewayToken:      Joi.string().max(500).required()
        .messages({ 'any.required': 'gatewayToken is required' }),
    gatewayCustomerId: Joi.string().max(255).optional(),
    paymentGateway:    Joi.string().valid('razorpay', 'stripe').optional(),
    isDefault:         Joi.boolean().default(false),
});

// ─── Validation Middleware Factory ────────────────────────────────────────────
export const validate = (schema, source = 'body') => (req, res, next) => {
    const data = source === 'query' ? req.query : req.body;

    const { error, value } = schema.validate(data, {
        abortEarly:   false,
        stripUnknown: true,
    });

    if (error) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors:  error.details.map((d) => ({
                field:   d.path.join('.'),
                message: d.message,
            })),
        });
    }

    if (source === 'query') req.query = value;
    else req.body = value;

    next();
};