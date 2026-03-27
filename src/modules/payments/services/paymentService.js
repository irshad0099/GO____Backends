import crypto from 'crypto';
import { pool } from '../../../infrastructure/database/postgres.js';
import logger from '../../../core/logger/logger.js';
import {
    createPaymentOrder,
    getPaymentOrderById,
    getPaymentOrderByNumber,
    getPaymentOrderByGatewayOrderId,
    getPaymentOrderByRideId,
    updatePaymentOrderStatus,
    getUserPaymentOrders,
    getUserPaymentOrdersCount,
    createPaymentRefund,
    updateRefundStatus,
    getRefundByPaymentOrderId,
    getRefundByRideId,
    getSavedPaymentMethods,
    getSavedMethodById,
    savepaymentMethod,
    deletePaymentMethod,
    setDefaultPaymentMethod,
} from '../repositories/payment.Repository.js';

// ─── Wallet service integration ───────────────────────────────────────────────
// Import your wallet service to credit/debit when payment settles
import {
    rechargeWallet,
    payForRide,
    processRideRefund,
} from '../../wallet/services/walletService.js';

// ─────────────────────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────────────────────

const ORDER_EXPIRY_MINUTES = 15; // payment link expires in 15 min (like Razorpay)

const PURPOSE_LABELS = {
    ride_payment:       'Ride Payment',
    wallet_recharge:    'Wallet Recharge',
    subscription:       'Subscription Purchase',
    cancellation_fee:   'Cancellation Fee',
    tip:                'Driver Tip',
};

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

const generateOrderNumber = () => {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `PAY${date}${rand}`;
};

const generateRefundNumber = () => {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `REF${date}${rand}`;
};

// Verify Razorpay webhook signature
const verifyRazorpaySignature = (gatewayOrderId, gatewayPaymentId, signature) => {
    const secret   = process.env.RAZORPAY_KEY_SECRET;
    const body     = `${gatewayOrderId}|${gatewayPaymentId}`;
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
    return expected === signature;
};

const formatOrder = (o) => ({
    orderId:           o.id,
    orderNumber:       o.order_number,
    amount:            parseFloat(o.amount),
    currency:          o.currency,
    purpose:           o.purpose,
    purposeLabel:      PURPOSE_LABELS[o.purpose] || o.purpose,
    paymentMethod:     o.payment_method    || null,
    paymentGateway:    o.payment_gateway   || null,
    gatewayOrderId:    o.gateway_order_id  || null,
    gatewayPaymentId:  o.gateway_payment_id || null,
    status:            o.status,
    failureReason:     o.failure_reason    || null,
    description:       o.description       || null,
    rideId:            o.ride_id           || null,
    paidAt:            o.paid_at           || null,
    expiresAt:         o.expires_at        || null,
    createdAt:         o.created_at,
});

const formatRefund = (r) => ({
    refundId:          r.id,
    refundNumber:      r.refund_number,
    paymentOrderId:    r.payment_order_id,
    amount:            parseFloat(r.amount),
    reason:            r.reason           || null,
    refundMethod:      r.refund_method,
    status:            r.status,
    gatewayRefundId:   r.gateway_refund_id || null,
    processedAt:       r.processed_at      || null,
    createdAt:         r.created_at,
});

const formatSavedMethod = (m) => ({
    methodId:          m.id,
    type:              m.type,
    cardLast4:         m.card_last4        || null,
    cardBrand:         m.card_brand        || null,
    cardExpMonth:      m.card_exp_month    || null,
    cardExpYear:       m.card_exp_year     || null,
    upiId:             m.upi_id            || null,
    paymentGateway:    m.payment_gateway   || null,
    isDefault:         m.is_default,
    createdAt:         m.created_at,
});

// ─────────────────────────────────────────────────────────────────────────────
//  1. Create Payment Order
//     Step 1 of payment flow — create order in DB + call gateway
// ─────────────────────────────────────────────────────────────────────────────

export const createOrder = async (userId, {
    amount,
    purpose,
    payment_method,
    payment_gateway,
    ride_id,
    description,
    metadata,
}) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // For cash rides — no gateway needed, auto-success
        if (payment_method === 'cash') {
            const order = await createPaymentOrder(client, {
                orderNumber:    generateOrderNumber(),
                userId,
                rideId:         ride_id || null,
                amount,
                purpose,
                paymentMethod:  'cash',
                paymentGateway: null,
                gatewayOrderId: null,
                description:    description || PURPOSE_LABELS[purpose],
                metadata,
                expiresAt:      null,
            });

            // Auto-confirm cash payment
            const updated = await updatePaymentOrderStatus(client, order.id, 'success', {
                paidAt: new Date(),
            });

            await client.query('COMMIT');

            logger.info(`[Payment] Cash order created & confirmed | User: ${userId} | Order: ${order.order_number}`);

            return {
                success:        true,
                message:        'Cash payment recorded',
                data:           { order: formatOrder(updated), requiresGateway: false },
            };
        }

        // For wallet payments — deduct wallet directly
        if (payment_method === 'wallet') {
            const order = await createPaymentOrder(client, {
                orderNumber:    generateOrderNumber(),
                userId,
                rideId:         ride_id || null,
                amount,
                purpose,
                paymentMethod:  'wallet',
                paymentGateway: null,
                gatewayOrderId: null,
                description:    description || PURPOSE_LABELS[purpose],
                metadata,
                expiresAt:      null,
            });

            await client.query('COMMIT');

            // Now process the wallet deduction based on purpose
            await processWalletPayment(userId, { order, purpose, ride_id, amount });

            // Re-fetch updated order
            const updatedOrder = await getPaymentOrderById(order.id);
            await updatePaymentOrderStatus(client, order.id, 'success', { paidAt: new Date() });

            logger.info(`[Payment] Wallet order confirmed | User: ${userId} | Order: ${order.order_number}`);

            return {
                success:        true,
                message:        'Payment successful',
                data:           { order: formatOrder(updatedOrder), requiresGateway: false },
            };
        }

        // For UPI / card — create gateway order (Razorpay/Stripe)
        const expiresAt = new Date(Date.now() + ORDER_EXPIRY_MINUTES * 60 * 1000);

        // TODO: Call Razorpay/Stripe API to create order and get gateway_order_id
        // const gatewayOrder = await razorpayService.createOrder({ amount: amount * 100, currency: 'INR' });
        // const gatewayOrderId = gatewayOrder.id;
        const gatewayOrderId = `gw_order_${Date.now()}`; // placeholder — replace with real gateway call

        const order = await createPaymentOrder(client, {
            orderNumber:    generateOrderNumber(),
            userId,
            rideId:         ride_id || null,
            amount,
            purpose,
            paymentMethod:  payment_method,
            paymentGateway: payment_gateway || 'razorpay',
            gatewayOrderId,
            description:    description || PURPOSE_LABELS[purpose],
            metadata:       { ...metadata },
            expiresAt,
        });

        await client.query('COMMIT');

        logger.info(`[Payment] Gateway order created | User: ${userId} | Order: ${order.order_number} | GW: ${gatewayOrderId}`);

        return {
            success:        true,
            message:        'Payment order created',
            data: {
                order:           formatOrder(order),
                requiresGateway: true,
                gatewayOrderId,                  // send to frontend for Razorpay SDK
                amount:          amount * 100,   // Razorpay uses paise
                currency:        'INR',
                expiresAt,
            },
        };
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error(`[Payment] createOrder error | User: ${userId}:`, error);
        throw error;
    } finally {
        client.release();
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  2. Verify & Confirm Payment (Razorpay Webhook / Frontend callback)
//     Step 2 — gateway confirms payment, we verify signature & settle
// ─────────────────────────────────────────────────────────────────────────────

export const verifyAndConfirmPayment = async ({
    gateway_order_id,
    gateway_payment_id,
    gateway_signature,
}) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Find the order
        const order = await getPaymentOrderByGatewayOrderId(gateway_order_id);
        if (!order) {
            const err = new Error('Payment order not found');
            err.statusCode = 404;
            throw err;
        }

        if (order.status === 'success') {
            await client.query('ROLLBACK');
            return {
                success: true,
                message: 'Payment already confirmed',
                data:    { order: formatOrder(order), alreadyConfirmed: true },
            };
        }

        // Verify Razorpay signature
        const isValid = verifyRazorpaySignature(gateway_order_id, gateway_payment_id, gateway_signature);
        if (!isValid) {
            await updatePaymentOrderStatus(client, order.id, 'failed', {
                failureReason: 'Signature verification failed',
            });
            await client.query('COMMIT');

            const err = new Error('Payment verification failed. Invalid signature.');
            err.statusCode = 400;
            throw err;
        }

        // Mark payment success
        const updatedOrder = await updatePaymentOrderStatus(client, order.id, 'success', {
            gatewayPaymentId: gateway_payment_id,
            gatewaySignature: gateway_signature,
            paidAt:           new Date(),
        });

        await client.query('COMMIT');

        // Post-payment actions (wallet recharge, subscription activate etc.)
        await handlePostPaymentActions(order);

        logger.info(`[Payment] Verified & confirmed | Order: ${order.order_number} | GW: ${gateway_payment_id}`);

        return {
            success: true,
            message: 'Payment successful',
            data:    { order: formatOrder(updatedOrder) },
        };
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error(`[Payment] verifyAndConfirmPayment error:`, error);
        throw error;
    } finally {
        client.release();
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  3. Process Refund
//     Full or partial — back to source or to wallet
// ─────────────────────────────────────────────────────────────────────────────

export const processRefund = async (userId, {
    order_number,
    amount,
    reason,
    refund_method,  // 'wallet' (instant) or 'source' (3-5 days)
    ride_id,
}) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const order = await getPaymentOrderByNumber(order_number, userId);
        if (!order) {
            const err = new Error('Payment order not found');
            err.statusCode = 404;
            throw err;
        }

        if (order.status !== 'success') {
            const err = new Error(`Cannot refund a payment with status: ${order.status}`);
            err.statusCode = 400;
            throw err;
        }

        // Refund amount cannot exceed original
        if (amount > parseFloat(order.amount)) {
            const err = new Error(`Refund amount ₹${amount} exceeds paid amount ₹${order.amount}`);
            err.statusCode = 400;
            throw err;
        }

        // Idempotency — no double refund
        const existing = await getRefundByRideId(ride_id || order.ride_id);
        if (existing) {
            await client.query('ROLLBACK');
            return {
                success: true,
                message: 'Refund already processed',
                data:    { refund: formatRefund(existing), alreadyRefunded: true },
            };
        }

        // Create refund record
        const refund = await createPaymentRefund(client, {
            refundNumber:   generateRefundNumber(),
            paymentOrderId: order.id,
            userId,
            rideId:         ride_id || order.ride_id || null,
            amount,
            reason,
            status:         'pending',
            refundMethod:   refund_method || 'wallet',
            metadata:       { originalOrderNumber: order_number },
        });

        // Update order status
        const isFullRefund   = amount >= parseFloat(order.amount);
        const newOrderStatus = isFullRefund ? 'refunded' : 'partially_refunded';
        await updatePaymentOrderStatus(client, order.id, newOrderStatus, {});

        await client.query('COMMIT');

        // Instant wallet refund
        if (refund_method === 'wallet' || !refund_method) {
            await processRideRefund(userId, {
                ride_id:  ride_id || order.ride_id,
                amount,
                reason,
            });
            // Mark refund success
            const updated = await updateRefundStatus(client, refund.id, 'success', {
                processedAt: new Date(),
            });

            logger.info(`[Payment] Wallet refund ₹${amount} | User: ${userId} | Refund: ${refund.refund_number}`);

            return {
                success: true,
                message: `₹${amount} refunded to wallet instantly`,
                data:    { refund: formatRefund(updated || refund) },
            };
        }

        // Source refund (bank/card) — initiate via gateway
        // TODO: await razorpayService.createRefund({ payment_id: order.gateway_payment_id, amount: amount * 100 });
        logger.info(`[Payment] Source refund initiated ₹${amount} | User: ${userId} | Refund: ${refund.refund_number}`);

        return {
            success: true,
            message: `Refund of ₹${amount} initiated. Will reflect in 3-5 business days.`,
            data:    { refund: formatRefund(refund) },
        };
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error(`[Payment] processRefund error | User: ${userId}:`, error);
        throw error;
    } finally {
        client.release();
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  4. Get payment order detail
// ─────────────────────────────────────────────────────────────────────────────

export const getOrderDetail = async (userId, orderNumber) => {
    const order = await getPaymentOrderByNumber(orderNumber, userId);
    if (!order) {
        const err = new Error('Payment order not found');
        err.statusCode = 404;
        throw err;
    }

    const refunds = await getRefundByPaymentOrderId(order.id);

    return {
        success: true,
        data: {
            order:   formatOrder(order),
            refunds: refunds.map(formatRefund),
        },
    };
};

// ─────────────────────────────────────────────────────────────────────────────
//  5. Get payment history (paginated)
// ─────────────────────────────────────────────────────────────────────────────

export const getPaymentHistory = async (userId, filters) => {
    const [orders, total] = await Promise.all([
        getUserPaymentOrders(userId, filters),
        getUserPaymentOrdersCount(userId, filters),
    ]);

    return {
        success: true,
        data: {
            payments: orders.map(formatOrder),
            pagination: {
                total,
                limit:   filters.limit,
                offset:  filters.offset,
                hasMore: filters.offset + filters.limit < total,
            },
        },
    };
};

// ─────────────────────────────────────────────────────────────────────────────
//  6. Saved Payment Methods
// ─────────────────────────────────────────────────────────────────────────────

export const fetchSavedMethods = async (userId) => {
    const methods = await getSavedPaymentMethods(userId);
    return {
        success: true,
        data:    methods.map(formatSavedMethod),
    };
};

export const addSavedMethod = async (userId, data) => {
    const method = await savepaymentMethod({ userId, ...data });
    if (!method) {
        const err = new Error('This payment method is already saved');
        err.statusCode = 409;
        throw err;
    }
    return {
        success: true,
        message: 'Payment method saved successfully',
        data:    formatSavedMethod(method),
    };
};

export const removeSavedMethod = async (userId, methodId) => {
    const method = await deletePaymentMethod(methodId, userId);
    if (!method) {
        const err = new Error('Payment method not found');
        err.statusCode = 404;
        throw err;
    }
    return { success: true, message: 'Payment method removed' };
};

export const makeDefaultMethod = async (userId, methodId) => {
    const method = await setDefaultPaymentMethod(methodId, userId);
    if (!method) {
        const err = new Error('Payment method not found');
        err.statusCode = 404;
        throw err;
    }
    return {
        success: true,
        message: 'Default payment method updated',
        data:    formatSavedMethod(method),
    };
};

// ─────────────────────────────────────────────────────────────────────────────
//  Internal Helpers
// ─────────────────────────────────────────────────────────────────────────────

// Called after wallet payment order created
const processWalletPayment = async (userId, { order, purpose, ride_id, amount }) => {
    try {
        if (purpose === 'ride_payment' && ride_id) {
            await payForRide(userId, { ride_id, amount, description: 'Ride payment via wallet' });
        } else if (purpose === 'wallet_recharge') {
            // wallet_recharge via wallet is circular — should not happen
            logger.warn(`[Payment] wallet_recharge via wallet method — skipping`);
        }
        // subscription, tip etc. handled by their respective services
    } catch (error) {
        logger.error('[Payment] processWalletPayment error:', error);
        throw error;
    }
};

// Called after gateway confirms payment
const handlePostPaymentActions = async (order) => {
    try {
        if (order.purpose === 'wallet_recharge') {
            await rechargeWallet(order.user_id, {
                amount:           parseFloat(order.amount),
                payment_method:   order.payment_method,
                payment_gateway:  order.payment_gateway,
                gateway_transaction_id: order.gateway_payment_id,
                description:      'Wallet recharge',
            });
        }
        // ride_payment via gateway: handled by ride-service on completion
        // subscription: handled by subscription-service on confirmation
    } catch (error) {
        logger.error(`[Payment] handlePostPaymentActions error | Order: ${order.order_number}:`, error);
        // Non-critical — log but don't throw (payment already confirmed)
    }
};