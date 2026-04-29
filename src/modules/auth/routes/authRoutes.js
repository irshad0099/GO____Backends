


import express from 'express';
import * as controller from '../controllers/authController.js';
import { authenticate } from '../../../core/middleware/auth.middleware.js';
import { validate } from '../../../core/middleware/validation.middleware.js';
import { authLimiter, otpLimiter } from '../../../core/middleware/rateLimiter.middleware.js';
import * as validator from '../validators/authValidator.js';


const router = express.Router();

// Public routes with rate limiting
router.post(
    '/signup',
    authLimiter,
    validate(validator.signupValidators),
    controller.signup
);

router.post(
    '/verify-signup',
    authLimiter,
    validate(validator.verifySignupValidators),
    controller.verifySignup
);

router.post(
    '/signin',
    authLimiter,
    validate(validator.signinValidators),
    controller.signin
);

router.post(
    '/verify-signin',
    authLimiter,
    validate(validator.verifySigninValidators),
    controller.verifySignin
);

router.post(
    '/refresh-token',
    validate(validator.refreshTokenValidators),
    controller.refreshToken
);

// Protected routes
router.post(
    '/logout',
    authenticate,
    validate(validator.logoutValidators),
    controller.logout
);

router.get(
    '/me',
    authenticate,
    controller.me
);

router.post('/fcm-token', authenticate, controller.updateFcmToken);
export default router;