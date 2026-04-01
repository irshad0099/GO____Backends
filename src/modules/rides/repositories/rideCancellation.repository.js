import { db } from '../../../infrastructure/database/postgres.js';
import logger from '../../../core/logger/logger.js';

export const insert = async (data) => {
    try {
        const { rows } = await db.query(
            `INSERT INTO ride_cancellations
             (ride_id, cancelled_by_user, cancelled_by_role, reason_code, reason_text,
              driver_distance_meters, penalty_applied, penalty_amount, driver_share,
              platform_share, ride_status_at_cancel)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
             RETURNING *`,
            [data.ride_id, data.cancelled_by_user, data.cancelled_by_role,
             data.reason_code, data.reason_text || null,
             data.driver_distance_meters || 0,
             data.penalty_applied || false, data.penalty_amount || 0,
             data.driver_share || 0, data.platform_share || 0,
             data.ride_status_at_cancel]
        );
        return rows[0];
    } catch (error) {
        logger.error('Insert ride cancellation repository error:', error);
        throw error;
    }
};

export const findByRide = async (rideId) => {
    try {
        const { rows } = await db.query(
            `SELECT * FROM ride_cancellations WHERE ride_id = $1`,
            [rideId]
        );
        return rows[0];
    } catch (error) {
        logger.error('Find cancellation by ride repository error:', error);
        throw error;
    }
};

export const countByUser = async (userId, days = 7) => {
    try {
        const { rows } = await db.query(
            `SELECT COUNT(*) AS count FROM ride_cancellations
             WHERE cancelled_by_user = $1
               AND cancelled_at >= NOW() - INTERVAL '1 day' * $2`,
            [userId, days]
        );
        return parseInt(rows[0].count);
    } catch (error) {
        logger.error('Count cancellations by user repository error:', error);
        throw error;
    }
};
