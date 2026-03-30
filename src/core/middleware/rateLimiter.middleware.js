import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { ENV } from '../../config/envConfig.js';

// ─────────────────────────────────────────────────────────────────────────────
//  EXISTING LIMITERS (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

// General API rate limiter
export const apiLimiter = rateLimit({
    windowMs: ENV.RATE_LIMIT_WINDOW,
    max: ENV.RATE_LIMIT_MAX,
    message: {
        success: false,
        message: 'Too many requests, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Stricter limiter for auth routes
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,                    // 5 attempts per window
    skipSuccessfulRequests: true,
    message: {
        success: false,
        message: 'Too many authentication attempts, please try again after 15 minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// OTP request limiter
export const otpLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,                    // 3 OTP requests per hour
    message: {
        success: false,
        message: 'Too many OTP requests, please try again after an hour.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// ─────────────────────────────────────────────────────────────────────────────
//  WALLET LIMITERS
// ─────────────────────────────────────────────────────────────────────────────

// Wallet recharge — 10 recharges per hour per user
export const walletRechargeLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    keyGenerator: (req) => `recharge_${req.user?.id || ipKeyGenerator(req)}`,
    message: {
        success: false,
        message: 'Too many recharge attempts. You can recharge up to 10 times per hour.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Ride payment — 30 per hour per user
export const ridePaymentLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 30,
    keyGenerator: (req) => `ride_pay_${req.user?.id || ipKeyGenerator(req)}`,
    message: {
        success: false,
        message: 'Too many payment requests. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Withdrawal — max 3 per day per user
export const withdrawalLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    max: 3,
    keyGenerator: (req) => `withdraw_${req.user?.id || ipKeyGenerator(req)}`,
    skipSuccessfulRequests: false,
    message: {
        success: false,
        message: 'Withdrawal limit reached. Maximum 3 withdrawals allowed per day.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Refund — max 5 per hour (admin/system route)
export const refundLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    keyGenerator: (req) => `refund_${req.user?.id || ipKeyGenerator(req)}`,
    message: {
        success: false,
        message: 'Too many refund requests. Maximum 5 refunds per hour.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Transfer — max 5 per hour per user
export const transferLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    keyGenerator: (req) => `transfer_${req.user?.id || ipKeyGenerator(req)}`,
    message: {
        success: false,
        message: 'Too many transfer attempts. Maximum 5 transfers per hour.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Wallet balance/details check — 60 per minute
export const walletReadLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60,
    keyGenerator: (req) => `wallet_read_${req.user?.id || ipKeyGenerator(req)}`,
    message: {
        success: false,
        message: 'Too many requests. Please slow down.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Transaction history — 30 per minute per user
export const transactionHistoryLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    keyGenerator: (req) => `txn_history_${req.user?.id || ipKeyGenerator(req)}`,
    message: {
        success: false,
        message: 'Too many requests for transaction history. Please try again shortly.'
    },
    standardHeaders: true,
    legacyHeaders: false
});
