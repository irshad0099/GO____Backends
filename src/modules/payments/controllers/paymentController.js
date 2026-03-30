import logger from '../../../core/logger/logger.js';
import {
    createOrder,
    verifyAndConfirmPayment,
    processRefund,
    getOrderDetail,
    getPaymentHistory,
    fetchSavedMethods,
    addSavedMethod,
    removeSavedMethod,
    makeDefaultMethod,
} from '../services/paymentService.js';

// ─── Error handler ────────────────────────────────────────────────────────────

const handleError = (res, error) => {
    logger.error(`[PaymentController] ${error.message}`);
    const status = error.statusCode || 500;
    return res.status(status).json({
        success: false,
        message: error.message || 'Internal server error',
    });
};

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/v1/payments/orders
//  Create a payment order — Step 1 of payment flow
//  For cash/wallet: auto-confirmed
//  For UPI/card: returns gateway_order_id for Razorpay SDK
// ─────────────────────────────────────────────────────────────────────────────
export const createPaymentOrder = async (req, res) => {
    try {
        const result = await createOrder(req.user.id, req.body);
        return res.status(201).json(result);
    } catch (error) {
        return handleError(res, error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/v1/payments/verify
//  Verify Razorpay payment — Step 2 (called from frontend after gateway success)
//  Verifies signature, marks order success, credits wallet if recharge
// ─────────────────────────────────────────────────────────────────────────────
export const verifyPayment = async (req, res) => {
    try {
        const result = await verifyAndConfirmPayment(req.body);
        return res.status(200).json(result);
    } catch (error) {
        return handleError(res, error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/v1/payments/refund
//  Initiate refund — admin/system only
//  refund_method: 'wallet' (instant) | 'source' (3-5 days)
// ─────────────────────────────────────────────────────────────────────────────
export const initiateRefund = async (req, res) => {
    try {
        const userId = req.body.user_id || req.user.id; // admin passes user_id in body
        const result = await processRefund(userId, req.body);
        return res.status(200).json(result);
    } catch (error) {
        return handleError(res, error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v1/payments/orders/:orderNumber
//  Get a single payment order with all refunds
// ─────────────────────────────────────────────────────────────────────────────
export const getOrder = async (req, res) => {
    try {
        const result = await getOrderDetail(req.user.id, req.params.orderNumber);
        return res.status(200).json(result);
    } catch (error) {
        return handleError(res, error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v1/payments/history
//  Paginated payment history with filters
// ─────────────────────────────────────────────────────────────────────────────
export const getHistory = async (req, res) => {
    try {
        const { limit = 20, offset = 0, status, purpose } = req.query;
        const result = await getPaymentHistory(req.user.id, {
            limit:   parseInt(limit),
            offset:  parseInt(offset),
            status,
            purpose,
        });
        return res.status(200).json(result);
    } catch (error) {
        return handleError(res, error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v1/payments/methods
//  Get all saved cards / UPI IDs of user
// ─────────────────────────────────────────────────────────────────────────────
export const getSavedMethods = async (req, res) => {
    try {
        const result = await fetchSavedMethods(req.user.id);
        return res.status(200).json(result);
    } catch (error) {
        return handleError(res, error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/v1/payments/methods
//  Save a new card / UPI ID (tokenized — never raw card data)
// ─────────────────────────────────────────────────────────────────────────────
export const saveMethod = async (req, res) => {
    try {
        const result = await addSavedMethod(req.user.id, req.body);
        return res.status(201).json(result);
    } catch (error) {
        return handleError(res, error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  DELETE /api/v1/payments/methods/:methodId
//  Remove a saved payment method
// ─────────────────────────────────────────────────────────────────────────────
export const removeMethod = async (req, res) => {
    try {
        const result = await removeSavedMethod(req.user.id, parseInt(req.params.methodId));
        return res.status(200).json(result);
    } catch (error) {
        return handleError(res, error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  PATCH /api/v1/payments/methods/:methodId/default
//  Set a payment method as default
// ─────────────────────────────────────────────────────────────────────────────
export const setDefault = async (req, res) => {
    try {
        const result = await makeDefaultMethod(req.user.id, parseInt(req.params.methodId));
        return res.status(200).json(result);
    } catch (error) {
        return handleError(res, error);
    }
};