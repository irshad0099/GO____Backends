import Joi from 'joi';

// ─── Wallet Top-up / Recharge ─────────────────────────────────────────────────
export const walletRechargeSchema = Joi.object({
    amount: Joi.number().positive().min(10).max(10000).precision(2).required()
        .messages({
            'number.base':     'Amount must be a number',
            'number.positive': 'Amount must be positive',
            'number.min':      'Minimum recharge amount is ₹10',
            'number.max':      'Maximum recharge amount is ₹10,000',
            'any.required':    'Amount is required',
        }),

    // Matches your schema CHECK: 'cash', 'card', 'wallet', 'upi'
    payment_method: Joi.string()
        .valid('cash', 'card', 'upi')   // 'wallet' not valid for top-up (circular)
        .required()
        .messages({
            'any.only':     'payment_method must be: cash, card, or upi',
            'any.required': 'payment_method is required',
        }),

    payment_gateway: Joi.string().max(50).optional(),           // e.g. 'razorpay'
    gateway_transaction_id: Joi.string().max(255).optional(),   // from gateway webhook
    description: Joi.string().trim().max(500).optional(),
});

// ─── Ride Payment ─────────────────────────────────────────────────────────────
export const ridePaymentSchema = Joi.object({
    ride_id: Joi.number().integer().positive().required()
        .messages({ 'any.required': 'ride_id is required' }),

    amount: Joi.number().positive().min(1).max(10000).precision(2).required()
        .messages({ 'any.required': 'Amount is required' }),

    description: Joi.string().trim().max(500).optional(),
});

// ─── Ride Refund ─────────────────────────────────────────────────────────────
export const rideRefundSchema = Joi.object({
    ride_id: Joi.number().integer().positive().required()
        .messages({ 'any.required': 'ride_id is required' }),

    amount: Joi.number().positive().min(1).max(10000).precision(2).required()
        .messages({ 'any.required': 'Refund amount is required' }),

    reason: Joi.string().trim().max(500).required()
        .messages({ 'any.required': 'Refund reason is required' }),
});

// ─── Cancellation Fee ─────────────────────────────────────────────────────────
export const cancellationFeeSchema = Joi.object({
    ride_id: Joi.number().integer().positive().required()
        .messages({ 'any.required': 'ride_id is required' }),

    amount: Joi.number().positive().min(1).max(500).precision(2).required()
        .messages({
            'any.required': 'Amount is required',
            'number.max':   'Cancellation fee cannot exceed ₹500',
        }),

    description: Joi.string().trim().max(500).optional(),
});

// ─── Referral Bonus ───────────────────────────────────────────────────────────
export const referralBonusSchema = Joi.object({
    user_id: Joi.number().integer().positive().required()
        .messages({ 'any.required': 'user_id is required' }),

    amount: Joi.number().positive().min(1).max(500).precision(2).required()
        .messages({ 'any.required': 'Amount is required' }),

    description: Joi.string().trim().max(500).optional(),
});

// ─── Withdrawal ───────────────────────────────────────────────────────────────
export const withdrawalSchema = Joi.object({
    amount: Joi.number().positive().min(100).max(50000).precision(2).required()
        .messages({
            'number.min':   'Minimum withdrawal is ₹100',
            'number.max':   'Maximum withdrawal is ₹50,000',
            'any.required': 'Amount is required',
        }),

    bank_account_number: Joi.string().min(9).max(18).required()
        .messages({ 'any.required': 'Bank account number is required' }),

    ifsc_code: Joi.string().uppercase().length(11).required()
        .messages({ 'any.required': 'IFSC code is required' }),

    description: Joi.string().trim().max(500).optional(),
});

// ─── Transaction Filters ──────────────────────────────────────────────────────
export const transactionFilterSchema = Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(20),
    offset: Joi.number().integer().min(0).default(0),

    type: Joi.string().valid('credit', 'debit').optional(),

    category: Joi.string().valid(
        'ride_payment', 'ride_refund', 'wallet_recharge',
        'referral_bonus', 'cancellation_fee', 'withdrawal'
    ).optional(),

    status: Joi.string().valid('pending', 'success', 'failed', 'refunded').optional(),

    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).optional()
        .messages({ 'date.min': 'endDate must be after startDate' }),
});

// ─── Validation Middleware Factory ────────────────────────────────────────────
export const validate = (schema, source = 'body') => (req, res, next) => {
    const data = source === 'query' ? req.query : req.body;

    const { error, value } = schema.validate(data, {
        abortEarly: false,   // show all errors at once
        stripUnknown: true,  // remove unknown fields
    });

    if (error) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: error.details.map((d) => ({
                field:   d.path.join('.'),
                message: d.message,
            })),
        });
    }

    if (source === 'query') {
        // Express 5: req.query is a read-only getter, use defineProperty to override
        Object.defineProperty(req, 'query', { value, writable: true, configurable: true });
    } else {
        req.body = value;
    }

    next();
};
