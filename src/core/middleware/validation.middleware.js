import { validationResult } from 'express-validator';
import { ValidationError } from '../errors/ApiError.js';

export const validate = (validations) => {
    return async (req, res, next) => {
        // Run all validations
        await Promise.all(validations.map(validation => validation.run(req)));

        const errors = validationResult(req);
            console.log('Validation errors:', errors.array()); // Debugging log
        if (errors.isEmpty()) {
            return next();
        }
        
        const formattedErrors = errors.array().map(error => ({
            field: error.path,
            message: error.msg
        }));

        const primaryMessage = formattedErrors[0]?.message || 'Validation failed';
        throw new ValidationError(primaryMessage, formattedErrors);
    };
};