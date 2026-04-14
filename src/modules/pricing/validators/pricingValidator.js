import Joi from 'joi';

const vehicleTypes = ['bike', 'auto', 'cab'];

// ─── Fare Estimate (before booking) ──────────────────────────────────────────
export const fareEstimateSchema = Joi.object({
    vehicle_type:       Joi.string().valid(...vehicleTypes).required()
        .messages({ 'any.required': 'vehicle_type is required', 'any.only': 'vehicle_type must be bike, auto, or cab' }),
    distance_km:        Joi.number().positive().max(200).required()
        .messages({ 'any.required': 'distance_km is required' }),
    estimated_minutes:  Joi.number().positive().max(300).required()
        .messages({ 'any.required': 'estimated_minutes is required' }),
    ride_requests:      Joi.number().integer().min(0).optional(),
    available_drivers:  Joi.number().integer().min(0).optional(),
});

// ─── All Vehicles Estimate ────────────────────────────────────────────────────
export const allEstimatesSchema = Joi.object({
    distance_km:        Joi.number().positive().max(200).required(),
    estimated_minutes:  Joi.number().positive().max(300).required(),
    ride_requests:      Joi.number().integer().min(0).optional(),
    available_drivers:  Joi.number().integer().min(0).optional(),
});

// ─── Final Fare (after ride) ──────────────────────────────────────────────────
export const finalFareSchema = Joi.object({
    vehicle_type:         Joi.string().valid(...vehicleTypes).required(),
    actual_distance_km:   Joi.number().positive().max(200).required(),
    estimated_minutes:    Joi.number().positive().max(300).required(),
    actual_minutes:       Joi.number().positive().max(300).required(),
    waiting_minutes:      Joi.number().min(0).default(0),
    pickup_distance_km:   Joi.number().min(0).default(0),
    driver_daily_rides:   Joi.number().integer().min(1).default(1),
    ride_requests:        Joi.number().integer().min(0).optional(),
    available_drivers:    Joi.number().integer().min(0).optional(),
});

// ─── Cancellation Fee ─────────────────────────────────────────────────────────
export const cancellationFeeSchema = Joi.object({
    driver_distance_meters: Joi.number().min(0).required()
        .messages({ 'any.required': 'driver_distance_meters is required' }),
});

// ─── Surge Info ───────────────────────────────────────────────────────────────
export const surgeInfoSchema = Joi.object({
    ride_requests:     Joi.number().integer().min(0).required(),
    available_drivers: Joi.number().integer().min(0).required(),
});

import { sendError } from '../../../core/utils/response.js';

// ─── Validate middleware ──────────────────────────────────────────────────────
export const validate = (schema, source = 'body') => (req, res, next) => {
    const data = source === 'query' ? req.query : req.body;
    const { error, value } = schema.validate(data, { abortEarly: false, stripUnknown: true });

    if (error) {
        return sendError(res, 400, 'Validation failed', error.details.map(d => ({ field: d.path.join('.'), message: d.message })));
    }

    // Express 5: req.query is a read-only getter, use defineProperty to override
    if (source === 'query') Object.defineProperty(req, 'query', { value, writable: true, configurable: true });
    else req.body = value;
    next();
};