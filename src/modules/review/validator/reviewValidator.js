import Joi from 'joi';

const DRIVER_TAGS     = ['clean_car','safe_driving','polite_driver','on_time_pickup','good_navigation','ac_working','smooth_ride'];
const PASSENGER_TAGS  = ['polite','on_time','clean_seating','followed_route','no_complaints'];
const ALL_TAGS        = [...DRIVER_TAGS, ...PASSENGER_TAGS];

// ─── Submit Review ────────────────────────────────────────────────────────────
export const submitReviewSchema = Joi.object({
    ride_id: Joi.number().integer().positive().required()
        .messages({ 'any.required': 'ride_id is required' }),

    reviewee_id: Joi.number().integer().positive().required()
        .messages({ 'any.required': 'reviewee_id is required' }),

    reviewer_type: Joi.string().valid('passenger', 'driver').required()
        .messages({ 'any.required': 'reviewer_type is required' }),

    reviewee_type: Joi.string().valid('passenger', 'driver').required()
        .messages({ 'any.required': 'reviewee_type is required' }),

    rating: Joi.number().min(1).max(5).precision(1).required()
        .messages({
            'number.min':   'Rating must be at least 1',
            'number.max':   'Rating cannot exceed 5',
            'any.required': 'rating is required',
        }),

    comment: Joi.string().trim().min(3).max(500).optional()
        .messages({ 'string.min': 'Comment must be at least 3 characters' }),

    tags: Joi.array().items(Joi.string().valid(...ALL_TAGS)).max(5).optional()
        .messages({ 'array.max': 'You can select up to 5 tags only' }),

    tip_amount: Joi.number().min(0).max(500).precision(2).optional()
        .messages({ 'number.max': 'Tip cannot exceed ₹500' }),
});

// ─── Respond to Review ────────────────────────────────────────────────────────
export const respondSchema = Joi.object({
    review_id: Joi.number().integer().positive().required()
        .messages({ 'any.required': 'review_id is required' }),

    response: Joi.string().trim().min(3).max(500).required()
        .messages({
            'string.min':   'Response must be at least 3 characters',
            'any.required': 'response is required',
        }),
});

// ─── Review List Filters ──────────────────────────────────────────────────────
export const reviewFilterSchema = Joi.object({
    limit:  Joi.number().integer().min(1).max(50).default(10),
    offset: Joi.number().integer().min(0).default(0),
    rating: Joi.number().valid(1, 2, 3, 4, 5).optional(),
});

// ─── Admin Flagged List ───────────────────────────────────────────────────────
export const adminFilterSchema = Joi.object({
    limit:  Joi.number().integer().min(1).max(100).default(20),
    offset: Joi.number().integer().min(0).default(0),
});

// ─── Validation Middleware ────────────────────────────────────────────────────
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