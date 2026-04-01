import { db } from '../../../infrastructure/database/postgres.js';
import logger from '../../../core/logger/logger.js';

// ─── Get active destination mode ────────────────────────────────────────────
export const findActive = async (driverId) => {
    try {
        const { rows } = await db.query(
            `SELECT * FROM driver_destination_mode
             WHERE driver_id = $1 AND is_active = TRUE AND expires_at > NOW()
             ORDER BY created_at DESC
             LIMIT 1`,
            [driverId]
        );
        return rows[0];
    } catch (error) {
        logger.error('Find active destination mode repository error:', error);
        throw error;
    }
};

// ─── Daily usage count (max 2 per day) ──────────────────────────────────────
export const getDailyUsageCount = async (driverId) => {
    try {
        const { rows } = await db.query(
            `SELECT COUNT(*) AS count
             FROM driver_destination_mode
             WHERE driver_id = $1 AND used_date = CURRENT_DATE`,
            [driverId]
        );
        return parseInt(rows[0].count);
    } catch (error) {
        logger.error('Get daily usage count repository error:', error);
        throw error;
    }
};

// ─── Set destination mode ───────────────────────────────────────────────────
export const insertDestinationMode = async (data) => {
    try {
        const { rows } = await db.query(
            `INSERT INTO driver_destination_mode
             (driver_id, dest_latitude, dest_longitude, dest_address, radius_km, expires_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [data.driver_id, data.dest_latitude, data.dest_longitude, data.dest_address, data.radius_km || 3.0, data.expires_at]
        );
        return rows[0];
    } catch (error) {
        logger.error('Insert destination mode repository error:', error);
        throw error;
    }
};

// ─── Deactivate destination mode ────────────────────────────────────────────
export const deactivate = async (driverId, reason) => {
    try {
        const { rows } = await db.query(
            `UPDATE driver_destination_mode
             SET is_active = FALSE,
                 deactivated_at = NOW(),
                 deactivation_reason = $2
             WHERE driver_id = $1 AND is_active = TRUE
             RETURNING *`,
            [driverId, reason]
        );
        return rows[0];
    } catch (error) {
        logger.error('Deactivate destination mode repository error:', error);
        throw error;
    }
};

// ─── Expire old modes (cron job) ────────────────────────────────────────────
export const expireOldModes = async () => {
    try {
        const { rows } = await db.query(
            `UPDATE driver_destination_mode
             SET is_active = FALSE,
                 deactivated_at = NOW(),
                 deactivation_reason = 'expired'
             WHERE is_active = TRUE AND expires_at <= NOW()
             RETURNING driver_id`
        );
        return rows;
    } catch (error) {
        logger.error('Expire old destination modes repository error:', error);
        throw error;
    }
};
