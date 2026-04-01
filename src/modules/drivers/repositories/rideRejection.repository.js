import { db } from '../../../infrastructure/database/postgres.js';
import logger from '../../../core/logger/logger.js';

// ─── Insert ride rejection ──────────────────────────────────────────────────
export const insertRejection = async (data) => {
    try {
        const { rows } = await db.query(
            `INSERT INTO ride_rejections
             (ride_id, driver_id, reason_code, reason_text, is_auto_reject)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [data.ride_id, data.driver_id, data.reason_code, data.reason_text || null, data.is_auto_reject || false]
        );
        return rows[0];
    } catch (error) {
        logger.error('Insert ride rejection repository error:', error);
        throw error;
    }
};

// ─── Ride pe kitne drivers ne reject kiya ───────────────────────────────────
export const countRejectionsByRide = async (rideId) => {
    try {
        const { rows } = await db.query(
            `SELECT COUNT(*) AS count FROM ride_rejections WHERE ride_id = $1`,
            [rideId]
        );
        return parseInt(rows[0].count);
    } catch (error) {
        logger.error('Count rejections by ride repository error:', error);
        throw error;
    }
};

// ─── Driver ka rejection history (paginated) ────────────────────────────────
export const findRejectionsByDriver = async (driverId, { limit = 20, offset = 0 }) => {
    try {
        const { rows } = await db.query(
            `SELECT rr.*, r.ride_number, r.pickup_address, r.dropoff_address, r.vehicle_type
             FROM ride_rejections rr
             JOIN rides r ON rr.ride_id = r.id
             WHERE rr.driver_id = $1
             ORDER BY rr.rejected_at DESC
             LIMIT $2 OFFSET $3`,
            [driverId, limit, offset]
        );
        return rows;
    } catch (error) {
        logger.error('Find rejections by driver repository error:', error);
        throw error;
    }
};

// ─── Driver ka acceptance rate (last N days) ────────────────────────────────
export const getAcceptanceStats = async (driverId, days = 7) => {
    try {
        const { rows } = await db.query(
            `SELECT
                (SELECT COUNT(*) FROM rides
                 WHERE driver_id = $1 AND requested_at >= NOW() - INTERVAL '1 day' * $2) AS accepted,
                (SELECT COUNT(*) FROM ride_rejections
                 WHERE driver_id = $1 AND rejected_at >= NOW() - INTERVAL '1 day' * $2) AS rejected`,
            [driverId, days]
        );

        const accepted = parseInt(rows[0].accepted);
        const rejected = parseInt(rows[0].rejected);
        const total = accepted + rejected;

        return {
            accepted,
            rejected,
            total,
            acceptanceRate: total > 0 ? Math.round((accepted / total) * 100) : 100
        };
    } catch (error) {
        logger.error('Get acceptance stats repository error:', error);
        throw error;
    }
};
