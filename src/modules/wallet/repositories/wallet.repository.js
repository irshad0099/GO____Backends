import { pool } from '../../../infrastructure/database/postgres.js';
import logger from '../../../core/logger/logger.js';

// ─────────────────────────────────────────────────────────────────────────────
//  WALLET QUERIES
// ─────────────────────────────────────────────────────────────────────────────

export const findWalletByUserId = async (userId) => {
    try {
        const result = await pool.query(
            `SELECT * FROM wallets WHERE user_id = $1`,
            [userId]
        );
        return result.rows[0] || null;
    } catch (error) {
        logger.error('findWalletByUserId error:', error);
        throw error;
    }
};

export const createWallet = async (userId) => {
    try {
        const result = await pool.query(
            `INSERT INTO wallets (user_id, balance, total_credited, total_debited)
             VALUES ($1, 0.00, 0.00, 0.00)
             RETURNING *`,
            [userId]
        );
        return result.rows[0];
    } catch (error) {
        logger.error('createWallet error:', error);
        throw error;
    }
};

// Used inside a DB transaction client — credits balance
export const creditWallet = async (client, userId, amount) => {
    const result = await client.query(
        `UPDATE wallets
         SET balance             = balance + $1,
             total_credited      = total_credited + $1,
             last_transaction_at = CURRENT_TIMESTAMP,
             updated_at          = CURRENT_TIMESTAMP
         WHERE user_id = $2
         RETURNING *`,
        [amount, userId]
    );
    if (!result.rows[0]) throw new Error('Wallet not found');
    return result.rows[0];
};

// Used inside a DB transaction client — debits balance with row-level lock
export const debitWallet = async (client, userId, amount) => {
    // FOR UPDATE locks the row — prevents concurrent double-spend
    const lock = await client.query(
        `SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE`,
        [userId]
    );
    if (!lock.rows[0]) throw new Error('Wallet not found');
    if (parseFloat(lock.rows[0].balance) < parseFloat(amount)) {
        throw new Error('Insufficient balance');
    }

    const result = await client.query(
        `UPDATE wallets
         SET balance             = balance - $1,
             total_debited       = total_debited + $1,
             last_transaction_at = CURRENT_TIMESTAMP,
             updated_at          = CURRENT_TIMESTAMP
         WHERE user_id = $2
         RETURNING *`,
        [amount, userId]
    );
    return result.rows[0];
};

// ─────────────────────────────────────────────────────────────────────────────
//  TRANSACTION QUERIES
// ─────────────────────────────────────────────────────────────────────────────

export const createTransaction = async (client, data) => {
    const {
        transactionNumber,
        userId,
        walletId,
        rideId,
        amount,
        type,               // 'credit' | 'debit'
        category,           // 'ride_payment' | 'ride_refund' | 'wallet_recharge' | 'referral_bonus' | 'cancellation_fee' | 'withdrawal'
        paymentMethod,      // 'cash' | 'card' | 'wallet' | 'upi'
        paymentGateway,     // 'razorpay' | 'stripe' etc.
        gatewayTransactionId,
        status,             // 'pending' | 'success' | 'failed' | 'refunded'
        description,
        metadata,
    } = data;

    const result = await client.query(
        `INSERT INTO transactions (
            transaction_number, user_id, wallet_id, ride_id,
            amount, type, category,
            payment_method, payment_gateway, gateway_transaction_id,
            status, description, metadata,
            created_at, updated_at
        ) VALUES (
            $1,  $2,  $3,  $4,
            $5,  $6,  $7,
            $8,  $9,  $10,
            $11, $12, $13,
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        ) RETURNING *`,
        [
            transactionNumber,
            userId,
            walletId,
            rideId          || null,
            amount,
            type,
            category,
            paymentMethod   || null,
            paymentGateway  || null,
            gatewayTransactionId || null,
            status          || 'pending',
            description     || null,
            JSON.stringify(metadata || {}),
        ]
    );
    return result.rows[0];
};

export const updateTransactionStatus = async (transactionNumber, status) => {
    try {
        const result = await pool.query(
            `UPDATE transactions
             SET status     = $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE transaction_number = $2
             RETURNING *`,
            [status, transactionNumber]
        );
        return result.rows[0] || null;
    } catch (error) {
        logger.error('updateTransactionStatus error:', error);
        throw error;
    }
};

export const getTransactionByNumber = async (transactionNumber, userId) => {
    try {
        const result = await pool.query(
            `SELECT * FROM transactions
             WHERE transaction_number = $1 AND user_id = $2`,
            [transactionNumber, userId]
        );
        return result.rows[0] || null;
    } catch (error) {
        logger.error('getTransactionByNumber error:', error);
        throw error;
    }
};

export const getTransactionByRideId = async (rideId, type) => {
    try {
        const result = await pool.query(
            `SELECT * FROM transactions
             WHERE ride_id = $1 AND type = $2 AND status = 'success'
             ORDER BY created_at DESC
             LIMIT 1`,
            [rideId, type]
        );
        return result.rows[0] || null;
    } catch (error) {
        logger.error('getTransactionByRideId error:', error);
        throw error;
    }
};

export const getRefundByRideId = async (rideId) => {
    try {
        const result = await pool.query(
            `SELECT * FROM transactions
             WHERE ride_id = $1
               AND category = 'ride_refund'
               AND status IN ('success', 'pending')
             LIMIT 1`,
            [rideId]
        );
        return result.rows[0] || null;
    } catch (error) {
        logger.error('getRefundByRideId error:', error);
        throw error;
    }
};

export const getWalletTransactions = async (userId, filters) => {
    try {
        const { limit = 20, offset = 0, type, category, status, startDate, endDate } = filters;

        let query  = `SELECT * FROM transactions WHERE user_id = $1`;
        const params = [userId];
        let idx = 2;

        if (type)      { query += ` AND type = $${idx++}`;        params.push(type); }
        if (category)  { query += ` AND category = $${idx++}`;    params.push(category); }
        if (status)    { query += ` AND status = $${idx++}`;      params.push(status); }
        if (startDate) { query += ` AND created_at >= $${idx++}`; params.push(startDate); }
        if (endDate)   { query += ` AND created_at <= $${idx++}`; params.push(endDate); }

        query += ` ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);
        return result.rows;
    } catch (error) {
        logger.error('getWalletTransactions error:', error);
        throw error;
    }
};

export const getTransactionCount = async (userId, filters = {}) => {
    try {
        const { type, category, status, startDate, endDate } = filters;

        let query  = `SELECT COUNT(*) FROM transactions WHERE user_id = $1`;
        const params = [userId];
        let idx = 2;

        if (type)      { query += ` AND type = $${idx++}`;        params.push(type); }
        if (category)  { query += ` AND category = $${idx++}`;    params.push(category); }
        if (status)    { query += ` AND status = $${idx++}`;      params.push(status); }
        if (startDate) { query += ` AND created_at >= $${idx++}`; params.push(startDate); }
        if (endDate)   { query += ` AND created_at <= $${idx++}`; params.push(endDate); }

        const result = await pool.query(query, params);
        return parseInt(result.rows[0].count);
    } catch (error) {
        logger.error('getTransactionCount error:', error);
        throw error;
    }
};
