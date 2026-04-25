import { body, param, query } from 'express-validator';

// ==================== QUERY VALIDATORS (for GET /nearby-drivers) ====================
export const validateVehicleTypeQuery = () => {
    return query('vehicleType')
        .notEmpty().withMessage('Vehicle type is required')
        .isIn(['bike', 'auto', 'car', 'xl', 'premium', 'luxury']).withMessage('Vehicle type must be bike, auto, or car');
};

export const validateLatitudeQuery = (field = 'latitude') => {
    return query(field)
        .notEmpty().withMessage(`${field} is required`)
        .isFloat({ min: -90, max: 90 }).withMessage(`Invalid ${field}`);
};

export const validateLongitudeQuery = (field = 'longitude') => {
    return query(field)
        .notEmpty().withMessage(`${field} is required`)
        .isFloat({ min: -180, max: 180 }).withMessage(`Invalid ${field}`);
};

// ==================== LOCATION VALIDATORS (for body) ====================
export const validateLocation = (field) => {
    return body(field)
        .notEmpty().withMessage(`${field} is required`)
        .isFloat({ min: -90, max: 90 }).withMessage(`Invalid ${field} value`);
};

export const validateLongitude = (field) => {
    return body(field)
        .notEmpty().withMessage(`${field} is required`)
        .isFloat({ min: -180, max: 180 }).withMessage(`Invalid ${field} value`);
};

// ==================== VEHICLE TYPE VALIDATOR ====================
export const validateVehicleType = () => {
    return body('vehicleType')
        .notEmpty().withMessage('Vehicle type is required')
        .isIn(['bike', 'auto', 'car', 'xl', 'premium', 'luxury']).withMessage('Vehicle type must be bike, auto, or car');
};

// ==================== ADDRESS VALIDATOR ====================
export const validateAddress = (field) => {
    return body(field)
        .notEmpty().withMessage(`${field} is required`)
        .isString().withMessage(`${field} must be a string`)
        .isLength({ min: 5, max: 500 }).withMessage(`${field} must be between 5 and 500 characters`);
};

// ==================== RIDE REQUEST VALIDATORS (array) ====================
// export const requestRideValidators = [
//     validateVehicleType(),
//     body('pickupLatitude').notEmpty().isFloat({ min: -90, max: 90 }),
//     body('pickupLongitude').notEmpty().isFloat({ min: -180, max: 180 }),
//     body('pickupAddress').notEmpty().isString().isLength({ min: 5, max: 500 }),
//     body('pickupLocationName').optional().isString().isLength({ max: 255 }),
//     body('dropoffLatitude').notEmpty().isFloat({ min: -90, max: 90 }),
//     body('dropoffLongitude').notEmpty().isFloat({ min: -180, max: 180 }),
//     body('dropoffAddress').notEmpty().isString().isLength({ min: 5, max: 500 }),
//     body('dropoffLocationName').optional().isString().isLength({ max: 255 }),
//     body('paymentMethod').optional().isIn(['cash', 'card', 'wallet', 'upi']).default('cash'),
//     body('couponCode').optional().isString().isLength({ min: 2, max: 50 }).withMessage('Invalid coupon code')
// ];


export const requestRideValidators = [
    validateVehicleType(),
    body('pickupLatitude').optional().isFloat({ min: -90, max: 90 }).withMessage('Invalid pickupLatitude'),
    body('pickupLongitude').optional().isFloat({ min: -180, max: 180 }).withMessage('Invalid pickupLongitude'),
    body('pickupAddress').notEmpty().isString().isLength({ min: 5, max: 500 }),
    body('pickupLocationName').optional().isString().isLength({ max: 255 }),
    body('dropoffLatitude').optional().isFloat({ min: -90, max: 90 }).withMessage('Invalid dropoffLatitude'),
    body('dropoffLongitude').optional().isFloat({ min: -180, max: 180 }).withMessage('Invalid dropoffLongitude'),
    body('dropoffAddress').notEmpty().isString().isLength({ min: 5, max: 500 }),
    body('dropoffLocationName').optional().isString().isLength({ max: 255 }),
    body('paymentMethod').optional().isIn(['cash', 'card', 'wallet', 'upi']).default('cash'),
    body('couponCode').optional().isString().isLength({ min: 2, max: 50 }).withMessage('Invalid coupon code')
];

// ==================== ACCEPT RIDE VALIDATORS ====================
export const acceptRideValidators = [
    param('rideId').isInt().withMessage('Invalid ride ID')
];

// ==================== UPDATE RIDE STATUS VALIDATORS ====================
export const updateRideStatusValidators = [
    param('rideId').isInt().withMessage('Invalid ride ID'),
    body('status').isIn([
        'driver_arrived', 'in_progress', 'completed', 'cancelled'
    ]).withMessage('Invalid status'),
    body('cancellationReason').optional().isString().isLength({ max: 500 })
];

// ==================== RIDE HISTORY VALIDATORS ====================
export const getRideHistoryValidators = [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('status').optional().isIn([
        'requested', 'driver_assigned', 'driver_arrived', 
        'in_progress', 'completed', 'cancelled'
    ]).withMessage('Invalid status filter')
];

// ==================== RATE RIDE VALIDATORS ====================
export const rateRideValidators = [
    param('rideId').isInt().withMessage('Invalid ride ID'),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    body('review').optional().isString().isLength({ max: 500 }).withMessage('Review too long')
];