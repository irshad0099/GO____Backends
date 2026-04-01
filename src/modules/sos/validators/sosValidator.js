import Joi from 'joi';

export const triggerSosSchema = Joi.object({
    ride_id: Joi.number().integer().positive().required(),
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
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
    if (source === 'query') req.query = value; else req.body = value;
    next();
};
