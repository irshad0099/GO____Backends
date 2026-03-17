import express from 'express';

import {
    getWallet,
    getBalance,
    recharge,
    ridePayment,
    refund,
    cancellationFee,
    referralBonus,
    withdraw,
    getTransactions,
    getTransaction,
} from '../controllers/walletController.js';

import {
    walletRechargeSchema,
    ridePaymentSchema,
    rideRefundSchema,
    cancellationFeeSchema,
    referralBonusSchema,
    withdrawalSchema,
    transactionFilterSchema,
    validate,
} from '../validators/walletValidator.js';

// ─── Middlewares ──────────────────────────────────────────────────────────────
import { authenticate } from '../../../core/middleware/auth.middleware.js';          // ✅ .js added
import { requireRole } from '../../../core/middleware/roleMiddleware.js';            // ✅ .js added
import {
    walletRechargeLimiter,
    ridePaymentLimiter,
    withdrawalLimiter,
    refundLimiter,
    walletReadLimiter,
    transactionHistoryLimiter,
} from '../../../core/middleware/rateLimiter.middleware.js';                                         // ✅ ensure this path is correct

const router = express.Router();

// All wallet routes require authentication
router.use(authenticate);

// ─────────────────────────────────────────────────────────────────────────────
//  WALLET INFO
// ─────────────────────────────────────────────────────────────────────────────

router.get('/',        walletReadLimiter, getWallet);
router.get('/balance', walletReadLimiter, getBalance);

// ─────────────────────────────────────────────────────────────────────────────
//  MONEY IN
// ─────────────────────────────────────────────────────────────────────────────

router.post('/recharge', walletRechargeLimiter, validate(walletRechargeSchema), recharge);
router.post('/referral-bonus', requireRole(['admin', 'system']), validate(referralBonusSchema), referralBonus);

// ─────────────────────────────────────────────────────────────────────────────
//  MONEY OUT
// ─────────────────────────────────────────────────────────────────────────────

router.post('/pay-ride', ridePaymentLimiter, validate(ridePaymentSchema), ridePayment);
router.post('/cancellation-fee', ridePaymentLimiter, validate(cancellationFeeSchema), cancellationFee);
router.post('/withdraw', withdrawalLimiter, validate(withdrawalSchema), withdraw);

// ─────────────────────────────────────────────────────────────────────────────
//  REFUNDS  (admin / system only)
// ─────────────────────────────────────────────────────────────────────────────

router.post('/refund', requireRole(['admin', 'system']), refundLimiter, validate(rideRefundSchema), refund);

// ─────────────────────────────────────────────────────────────────────────────
//  TRANSACTIONS
// ─────────────────────────────────────────────────────────────────────────────

router.get('/transactions', transactionHistoryLimiter, validate(transactionFilterSchema, 'query'), getTransactions);
router.get('/transactions/:txnNumber', transactionHistoryLimiter, getTransaction);

export default router;