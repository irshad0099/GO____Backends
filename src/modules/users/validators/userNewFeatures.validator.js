import Joi from 'joi';
import { sendError } from '../../../core/utils/response.js';

// ─── Saved Address ──────────────────────────────────────────────────────────
export const addAddressSchema = Joi.object({
    label: Joi.string().trim().min(2).max(50).required(),
    type: Joi.string().valid('home', 'work', 'other').default('other'),
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    address: Joi.string().trim().min(5).max(500).required(),
    landmark: Joi.string().trim().max(255).optional(),
    place_id: Joi.string().max(255).optional(),
    is_default: Joi.boolean().default(false),
});

export const updateAddressSchema = Joi.object({
    label: Joi.string().trim().min(2).max(50).optional(),
    type: Joi.string().valid('home', 'work', 'other').optional(),
    latitude: Joi.number().min(-90).max(90).optional(),
    longitude: Joi.number().min(-180).max(180).optional(),
    address: Joi.string().trim().min(5).max(500).optional(),
    landmark: Joi.string().trim().max(255).optional(),
    place_id: Joi.string().max(255).optional(),
});

// ─── Emergency Contact ──────────────────────────────────────────────────────
export const addContactSchema = Joi.object({
    name: Joi.string().trim().min(2).max(100).required(),
    phone: Joi.string().pattern(/^[6-9]\d{9}$/).required()
        .messages({ 'string.pattern.base': 'Enter a valid 10-digit Indian phone number' }),
    relationship: Joi.string().trim().max(50).optional(),
});

// ─── Referral ───────────────────────────────────────────────────────────────
export const applyReferralSchema = Joi.object({
    code: Joi.string().trim().min(4).max(20).required()
        .messages({ 'any.required': 'Referral code is required' }),
});

// ─── Validate ───────────────────────────────────────────────────────────────
export const validate = (schema, source = 'body') => (req, res, next) => {
    const data = source === 'query' ? req.query : req.body;
    const { error, value } = schema.validate(data, { abortEarly: false, stripUnknown: true });
    if (error) {
        return sendError(res, 400, 'Validation failed', error.details.map(d => ({ field: d.path.join('.'), message: d.message })));
    }
    // Express 5: req.query is a read-only getter, use defineProperty to override
    if (source === 'query') Object.defineProperty(req, 'query', { value, writable: true, configurable: true }); else req.body = value;
    next();
};
