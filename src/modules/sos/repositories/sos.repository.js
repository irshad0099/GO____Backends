import { db } from '../../../infrastructure/database/postgres.js';
import logger from '../../../core/logger/logger.js';

export const insertAlert = async (data) => {
    try {
        const { rows } = await db.query(
            `INSERT INTO sos_alerts
             (ride_id, triggered_by, latitude, longitude)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [data.ride_id, data.triggered_by, data.latitude, data.longitude]
        );
        return rows[0];
    } catch (error) {
        logger.error('Insert SOS alert repository error:', error);
        throw error;
    }
};

export const updateStatus = async (id, status, adminNotes, resolvedBy) => {
    try {
        const { rows } = await db.query(
            `UPDATE sos_alerts
             SET status = $2,
                 admin_notes = COALESCE($3, admin_notes),
                 resolved_by = COALESCE($4, resolved_by),
                 resolved_at = CASE WHEN $2 IN ('resolved','false_alarm') THEN NOW() ELSE resolved_at END,
                 updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [id, status, adminNotes, resolvedBy]
        );
        return rows[0];
    } catch (error) {
        logger.error('Update SOS status repository error:', error);
        throw error;
    }
};

export const findByRide = async (rideId) => {
    try {
        const { rows } = await db.query(
            `SELECT * FROM sos_alerts WHERE ride_id = $1 ORDER BY triggered_at DESC`,
            [rideId]
        );
        return rows;
    } catch (error) {
        logger.error('Find SOS by ride repository error:', error);
        throw error;
    }
};

export const findByUser = async (userId) => {
    try {
        const { rows } = await db.query(
            `SELECT sa.*, r.ride_number, r.pickup_address, r.dropoff_address
             FROM sos_alerts sa
             JOIN rides r ON sa.ride_id = r.id
             WHERE sa.triggered_by = $1
             ORDER BY sa.triggered_at DESC`,
            [userId]
        );
        return rows;
    } catch (error) {
        logger.error('Find SOS by user repository error:', error);
        throw error;
    }
};

// Admin: pending SOS alerts
export const findPending = async ({ limit = 20, offset = 0 }) => {
    try {
        const { rows } = await db.query(
            `SELECT sa.*, r.ride_number, u.full_name, u.phone_number,
                    r.pickup_address, r.dropoff_address
             FROM sos_alerts sa
             JOIN rides r ON sa.ride_id = r.id
             JOIN users u ON sa.triggered_by = u.id
             WHERE sa.status NOT IN ('resolved', 'false_alarm')
             ORDER BY sa.triggered_at DESC
             LIMIT $1 OFFSET $2`,
            [limit, offset]
        );
        return rows;
    } catch (error) {
        logger.error('Find pending SOS repository error:', error);
        throw error;
    }
};
