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
import { authenticate }             from '../../../core/middleware/auth.middleware';
import { requireRole }              from '../../../middlewares/roleMiddleware.js';
import {
    walletRechargeLimiter,
    ridePaymentLimiter,
    withdrawalLimiter,
    refundLimiter,
    walletReadLimiter,
    transactionHistoryLimiter,
} from '../../../middlewares/rateLimiter.js';

const router = express.Router();

// All wallet routes require authentication
router.use(authenticate);

// ─────────────────────────────────────────────────────────────────────────────
//  WALLET INFO
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/v1/wallet
router.get('/',        walletReadLimiter, getWallet);

// GET /api/v1/wallet/balance
router.get('/balance', walletReadLimiter, getBalance);

// ─────────────────────────────────────────────────────────────────────────────
//  MONEY IN
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/v1/wallet/recharge
router.post(
    '/recharge',
    walletRechargeLimiter,
    validate(walletRechargeSchema),
    recharge
);

// POST /api/v1/wallet/referral-bonus  (admin / system only)
router.post(
    '/referral-bonus',
    requireRole(['admin', 'system']),
    validate(referralBonusSchema),
    referralBonus
);

// ─────────────────────────────────────────────────────────────────────────────
//  MONEY OUT
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/v1/wallet/pay-ride
router.post(
    '/pay-ride',
    ridePaymentLimiter,
    validate(ridePaymentSchema),
    ridePayment
);

// POST /api/v1/wallet/cancellation-fee
router.post(
    '/cancellation-fee',
    ridePaymentLimiter,
    validate(cancellationFeeSchema),
    cancellationFee
);

// POST /api/v1/wallet/withdraw
router.post(
    '/withdraw',
    withdrawalLimiter,
    validate(withdrawalSchema),
    withdraw
);

// ─────────────────────────────────────────────────────────────────────────────
//  REFUNDS  (admin / system only)
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/v1/wallet/refund
router.post(
    '/refund',
    requireRole(['admin', 'system']),
    refundLimiter,
    validate(rideRefundSchema),
    refund
);

// ─────────────────────────────────────────────────────────────────────────────
//  TRANSACTIONS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/v1/wallet/transactions
router.get(
    '/transactions',
    transactionHistoryLimiter,
    validate(transactionFilterSchema, 'query'),
    getTransactions
);

// GET /api/v1/wallet/transactions/:txnNumber
router.get(
    '/transactions/:txnNumber',
    transactionHistoryLimiter,
    getTransaction
);

export default router;
