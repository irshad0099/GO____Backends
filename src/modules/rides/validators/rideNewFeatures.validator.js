import Joi from 'joi';

// ─── Ride Cancellation (Passenger) ──────────────────────────────────────────
export const cancelRideSchema = Joi.object({
    reason_code: Joi.string().valid(
        'driver_too_far', 'changed_plan', 'found_another_ride',
        'driver_asked_to_cancel', 'wrong_pickup', 'long_wait',
        'personal_emergency', 'other'
    ).required(),
    reason_text: Joi.string().trim().max(500).optional(),
    driver_distance_meters: Joi.number().integer().min(0).default(0),
});

// ─── Ride OTP Verify ────────────────────────────────────────────────────────
export const verifyOtpSchema = Joi.object({
    otp: Joi.string().length(4).required()
        .messages({ 'any.required': 'OTP is required', 'string.length': 'OTP must be 4 digits' }),
});

// ─── Schedule Ride ──────────────────────────────────────────────────────────
export const scheduleRideSchema = Joi.object({
    pickup_latitude: Joi.number().min(-90).max(90).required(),
    pickup_longitude: Joi.number().min(-180).max(180).required(),
    pickup_address: Joi.string().trim().min(5).max(500).required(),
    pickup_location_name: Joi.string().trim().max(255).optional(),
    dropoff_latitude: Joi.number().min(-90).max(90).required(),
    dropoff_longitude: Joi.number().min(-180).max(180).required(),
    dropoff_address: Joi.string().trim().min(5).max(500).required(),
    dropoff_location_name: Joi.string().trim().max(255).optional(),
    vehicle_type: Joi.string().valid('bike', 'auto', 'car').required(),
    payment_method: Joi.string().valid('cash', 'card', 'wallet', 'upi').default('cash'),
    pickup_time: Joi.date().iso().required()
        .messages({ 'any.required': 'pickup_time is required' }),
    estimated_fare: Joi.number().positive().optional(),
});

// ─── Support Ticket ─────────────────────────────────────────────────────────
export const createTicketSchema = Joi.object({
    ride_id: Joi.number().integer().positive().optional(),
    category: Joi.string().valid(
        'ride_issue', 'payment_issue', 'driver_behavior',
        'safety_concern', 'app_bug', 'account', 'other'
    ).required(),
    subject: Joi.string().trim().min(5).max(200).required(),
    description: Joi.string().trim().min(10).max(2000).required(),
});

export const replyTicketSchema = Joi.object({
    message: Joi.string().trim().min(1).max(2000).required(),
    attachments: Joi.array().items(Joi.string().max(500)).max(5).optional(),
});

export const validate = (schema, source = 'body') => (req, res, next) => {
    const data = source === 'query' ? req.query : req.body;
    const { error, value } = schema.validate(data, { abortEarly: false, stripUnknown: true });
    if (error) {
        return res.status(400).json({
            success: false, message: 'Validation failed',
            errors: error.details.map(d => ({ field: d.path.join('.'), message: d.message })),
        });
    }
    // Express 5: req.query is a read-only getter, use defineProperty to override
    if (source === 'query') Object.defineProperty(req, 'query', { value, writable: true, configurable: true }); else req.body = value;
    next();
};
