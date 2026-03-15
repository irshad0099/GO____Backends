import { body } from 'express-validator';

export const validateVehicleType = () => {
    return body('vehicleType')
        .notEmpty().withMessage('Vehicle type is required')
        .isIn(['bike', 'auto', 'car']).withMessage('Vehicle type must be bike, auto, or car');
};

export const validateVehicleNumber = () => {
    return body('vehicleNumber')
        .notEmpty().withMessage('Vehicle number is required')
        .matches(/^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}$/).withMessage('Please enter a valid Indian vehicle number (e.g., MH12AB1234)');
};

export const validateVehicleModel = () => {
    return body('vehicleModel')
        .notEmpty().withMessage('Vehicle model is required')
        .isLength({ min: 2, max: 100 }).withMessage('Vehicle model must be between 2 and 100 characters');
};

export const validateVehicleColor = () => {
    return body('vehicleColor')
        .notEmpty().withMessage('Vehicle color is required')
        .isLength({ min: 2, max: 50 }).withMessage('Vehicle color must be between 2 and 50 characters');
};

export const validateLicenseNumber = () => {
    return body('licenseNumber')
        .notEmpty().withMessage('License number is required')
        .matches(/^[A-Z]{2}[0-9]{13}$/).withMessage('Please enter a valid Indian driving license number');
};

export const validateLicenseExpiry = () => {
    return body('licenseExpiry')
        .notEmpty().withMessage('License expiry date is required')
        .isDate().withMessage('Please enter a valid date')
        .custom((value) => {
            const expiryDate = new Date(value);
            const today = new Date();
            if (expiryDate <= today) {
                throw new Error('License expiry date must be in the future');
            }
            return true;
        });
};

export const driverRegistrationValidators = [
    validateVehicleType(),
    validateVehicleNumber(),
    validateVehicleModel(),
    validateVehicleColor(),
    validateLicenseNumber(),
    validateLicenseExpiry()
];

export const updateLocationValidators = [
    body('latitude')
        .notEmpty().withMessage('Latitude is required')
        .isFloat({ min: -90, max: 90 }).withMessage('Please enter a valid latitude'),
    body('longitude')
        .notEmpty().withMessage('Longitude is required')
        .isFloat({ min: -180, max: 180 }).withMessage('Please enter a valid longitude')
];