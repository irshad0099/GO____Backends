import logger from '../../../core/logger/logger.js';
import {
    getWalletDetails,
    getWalletBalance,
    rechargeWallet,
    payForRide,
    processRideRefund,
    chargeCancellationFee,
    creditReferralBonus,
    withdrawFromWallet,
    getTransactionHistory,
    getTransactionDetail,
} from '../services/walletService.js';
import { sendResponse, sendError } from '../../../core/utils/response.js';

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v1/wallet
//  Full wallet info — balance, totals, timestamps
// ─────────────────────────────────────────────────────────────────────────────
export const getWallet = async (req, res) => {
    try {
        const result = await getWalletDetails(req.user.id);
        return sendResponse(res, 200, result.message || '', result.data ?? result);
    } catch (error) {
        logger.error(`[WalletController] ${error.message}`);
        return sendError(res, error.statusCode || 500, error.message || 'Internal server error');
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v1/wallet/balance
//  Lightweight — called before ride booking to check if wallet can pay
// ─────────────────────────────────────────────────────────────────────────────
export const getBalance = async (req, res) => {
    try {
        const result = await getWalletBalance(req.user.id);
        return sendResponse(res, 200, result.message || '', result.data ?? result);
    } catch (error) {
        logger.error(`[WalletController] ${error.message}`);
        return sendError(res, error.statusCode || 500, error.message || 'Internal server error');
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/v1/wallet/recharge
//  Top-up wallet — call this AFTER payment gateway webhook confirms
// ─────────────────────────────────────────────────────────────────────────────
export const recharge = async (req, res) => {
    try {
        const result = await rechargeWallet(req.user.id, req.body);
        return sendResponse(res, 200, result.message || '', result.data ?? result);
    } catch (error) {
        logger.error(`[WalletController] ${error.message}`);
        return sendError(res, error.statusCode || 500, error.message || 'Internal server error');
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/v1/wallet/pay-ride
//  Deduct wallet for completed ride — called by ride-service internally
// ─────────────────────────────────────────────────────────────────────────────
export const ridePayment = async (req, res) => {
    try {
        const result = await payForRide(req.user.id, req.body);
        return sendResponse(res, 200, result.message || '', result.data ?? result);
    } catch (error) {
        logger.error(`[WalletController] ${error.message}`);
        return sendError(res, error.statusCode || 500, error.message || 'Internal server error');
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/v1/wallet/refund
//  Refund for cancelled ride / driver no-show / overcharge
//  Restricted to admin / system role
// ─────────────────────────────────────────────────────────────────────────────
export const refund = async (req, res) => {
    try {
        // Admin can pass target user_id in body; user refunds use their own id
        const userId = req.body.user_id || req.user.id;
        const result = await processRideRefund(userId, req.body);
        return sendResponse(res, 200, result.message || '', result.data ?? result);
    } catch (error) {
        logger.error(`[WalletController] ${error.message}`);
        return sendError(res, error.statusCode || 500, error.message || 'Internal server error');
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/v1/wallet/cancellation-fee
//  Charge cancellation fee — called by ride-service
// ─────────────────────────────────────────────────────────────────────────────
export const cancellationFee = async (req, res) => {
    try {
        const result = await chargeCancellationFee(req.user.id, req.body);
        return sendResponse(res, 200, result.message || '', result.data ?? result);
    } catch (error) {
        logger.error(`[WalletController] ${error.message}`);
        return sendError(res, error.statusCode || 500, error.message || 'Internal server error');
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/v1/wallet/referral-bonus
//  Credit referral bonus — admin / system only
// ─────────────────────────────────────────────────────────────────────────────
export const referralBonus = async (req, res) => {
    try {
        const userId = req.body.user_id || req.user.id;
        const result = await creditReferralBonus(userId, req.body);
        return sendResponse(res, 200, result.message || '', result.data ?? result);
    } catch (error) {
        logger.error(`[WalletController] ${error.message}`);
        return sendError(res, error.statusCode || 500, error.message || 'Internal server error');
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/v1/wallet/withdraw
//  Withdraw balance to bank account
// ─────────────────────────────────────────────────────────────────────────────
export const withdraw = async (req, res) => {
    try {
        const result = await withdrawFromWallet(req.user.id, req.body);
        return sendResponse(res, 200, result.message || '', result.data ?? result);
    } catch (error) {
        logger.error(`[WalletController] ${error.message}`);
        return sendError(res, error.statusCode || 500, error.message || 'Internal server error');
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v1/wallet/transactions
//  Paginated history with filters
// ─────────────────────────────────────────────────────────────────────────────
export const getTransactions = async (req, res) => {
    try {
        const { limit = 20, offset = 0, type, category, status, startDate, endDate } = req.query;

        const result = await getTransactionHistory(req.user.id, {
            limit:     parseInt(limit),
            offset:    parseInt(offset),
            type,
            category,
            status,
            startDate,
            endDate,
        });

        return sendResponse(res, 200, result.message || '', result.data ?? result);
    } catch (error) {
        logger.error(`[WalletController] ${error.message}`);
        return sendError(res, error.statusCode || 500, error.message || 'Internal server error');
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v1/wallet/transactions/:txnNumber
//  Single transaction detail
// ─────────────────────────────────────────────────────────────────────────────
export const getTransaction = async (req, res) => {
    try {
        const result = await getTransactionDetail(req.user.id, req.params.txnNumber);
        return sendResponse(res, 200, result.message || '', result.data ?? result);
    } catch (error) {
        logger.error(`[WalletController] ${error.message}`);
        return sendError(res, error.statusCode || 500, error.message || 'Internal server error');
    }
};
