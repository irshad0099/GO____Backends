import { db } from '../../../infrastructure/database/postgres.js';
import logger from '../../../core/logger/logger.js';

// ==================== Subscription Plans ====================
export const findAllPlans = async (onlyActive = true) => {
    try {
        let query = `SELECT * FROM subscription_plans`;
        const params = [];
        if (onlyActive) {
            query += ` WHERE is_active = true`;
        }
        query += ` ORDER BY price`;
        const result = await db.query(query, params);
        return result.rows;
    } catch (error) {
        logger.error('Find all plans repository error:', error);
        throw error;
    }
};

export const findPlanBySlug = async (slug) => {
    try {
        const result = await db.query(
            `SELECT * FROM subscription_plans WHERE slug = $1 AND is_active = true`,
            [slug]
        );
        return result.rows[0];
    } catch (error) {
        logger.error('Find plan by slug repository error:', error);
        throw error;
    }
};

export const findPlanById = async (planId) => {
    try {
        const result = await db.query(
            `SELECT * FROM subscription_plans WHERE id = $1`,
            [planId]
        );
        return result.rows[0];
    } catch (error) {
        logger.error('Find plan by ID repository error:', error);
        throw error;
    }
};

export const createPlan = async (planData) => {
    try {
        const {
            name, slug, description, price, duration_days,
            ride_discount_percent, free_rides_per_month,
            priority_booking, cancellation_waiver, surge_protection
        } = planData;
        const result = await db.query(
            `INSERT INTO subscription_plans 
                (name, slug, description, price, duration_days, 
                 ride_discount_percent, free_rides_per_month,
                 priority_booking, cancellation_waiver, surge_protection)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *`,
            [name, slug, description, price, duration_days,
             ride_discount_percent, free_rides_per_month,
             priority_booking, cancellation_waiver, surge_protection]
        );
        return result.rows[0];
    } catch (error) {
        logger.error('Create plan repository error:', error);
        throw error;
    }
};

export const updatePlan = async (planId, updates) => {
    try {
        const setClause = [];
        const values = [];
        let idx = 1;
        Object.entries(updates).forEach(([key, value]) => {
            if (value !== undefined) {
                setClause.push(`${key} = $${idx}`);
                values.push(value);
                idx++;
            }
        });
        values.push(planId);
        const query = `
            UPDATE subscription_plans
            SET ${setClause.join(', ')}, updated_at = NOW()
            WHERE id = $${idx}
            RETURNING *
        `;
        const result = await db.query(query, values);
        return result.rows[0];
    } catch (error) {
        logger.error('Update plan repository error:', error);
        throw error;
    }
};

// ==================== User Subscriptions ====================
export const findActiveSubscriptionByUser = async (userId) => {
    try {
        const result = await db.query(
            `SELECT us.*, sp.*
             FROM user_subscriptions us
             JOIN subscription_plans sp ON us.plan_id = sp.id
             WHERE us.user_id = $1 
               AND us.status = 'active' 
               AND us.expires_at > NOW()
             ORDER BY us.expires_at DESC
             LIMIT 1`,
            [userId]
        );
        return result.rows[0];
    } catch (error) {
        logger.error('Find active subscription by user repository error:', error);
        throw error;
    }
};

export const findUserSubscriptions = async (userId) => {
    try {
        const result = await db.query(
            `SELECT us.*, sp.*
             FROM user_subscriptions us
             JOIN subscription_plans sp ON us.plan_id = sp.id
             WHERE us.user_id = $1
             ORDER BY us.created_at DESC`,
            [userId]
        );
        return result.rows;
    } catch (error) {
        logger.error('Find user subscriptions repository error:', error);
        throw error;
    }
};

export const createUserSubscription = async (data) => {
    try {
        const {
            user_id, plan_id, started_at, expires_at,
            auto_renew, payment_method, transaction_id
        } = data;
        const result = await db.query(
            `INSERT INTO user_subscriptions 
                (user_id, plan_id, started_at, expires_at, auto_renew, payment_method, transaction_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [user_id, plan_id, started_at, expires_at, auto_renew, payment_method, transaction_id]
        );
        return result.rows[0];
    } catch (error) {
        logger.error('Create user subscription repository error:', error);
        throw error;
    }
};

export const cancelUserSubscription = async (subscriptionId, reason) => {
    try {
        const result = await db.query(
            `UPDATE user_subscriptions
             SET status = 'cancelled', cancelled_at = NOW(), cancel_reason = $1, updated_at = NOW()
             WHERE id = $2 AND status = 'active'
             RETURNING *`,
            [reason, subscriptionId]
        );
        return result.rows[0];
    } catch (error) {
        logger.error('Cancel user subscription repository error:', error);
        throw error;
    }
};

export const incrementFreeRidesUsed = async (subscriptionId) => {
    try {
        const result = await db.query(
            `UPDATE user_subscriptions
             SET free_rides_used = free_rides_used + 1, updated_at = NOW()
             WHERE id = $1
             RETURNING free_rides_used`,
            [subscriptionId]
        );
        return result.rows[0];
    } catch (error) {
        logger.error('Increment free rides used repository error:', error);
        throw error;
    }
};

export const resetFreeRidesCounter = async (subscriptionId) => {
    try {
        const result = await db.query(
            `UPDATE user_subscriptions
             SET free_rides_used = 0, free_rides_reset_at = NOW(), updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [subscriptionId]
        );
        return result.rows[0];
    } catch (error) {
        logger.error('Reset free rides counter repository error:', error);
        throw error;
    }
};

export const expireSubscriptions = async () => {
    try {
        const result = await db.query(
            `UPDATE user_subscriptions
             SET status = 'expired', updated_at = NOW()
             WHERE status = 'active' AND expires_at <= NOW()
             RETURNING id`
        );
        return result.rowCount;
    } catch (error) {
        logger.error('Expire subscriptions repository error:', error);
        throw error;
    }
};

// ==================== Subscription Payments ====================
export const createSubscriptionPayment = async (data) => {
    try {
        const {
            user_id, subscription_id, plan_id, amount,
            payment_method, payment_gateway, gateway_transaction_id,
            status, description, metadata
        } = data;
        const result = await db.query(
            `INSERT INTO subscription_payments
                (user_id, subscription_id, plan_id, amount, payment_method,
                 payment_gateway, gateway_transaction_id, status, description, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *`,
            [user_id, subscription_id, plan_id, amount, payment_method,
             payment_gateway, gateway_transaction_id, status, description, metadata]
        );
        return result.rows[0];
    } catch (error) {
        logger.error('Create subscription payment repository error:', error);
        throw error;
    }
};

export const findPaymentsByUser = async (userId) => {
    try {
        const result = await db.query(
            `SELECT * FROM subscription_payments
             WHERE user_id = $1
             ORDER BY created_at DESC`,
            [userId]
        );
        return result.rows;
    } catch (error) {
        logger.error('Find payments by user repository error:', error);
        throw error;
    }
};

export const findPaymentsBySubscription = async (subscriptionId) => {
    try {
        const result = await db.query(
            `SELECT * FROM subscription_payments
             WHERE subscription_id = $1
             ORDER BY created_at DESC`,
            [subscriptionId]
        );
        return result.rows;
    } catch (error) {
        logger.error('Find payments by subscription repository error:', error);
        throw error;
    }
};

export const updatePaymentStatus = async (paymentId, status, gatewayTransactionId = null) => {
    try {
        const setClause = [];
        const values = [];
        let idx = 1;
        setClause.push(`status = $${idx++}`);
        values.push(status);
        if (gatewayTransactionId) {
            setClause.push(`gateway_transaction_id = $${idx++}`);
            values.push(gatewayTransactionId);
        }
        values.push(paymentId);
        const query = `
            UPDATE subscription_payments
            SET ${setClause.join(', ')}, updated_at = NOW()
            WHERE id = $${idx}
            RETURNING *
        `;
        const result = await db.query(query, values);
        return result.rows[0];
    } catch (error) {
        logger.error('Update payment status repository error:', error);
        throw error;
    }
};