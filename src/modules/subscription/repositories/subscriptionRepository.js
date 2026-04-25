// AB — sahi
import { db } from '../../../infrastructure/database/postgres.js';
import logger from '../../../core/logger/logger.js';

// ─────────────────────────────────────────────────────────────────────────────
//  PLANS
// ─────────────────────────────────────────────────────────────────────────────

export const getAllPlans = async () => {
    try {
        const result = await db.query(
            `SELECT * FROM subscription_plans
             WHERE is_active = TRUE
             ORDER BY price ASC`
        );
        return result.rows;
    } catch (error) {
        logger.error('getAllPlans error:', error);
        throw error;
    }
};

export const getPlanById = async (planId) => {
    try {
        const result = await db.query(
            `SELECT * FROM subscription_plans WHERE id = $1 AND is_active = TRUE`,
            [planId]
        );
        return result.rows[0] || null;
    } catch (error) {
        logger.error('getPlanById error:', error);
        throw error;
    }
};

export const getPlanBySlug = async (slug) => {
    try {
        const result = await db.query(
            `SELECT * FROM subscription_plans WHERE slug = $1 AND is_active = TRUE`,
            [slug]
        );
        return result.rows[0] || null;
    } catch (error) {
        logger.error('getPlanBySlug error:', error);
        throw error;
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  USER SUBSCRIPTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const getActiveSubscription = async (userId) => {
    try {
        const result = await db.query(
            `SELECT us.*, sp.name AS plan_name, sp.slug, sp.ride_discount_percent,
                    sp.free_rides_per_month, sp.priority_booking,
                    sp.cancellation_waiver, sp.surge_protection, sp.price
             FROM user_subscriptions us
             JOIN subscription_plans sp ON us.plan_id = sp.id
             WHERE us.user_id = $1
               AND us.status = 'active'
               AND us.expires_at > CURRENT_TIMESTAMP
             ORDER BY us.created_at DESC
             LIMIT 1`,
            [userId]
        );
        return result.rows[0] || null;
    } catch (error) {
        logger.error('getActiveSubscription error:', error);
        throw error;
    }
};

export const getSubscriptionById = async (subscriptionId, userId) => {
    try {
        const result = await db.query(
            `SELECT us.*, sp.name AS plan_name, sp.slug, sp.ride_discount_percent,
                    sp.free_rides_per_month, sp.priority_booking,
                    sp.cancellation_waiver, sp.surge_protection, sp.price
             FROM user_subscriptions us
             JOIN subscription_plans sp ON us.plan_id = sp.id
             WHERE us.id = $1 AND us.user_id = $2`,
            [subscriptionId, userId]
        );
        return result.rows[0] || null;
    } catch (error) {
        logger.error('getSubscriptionById error:', error);
        throw error;
    }
};

export const getSubscriptionHistory = async (userId, { limit = 10, offset = 0 }) => {
    try {
        const result = await db.query(
            `SELECT us.*, sp.name AS plan_name, sp.slug, sp.price
             FROM user_subscriptions us
             JOIN subscription_plans sp ON us.plan_id = sp.id
             WHERE us.user_id = $1
             ORDER BY us.created_at DESC
             LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
        );
        return result.rows;
    } catch (error) {
        logger.error('getSubscriptionHistory error:', error);
        throw error;
    }
};

export const getSubscriptionHistoryCount = async (userId) => {
    try {
        const result = await db.query(
            `SELECT COUNT(*) FROM user_subscriptions WHERE user_id = $1`,
            [userId]
        );
        return parseInt(result.rows[0].count);
    } catch (error) {
        logger.error('getSubscriptionHistoryCount error:', error);
        throw error;
    }
};

export const createSubscription = async (client, data) => {
    const {
        userId, planId, status, startedAt, expiresAt,
        autoRenew, paymentMethod, transactionId, freeRidesResetAt,
        razorpaySubscriptionId,
    } = data;

    const result = await client.query(
        `INSERT INTO user_subscriptions (
            user_id, plan_id, status, started_at, expires_at,
            auto_renew, payment_method, transaction_id,
            free_rides_used, free_rides_reset_at, razorpay_subscription_id,
            created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,$9,$10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *`,
        [
            userId, planId, status || 'active', startedAt, expiresAt,
            autoRenew ?? true, paymentMethod || null, transactionId || null,
            freeRidesResetAt, razorpaySubscriptionId || null,
        ]
    );
    return result.rows[0];
};

export const updateSubscriptionStatus = async (subscriptionId, status, extra = {}) => {
    try {
        const { cancelReason } = extra;
        const result = await db.query(
            `UPDATE user_subscriptions
             SET status       = $1,
                 cancelled_at = CASE WHEN $1 = 'cancelled' THEN CURRENT_TIMESTAMP ELSE cancelled_at END,
                 cancel_reason = $3,
                 updated_at   = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *`,
            [status, subscriptionId, cancelReason || null]
        );
        return result.rows[0] || null;
    } catch (error) {
        logger.error('updateSubscriptionStatus error:', error);
        throw error;
    }
};

export const updateAutoRenew = async (subscriptionId, userId, autoRenew) => {
    try {
        const result = await db.query(
            `UPDATE user_subscriptions
             SET auto_renew = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2 AND user_id = $3
             RETURNING *`,
            [autoRenew, subscriptionId, userId]
        );
        return result.rows[0] || null;
    } catch (error) {
        logger.error('updateAutoRenew error:', error);
        throw error;
    }
};

// Deduct one free ride from the monthly counter
export const useFreeRide = async (client, subscriptionId) => {
    const result = await client.query(
        `UPDATE user_subscriptions
         SET free_rides_used = free_rides_used + 1,
             updated_at      = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [subscriptionId]
    );
    return result.rows[0] || null;
};

// Reset free rides counter (called monthly via cron)
export const resetFreeRides = async (subscriptionId) => {
    try {
        const result = await db.query(
            `UPDATE user_subscriptions
             SET free_rides_used    = 0,
                 free_rides_reset_at = CURRENT_TIMESTAMP + INTERVAL '30 days',
                 updated_at         = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING *`,
            [subscriptionId]
        );
        return result.rows[0] || null;
    } catch (error) {
        logger.error('resetFreeRides error:', error);
        throw error;
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  SUBSCRIPTION PAYMENTS
// ─────────────────────────────────────────────────────────────────────────────

export const createSubscriptionPayment = async (client, data) => {
    const {
        userId, subscriptionId, planId, amount,
        paymentMethod, paymentGateway, gatewayTransactionId,
        status, description, metadata,
    } = data;

    const result = await client.query(
        `INSERT INTO subscription_payments (
            user_id, subscription_id, plan_id, amount,
            payment_method, payment_gateway, gateway_transaction_id,
            status, description, metadata,
            created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *`,
        [
            userId, subscriptionId, planId, amount,
            paymentMethod || null, paymentGateway || null, gatewayTransactionId || null,
            status || 'pending', description || null, JSON.stringify(metadata || {}),
        ]
    );
    return result.rows[0];
};

export const updatePaymentStatus = async (paymentId, status) => {
    try {
        const result = await db.query(
            `UPDATE subscription_payments
             SET status = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *`,
            [status, paymentId]
        );
        return result.rows[0] || null;
    } catch (error) {
        logger.error('updatePaymentStatus error:', error);
        throw error;
    }
};

export const getPaymentsBySubscriptionId = async (subscriptionId) => {
    try {
        const result = await db.query(
            `SELECT * FROM subscription_payments
             WHERE subscription_id = $1
             ORDER BY created_at DESC`,
            [subscriptionId]
        );
        return result.rows;
    } catch (error) {
        logger.error('getPaymentsBySubscriptionId error:', error);
        throw error;
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  ADMIN QUERIES
// ─────────────────────────────────────────────────────────────────────────────

export const createPlan = async (data) => {
    try {
        const {
            name, slug, description, price, durationDays,
            rideDiscountPercent, freeRidesPerMonth,
            priorityBooking, cancellationWaiver, surgeProtection,
        } = data;

        const result = await db.query(
            `INSERT INTO subscription_plans (
                name, slug, description, price, duration_days,
                ride_discount_percent, free_rides_per_month,
                priority_booking, cancellation_waiver, surge_protection,
                is_active, created_at, updated_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING *`,
            [
                name, slug, description || null, price, durationDays,
                rideDiscountPercent || 0, freeRidesPerMonth || 0,
                priorityBooking || false, cancellationWaiver || false, surgeProtection || false,
            ]
        );
        return result.rows[0];
    } catch (error) {
        logger.error('createPlan error:', error);
        throw error;
    }
};

export const togglePlanStatus = async (planId, isActive) => {
    try {
        const result = await db.query(
            `UPDATE subscription_plans
             SET is_active = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *`,
            [isActive, planId]
        );
        return result.rows[0] || null;
    } catch (error) {
        logger.error('togglePlanStatus error:', error);
        throw error;
    }
};