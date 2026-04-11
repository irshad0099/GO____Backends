import Joi from 'joi';

// ─────────────────────────────────────────────────────────────────────────────
//  RIDE REJECTION
// ─────────────────────────────────────────────────────────────────────────────
export const rejectRideSchema = Joi.object({
    reason_code: Joi.string()
        .valid('too_far', 'wrong_direction', 'low_fare', 'bad_area', 'busy', 'ending_shift', 'other')
        .required()
        .messages({ 'any.required': 'reason_code is required' }),

    reason_text: Joi.string().trim().max(500).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
//  DESTINATION MODE
// ─────────────────────────────────────────────────────────────────────────────
export const setDestinationSchema = Joi.object({
    latitude: Joi.number().min(-90).max(90).required()
        .messages({ 'any.required': 'Destination latitude is required' }),

    longitude: Joi.number().min(-180).max(180).required()
        .messages({ 'any.required': 'Destination longitude is required' }),

    address: Joi.string().trim().min(5).max(500).required()
        .messages({ 'any.required': 'Destination address is required' }),

    radius_km: Joi.number().min(1).max(10).default(3.0),
});

// ─────────────────────────────────────────────────────────────────────────────
//  CASH DEPOSIT
// ─────────────────────────────────────────────────────────────────────────────
export const submitDepositSchema = Joi.object({
    amount: Joi.number().positive().min(1).max(50000).precision(2).required()
        .messages({
            'any.required': 'Amount is required',
            'number.min':   'Minimum deposit is ₹1',
        }),

    deposit_method: Joi.string()
        .valid('upi', 'bank_transfer', 'cash_center')
        .required()
        .messages({ 'any.required': 'deposit_method is required' }),

    reference_number: Joi.string().max(100).optional(),

    deposit_proof: Joi.string().max(500).optional(),  // S3 URL
});

// ─────────────────────────────────────────────────────────────────────────────
//  PENALTY APPEAL
// ─────────────────────────────────────────────────────────────────────────────
export const appealSchema = Joi.object({
    reason: Joi.string().trim().min(10).max(500).required()
        .messages({
            'any.required': 'Appeal reason is required',
            'string.min':   'Appeal reason must be at least 10 characters',
        }),
});

// ─────────────────────────────────────────────────────────────────────────────
//  EARNINGS STATEMENT (date range)
// ─────────────────────────────────────────────────────────────────────────────
export const earningsStatementSchema = Joi.object({
    from: Joi.date().iso().required()
        .messages({ 'any.required': 'from date is required' }),

    to: Joi.date().iso().min(Joi.ref('from')).required()
        .messages({
            'any.required': 'to date is required',
            'date.min':     'to must be after from',
        }),
});

// ─────────────────────────────────────────────────────────────────────────────
//  PAGINATION (common for list endpoints)
// ─────────────────────────────────────────────────────────────────────────────
export const paginationSchema = Joi.object({
    limit:  Joi.number().integer().min(1).max(100).default(20),
    offset: Joi.number().integer().min(0).default(0),
});

// ─────────────────────────────────────────────────────────────────────────────
//  VALIDATE MIDDLEWARE FACTORY
// ─────────────────────────────────────────────────────────────────────────────
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
            errors: error.details.map(d => ({
                field:   d.path.join('.'),
                message: d.message,
            })),
        });
    }

    // AB — fix
if (source === 'query') {
    Object.assign(req.query, value);
} else {
    req.body = value;
}

    next();
};
