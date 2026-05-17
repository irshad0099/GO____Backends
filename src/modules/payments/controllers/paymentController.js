import logger from '../../../core/logger/logger.js';
import crypto from 'crypto';
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
    initiateDriverPayout,
} from '../services/paymentService.js';
import { getPaymentOrderByGatewayOrderId, updatePaymentOrderStatus } from '../repositories/payment.Repository.js';
import { addPaymentPostActionJob } from '../../../infrastructure/queue/payment.queue.js';
import { pool } from '../../../infrastructure/database/postgres.js';
import { sendResponse, sendError } from '../../../core/utils/response.js';
import { ENV } from '../../../config/envConfig.js';

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/v1/payments/orders
//  Create a payment order — Step 1 of payment flow
//  For cash/wallet: auto-confirmed
//  For UPI/card: returns gateway_order_id for Razorpay SDK
// ─────────────────────────────────────────────────────────────────────────────
export const createPaymentOrder = async (req, res) => {
    try {
        const result = await createOrder(req.user.id, req.body);
        return sendResponse(res, 201, result.message || '', result.data ?? result);
    } catch (error) {
        logger.error(`[PaymentController] ${error.message}`);
        return sendError(res, error.statusCode || 500, error.message || 'Internal server error');
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
        return sendResponse(res, 200, result.message || '', result.data ?? result);
    } catch (error) {
        logger.error(`[PaymentController] ${error.message}`);
        return sendError(res, error.statusCode || 500, error.message || 'Internal server error');
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
        return sendResponse(res, 200, result.message || '', result.data ?? result);
    } catch (error) {
        logger.error(`[PaymentController] ${error.message}`);
        return sendError(res, error.statusCode || 500, error.message || 'Internal server error');
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v1/payments/orders/:orderNumber
//  Get a single payment order with all refunds
// ─────────────────────────────────────────────────────────────────────────────
export const getOrder = async (req, res) => {
    try {
        const result = await getOrderDetail(req.user.id, req.params.orderNumber);
        return sendResponse(res, 200, result.message || '', result.data ?? result);
    } catch (error) {
        logger.error(`[PaymentController] ${error.message}`);
        return sendError(res, error.statusCode || 500, error.message || 'Internal server error');
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
        return sendResponse(res, 200, result.message || '', result.data ?? result);
    } catch (error) {
        logger.error(`[PaymentController] ${error.message}`);
        return sendError(res, error.statusCode || 500, error.message || 'Internal server error');
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v1/payments/methods
//  Get all saved cards / UPI IDs of user
// ─────────────────────────────────────────────────────────────────────────────
export const getSavedMethods = async (req, res) => {
    try {
        const result = await fetchSavedMethods(req.user.id);
        return sendResponse(res, 200, result.message || '', result.data ?? result);
    } catch (error) {
        logger.error(`[PaymentController] ${error.message}`);
        return sendError(res, error.statusCode || 500, error.message || 'Internal server error');
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/v1/payments/methods
//  Save a new card / UPI ID (tokenized — never raw card data)
// ─────────────────────────────────────────────────────────────────────────────
export const saveMethod = async (req, res) => {
    try {
        const result = await addSavedMethod(req.user.id, req.body);
        return sendResponse(res, 201, result.message || '', result.data ?? result);
    } catch (error) {
        logger.error(`[PaymentController] ${error.message}`);
        return sendError(res, error.statusCode || 500, error.message || 'Internal server error');
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  DELETE /api/v1/payments/methods/:methodId
//  Remove a saved payment method
// ─────────────────────────────────────────────────────────────────────────────
export const removeMethod = async (req, res) => {
    try {
        const result = await removeSavedMethod(req.user.id, parseInt(req.params.methodId));
        return sendResponse(res, 200, result.message || '', result.data ?? result);
    } catch (error) {
        logger.error(`[PaymentController] ${error.message}`);
        return sendError(res, error.statusCode || 500, error.message || 'Internal server error');
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  PATCH /api/v1/payments/methods/:methodId/default
//  Set a payment method as default
// ─────────────────────────────────────────────────────────────────────────────
export const setDefault = async (req, res) => {
    try {
        const result = await makeDefaultMethod(req.user.id, parseInt(req.params.methodId));
        return sendResponse(res, 200, result.message || '', result.data ?? result);
    } catch (error) {
        logger.error(`[PaymentController] ${error.message}`);
        return sendError(res, error.statusCode || 500, error.message || 'Internal server error');
    }
};

// POST /api/v1/payments/payout  (driver only)
export const requestPayout = async (req, res) => {
    try {
        const { amount, payout_method, upi_id, bank_account_number, ifsc_code } = req.body;
        const result = await initiateDriverPayout(req.user.id, {
            amount: Number(amount),
            payoutMethod: payout_method,
            upiId: upi_id,
            bankAccountNumber: bank_account_number,
            ifscCode: ifsc_code,
        });
        return sendResponse(res, 200, result.message, result);
    } catch (error) {
        logger.error(`[PaymentController] requestPayout: ${error.message}`);
        return sendError(res, error.statusCode || 500, error.message);
    }
};

// POST /api/v1/payments/webhook  (Razorpay server → our server, no auth)
export const handleWebhook = async (req, res) => {
    try {
        const signature = req.headers['x-razorpay-signature'];
        const rawBody   = req.rawBody; // Buffer set by express.json verify callback in app.js

        if (!signature) return res.status(400).json({ error: 'Missing signature' });

        // Verify webhook signature
        const expected = crypto
            .createHmac('sha256', ENV.RAZORPAY_WEBHOOK_SECRET)
            .update(rawBody)
            .digest('hex');

        if (expected !== signature) {
            logger.warn('[Webhook] Invalid signature');
            return res.status(400).json({ error: 'Invalid signature' });
        }

        const event = JSON.parse(rawBody.toString());
        logger.info(`[Webhook] Event: ${event.event}`);

        if (event.event === 'payment.captured' || event.event === 'qr_code.credited') {
            const payment = event.payload.payment.entity;

            const order = await getPaymentOrderByGatewayOrderId(payment.order_id);
            if (order && order.status !== 'success') {
                const client = await pool.connect();
                try {
                    await client.query('BEGIN');
                    const updatedOrder = await updatePaymentOrderStatus(client, order.id, 'success', {
                        gatewayPaymentId: payment.id,
                        paidAt: new Date(),
                    });
                    await client.query('COMMIT');
                    await addPaymentPostActionJob(updatedOrder || order);
                    logger.info(`[Webhook] Payment confirmed | Order: ${order.order_number} | Payment: ${payment.id}`);
                } catch (err) {
                    await client.query('ROLLBACK');
                    logger.error(`[Webhook] DB update failed: ${err.message}`);
                } finally {
                    client.release();
                }
            }
        }

        return res.json({ received: true });
    } catch (error) {
        logger.error(`[Webhook] Error: ${error.message}`);
        return res.status(400).json({ error: error.message });
    }
};
