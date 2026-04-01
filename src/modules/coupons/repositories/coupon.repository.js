import { db } from '../../../infrastructure/database/postgres.js';
import logger from '../../../core/logger/logger.js';

export const findByCode = async (code) => {
    try {
        const { rows } = await db.query(
            `SELECT * FROM coupons WHERE code = $1`,
            [code.toUpperCase()]
        );
        return rows[0];
    } catch (error) {
        logger.error('Find coupon by code repository error:', error);
        throw error;
    }
};

export const findAvailable = async (vehicleType) => {
    try {
        const { rows } = await db.query(
            `SELECT id, code, title, description, discount_type, discount_value,
                    max_discount, min_ride_amount, vehicle_types, first_ride_only, valid_until
             FROM coupons
             WHERE is_active = TRUE
               AND valid_from <= NOW()
               AND valid_until > NOW()
               AND (max_uses_total IS NULL OR current_uses < max_uses_total)
               AND ($1::text IS NULL OR $1 = ANY(vehicle_types))
             ORDER BY discount_value DESC`,
            [vehicleType || null]
        );
        return rows;
    } catch (error) {
        logger.error('Find available coupons repository error:', error);
        throw error;
    }
};

export const getUserUsageCount = async (couponId, userId) => {
    try {
        const { rows } = await db.query(
            `SELECT COUNT(*) AS count FROM coupon_usages
             WHERE coupon_id = $1 AND user_id = $2`,
            [couponId, userId]
        );
        return parseInt(rows[0].count);
    } catch (error) {
        logger.error('Get user usage count repository error:', error);
        throw error;
    }
};

export const insertUsage = async (data) => {
    try {
        const { rows } = await db.query(
            `INSERT INTO coupon_usages
             (coupon_id, user_id, ride_id, discount_applied, ride_amount)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [data.coupon_id, data.user_id, data.ride_id || null, data.discount_applied, data.ride_amount]
        );

        // Increment coupon usage counter
        await db.query(
            `UPDATE coupons SET current_uses = current_uses + 1, updated_at = NOW() WHERE id = $1`,
            [data.coupon_id]
        );

        return rows[0];
    } catch (error) {
        logger.error('Insert coupon usage repository error:', error);
        throw error;
    }
};

export const isFirstRide = async (userId) => {
    try {
        const { rows } = await db.query(
            `SELECT COUNT(*) AS count FROM rides
             WHERE passenger_id = $1 AND status = 'completed'`,
            [userId]
        );
        return parseInt(rows[0].count) === 0;
    } catch (error) {
        logger.error('Check first ride repository error:', error);
        throw error;
    }
};
