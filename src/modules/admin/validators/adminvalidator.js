import Joi from 'joi';

// ─── Common list filters ──────────────────────────────────────────────────────
const paginationSchema = {
    limit:  Joi.number().integer().min(1).max(100).default(20),
    offset: Joi.number().integer().min(0).default(0),
};

// ─── User filters ─────────────────────────────────────────────────────────────
export const userFilterSchema = Joi.object({
    ...paginationSchema,
    search: Joi.string().trim().max(100).optional(),
    status: Joi.string().valid('active', 'inactive').optional(),
});

// ─── Driver filters ───────────────────────────────────────────────────────────
export const driverFilterSchema = Joi.object({
    ...paginationSchema,
    search:      Joi.string().trim().max(100).optional(),
    status:      Joi.string().valid('online', 'offline').optional(),
    is_verified: Joi.boolean().optional(),
});

// ─── Ride filters ─────────────────────────────────────────────────────────────
export const rideFilterSchema = Joi.object({
    ...paginationSchema,
    status:       Joi.string().valid('requested','accepted','ongoing','completed','cancelled').optional(),
    vehicle_type: Joi.string().valid('bike', 'auto', 'cab').optional(),
    start_date:   Joi.date().iso().optional(),
    end_date:     Joi.date().iso().optional(),
});

// ─── Transaction filters ──────────────────────────────────────────────────────
export const transactionFilterSchema = Joi.object({
    ...paginationSchema,
    type:       Joi.string().valid('credit', 'debit').optional(),
    category:   Joi.string().valid('ride_payment','ride_refund','wallet_recharge','referral_bonus','cancellation_fee','withdrawal').optional(),
    status:     Joi.string().valid('pending','success','failed','refunded').optional(),
    start_date: Joi.date().iso().optional(),
    end_date:   Joi.date().iso().optional(),
});

// ─── Toggle user/driver status ────────────────────────────────────────────────
export const toggleStatusSchema = Joi.object({
    is_active: Joi.boolean().required()
        .messages({ 'any.required': 'is_active (true/false) is required' }),
});

// ─── Verify driver ────────────────────────────────────────────────────────────
export const verifyDriverSchema = Joi.object({
    is_verified: Joi.boolean().required()
        .messages({ 'any.required': 'is_verified (true/false) is required' }),
});

// ─── Revenue analytics ────────────────────────────────────────────────────────
export const analyticsSchema = Joi.object({
    days: Joi.number().integer().min(1).max(365).default(7),
});

// ─── Validation middleware ────────────────────────────────────────────────────
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
            errors:  error.details.map(d => ({
                field:   d.path.join('.'),
                message: d.message,
            })),
        });
    }

    if (source === 'query') req.query = value;
    else req.body = value;
    next();
};