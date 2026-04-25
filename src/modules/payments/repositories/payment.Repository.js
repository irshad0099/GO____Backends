import { pool } from '../../../infrastructure/database/postgres.js';
import logger from '../../../core/logger/logger.js';

// ─────────────────────────────────────────────────────────────────────────────
//  PAYMENT ORDERS
// ─────────────────────────────────────────────────────────────────────────────

export const createPaymentOrder = async (client, data) => {
    const {
        orderNumber, userId, rideId, amount, currency,
        purpose, paymentMethod, paymentGateway,
        gatewayOrderId, description, metadata, expiresAt,
    } = data;

    const result = await client.query(
        `INSERT INTO payment_orders (
            order_number, user_id, ride_id, amount, currency,
            purpose, payment_method, payment_gateway,
            gateway_order_id, description, metadata,
            status, expires_at, created_at, updated_at
        ) VALUES (
            $1,  $2,  $3,  $4,  $5,
            $6,  $7,  $8,
            $9,  $10, $11,
            'created', $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        ) RETURNING *`,
        [
            orderNumber, userId, rideId || null, amount, currency || 'INR',
            purpose, paymentMethod || null, paymentGateway || null,
            gatewayOrderId || null, description || null,
            JSON.stringify(metadata || {}), expiresAt || null,
        ]
    );
    return result.rows[0];
};

export const getPaymentOrderById = async (orderId, userId = null) => {
    try {
        let query  = `SELECT * FROM payment_orders WHERE id = $1`;
        const params = [orderId];
        if (userId) { query += ` AND user_id = $2`; params.push(userId); }

        const result = await pool.query(query, params);
        return result.rows[0] || null;
    } catch (error) {
        logger.error('getPaymentOrderById error:', error);
        throw error;
    }
};

export const getPaymentOrderByNumber = async (orderNumber, userId = null) => {
    try {
        let query  = `SELECT * FROM payment_orders WHERE order_number = $1`;
        const params = [orderNumber];
        if (userId) { query += ` AND user_id = $2`; params.push(userId); }

        const result = await pool.query(query, params);
        return result.rows[0] || null;
    } catch (error) {
        logger.error('getPaymentOrderByNumber error:', error);
        throw error;
    }
};

export const getPaymentOrderByGatewayOrderId = async (gatewayOrderId) => {
    try {
        const result = await pool.query(
            `SELECT * FROM payment_orders WHERE gateway_order_id = $1`,
            [gatewayOrderId]
        );
        return result.rows[0] || null;
    } catch (error) {
        logger.error('getPaymentOrderByGatewayOrderId error:', error);
        throw error;
    }
};

export const getPaymentOrderByRideId = async (rideId, purpose = 'ride_payment') => {
    try {
        const result = await pool.query(
            `SELECT * FROM payment_orders
             WHERE ride_id = $1 AND purpose = $2 AND status = 'success'
             ORDER BY created_at DESC LIMIT 1`,
            [rideId, purpose]
        );
        return result.rows[0] || null;
    } catch (error) {
        logger.error('getPaymentOrderByRideId error:', error);
        throw error;
    }
};

export const getActivePaymentOrderByRideId = async (rideId, purpose = 'ride_payment') => {
    try {
        const result = await pool.query(
            `SELECT * FROM payment_orders
             WHERE ride_id = $1
               AND purpose = $2
               AND status IN ('created', 'pending', 'attempted')
             ORDER BY created_at DESC LIMIT 1`,
            [rideId, purpose]
        );
        return result.rows[0] || null;
    } catch (error) {
        logger.error('getActivePaymentOrderByRideId error:', error);
        throw error;
    }
};

export const updatePaymentOrderStatus = async (client, orderId, status, extra = {}) => {
    const {
        gatewayPaymentId, gatewaySignature, failureReason, paidAt,
    } = extra;

    const result = await client.query(
        `UPDATE payment_orders
         SET status             = $1,
             gateway_payment_id = COALESCE($3, gateway_payment_id),
             gateway_signature  = COALESCE($4, gateway_signature),
             failure_reason     = COALESCE($5, failure_reason),
             paid_at            = CASE WHEN $1 = 'success' THEN COALESCE($6, CURRENT_TIMESTAMP) ELSE paid_at END,
             updated_at         = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [
            status, orderId,
            gatewayPaymentId || null, gatewaySignature || null,
            failureReason    || null, paidAt           || null,
        ]
    );
    return result.rows[0] || null;
};

export const getUserPaymentOrders = async (userId, filters) => {
    try {
        const { limit = 20, offset = 0, status, purpose } = filters;
        let query  = `SELECT * FROM payment_orders WHERE user_id = $1`;
        const params = [userId];
        let idx = 2;

        if (status)  { query += ` AND status = $${idx++}`;  params.push(status); }
        if (purpose) { query += ` AND purpose = $${idx++}`; params.push(purpose); }

        query += ` ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);
        return result.rows;
    } catch (error) {
        logger.error('getUserPaymentOrders error:', error);
        throw error;
    }
};

export const getUserPaymentOrdersCount = async (userId, filters = {}) => {
    try {
        const { status, purpose } = filters;
        let query  = `SELECT COUNT(*) FROM payment_orders WHERE user_id = $1`;
        const params = [userId];
        let idx = 2;

        if (status)  { query += ` AND status = $${idx++}`;  params.push(status); }
        if (purpose) { query += ` AND purpose = $${idx++}`; params.push(purpose); }

        const result = await pool.query(query, params);
        return parseInt(result.rows[0].count);
    } catch (error) {
        logger.error('getUserPaymentOrdersCount error:', error);
        throw error;
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  PAYMENT REFUNDS
// ─────────────────────────────────────────────────────────────────────────────

export const createPaymentRefund = async (client, data) => {
    const {
        refundNumber, paymentOrderId, userId, rideId,
        amount, reason, status, refundMethod, metadata,
    } = data;

    const result = await client.query(
        `INSERT INTO payment_refunds (
            refund_number, payment_order_id, user_id, ride_id,
            amount, reason, status, refund_method, metadata,
            created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *`,
        [
            refundNumber, paymentOrderId, userId, rideId || null,
            amount, reason || null, status || 'pending',
            refundMethod || 'wallet', JSON.stringify(metadata || {}),
        ]
    );
    return result.rows[0];
};

export const updateRefundStatus = async (client, refundId, status, extra = {}) => {
    const { gatewayRefundId, processedAt } = extra;

    const result = await client.query(
        `UPDATE payment_refunds
         SET status            = $1,
             gateway_refund_id = COALESCE($3, gateway_refund_id),
             processed_at      = CASE WHEN $1 = 'success' THEN COALESCE($4, CURRENT_TIMESTAMP) ELSE processed_at END,
             updated_at        = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [status, refundId, gatewayRefundId || null, processedAt || null]
    );
    return result.rows[0] || null;
};

export const getRefundByPaymentOrderId = async (paymentOrderId) => {
    try {
        const result = await pool.query(
            `SELECT * FROM payment_refunds
             WHERE payment_order_id = $1
             ORDER BY created_at DESC`,
            [paymentOrderId]
        );
        return result.rows;
    } catch (error) {
        logger.error('getRefundByPaymentOrderId error:', error);
        throw error;
    }
};

export const getRefundByRideId = async (rideId) => {
    try {
        const result = await pool.query(
            `SELECT * FROM payment_refunds
             WHERE ride_id = $1 AND status IN ('pending', 'success')
             LIMIT 1`,
            [rideId]
        );
        return result.rows[0] || null;
    } catch (error) {
        logger.error('getRefundByRideId error:', error);
        throw error;
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  SAVED PAYMENT METHODS
// ─────────────────────────────────────────────────────────────────────────────

export const getSavedPaymentMethods = async (userId) => {
    try {
        const result = await pool.query(
            `SELECT * FROM saved_payment_methods
             WHERE user_id = $1 AND is_active = TRUE
             ORDER BY is_default DESC, created_at DESC`,
            [userId]
        );
        return result.rows;
    } catch (error) {
        logger.error('getSavedPaymentMethods error:', error);
        throw error;
    }
};

export const getSavedMethodById = async (methodId, userId) => {
    try {
        const result = await pool.query(
            `SELECT * FROM saved_payment_methods
             WHERE id = $1 AND user_id = $2 AND is_active = TRUE`,
            [methodId, userId]
        );
        return result.rows[0] || null;
    } catch (error) {
        logger.error('getSavedMethodById error:', error);
        throw error;
    }
};

export const savepaymentMethod = async (data) => {
    try {
        const {
            userId, type, cardLast4, cardBrand, cardExpMonth, cardExpYear,
            upiId, gatewayToken, gatewayCustomerId, paymentGateway, isDefault,
        } = data;

        // If setting as default, unset other defaults first
        if (isDefault) {
            await pool.query(
                `UPDATE saved_payment_methods
                 SET is_default = FALSE WHERE user_id = $1`,
                [userId]
            );
        }

        const result = await pool.query(
            `INSERT INTO saved_payment_methods (
                user_id, type,
                card_last4, card_brand, card_exp_month, card_exp_year,
                upi_id, gateway_token, gateway_customer_id,
                payment_gateway, is_default, is_active,
                created_at, updated_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT DO NOTHING
            RETURNING *`,
            [
                userId, type,
                cardLast4 || null, cardBrand || null, cardExpMonth || null, cardExpYear || null,
                upiId || null, gatewayToken, gatewayCustomerId || null,
                paymentGateway || null, isDefault || false,
            ]
        );
        return result.rows[0];
    } catch (error) {
        logger.error('savepaymentMethod error:', error);
        throw error;
    }
};

export const deletePaymentMethod = async (methodId, userId) => {
    try {
        const result = await pool.query(
            `UPDATE saved_payment_methods
             SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND user_id = $2
             RETURNING *`,
            [methodId, userId]
        );
        return result.rows[0] || null;
    } catch (error) {
        logger.error('deletePaymentMethod error:', error);
        throw error;
    }
};

export const setDefaultPaymentMethod = async (methodId, userId) => {
    try {
        // Unset all existing defaults
        await pool.query(
            `UPDATE saved_payment_methods SET is_default = FALSE WHERE user_id = $1`,
            [userId]
        );
        // Set new default
        const result = await pool.query(
            `UPDATE saved_payment_methods
             SET is_default = TRUE, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND user_id = $2 AND is_active = TRUE
             RETURNING *`,
            [methodId, userId]
        );
        return result.rows[0] || null;
    } catch (error) {
        logger.error('setDefaultPaymentMethod error:', error);
        throw error;
    }
};