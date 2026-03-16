import { body } from 'express-validator';

export const validatePhone = () => {
    return body('phone')
        .notEmpty().withMessage('Phone number is required')
        .matches(/^[6-9]\d{9}$/).withMessage('Please enter a valid 10-digit Indian phone number');
};

export const validateOTP = () => {
    return body('otp')
        .notEmpty().withMessage('OTP is required')
        .isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
        .isNumeric().withMessage('OTP must contain only numbers');
};

export const validateRefreshToken = () => {
    return body('refreshToken')
        .notEmpty().withMessage('Refresh token is required')
        .isString().withMessage('Invalid refresh token format');
};

export const signupValidators = [
    validatePhone(),
    body('email')
        .optional()
        .isEmail().withMessage('Please enter a valid email')
        .normalizeEmail(),
    body('fullName')
        .optional()
        .isString().withMessage('Full name must be a string')
        .isLength({ min: 2, max: 100 }).withMessage('Full name must be between 2 and 100 characters'),
    body('role')
        .notEmpty().withMessage('Role is required')
        .isIn(['passenger', 'driver', 'admin'])
        .withMessage('Role must be passenger, driver or admin')

];

export const signinValidators = [
    validatePhone(),
    body('role')
        .notEmpty().withMessage('Role is required')
        .isIn(['passenger', 'driver', 'admin'])
        .withMessage('Role must be passenger, driver or admin')
];

export const verifySignupValidators = [
    validatePhone(),
    validateOTP(),
    body('email')
        .optional()
        .isEmail().withMessage('Please enter a valid email'),
    body('fullName')
        .optional()
        .isString().withMessage('Full name must be a string')
        .isLength({ min: 2, max: 100 }).withMessage('Full name must be between 2 and 100 characters'),
    body('role')
        .notEmpty().withMessage('Role is required')
        .isIn(['passenger', 'driver', 'admin'])
        .withMessage('Role must be passenger, driver or admin')
];

export const verifySigninValidators = [
    validatePhone(),
    validateOTP(),
    body('role')
        .notEmpty().withMessage('Role is required')
        .isIn(['passenger', 'driver', 'admin'])
        .withMessage('Role must be passenger, driver or admin')

];

export const logoutValidators = [
    validateRefreshToken()
];

export const refreshTokenValidators = [
    validateRefreshToken()
];