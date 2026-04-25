import Joi from 'joi';
import { sendValidationError } from '../../../core/utils/response.js';

export const triggerSosSchema = Joi.object({
    ride_id: Joi.number().integer().positive().required(),
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
});

export const validate = (schema, source = 'body') => (req, res, next) => {
    const data = source === 'query' ? req.query : req.body;
    const { error, value } = schema.validate(data, { abortEarly: false, stripUnknown: true });
    if (error) {
        return sendValidationError(res, error.details.map(d => ({ field: d.path.join('.'), message: d.message })));
    }
    // Express 5: req.query is a read-only getter, use defineProperty to override
    if (source === 'query') Object.defineProperty(req, 'query', { value, writable: true, configurable: true }); else req.body = value;
    next();
};
