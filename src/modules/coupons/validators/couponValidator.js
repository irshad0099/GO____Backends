import Joi from 'joi';

export const applyCouponSchema = Joi.object({
    code: Joi.string().trim().uppercase().min(3).max(30).required(),
    ride_amount: Joi.number().positive().min(1).required(),
    vehicle_type: Joi.string().valid('bike', 'auto', 'car').optional(),
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
