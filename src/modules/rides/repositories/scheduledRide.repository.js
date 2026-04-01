import { db } from '../../../infrastructure/database/postgres.js';
import logger from '../../../core/logger/logger.js';

export const insert = async (data) => {
    try {
        const { rows } = await db.query(
            `INSERT INTO scheduled_rides
             (passenger_id, pickup_latitude, pickup_longitude, pickup_address, pickup_location_name,
              dropoff_latitude, dropoff_longitude, dropoff_address, dropoff_location_name,
              vehicle_type, payment_method, pickup_time, estimated_fare)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
             RETURNING *`,
            [data.passenger_id, data.pickup_latitude, data.pickup_longitude,
             data.pickup_address, data.pickup_location_name || null,
             data.dropoff_latitude, data.dropoff_longitude,
             data.dropoff_address, data.dropoff_location_name || null,
             data.vehicle_type, data.payment_method || 'cash',
             data.pickup_time, data.estimated_fare || null]
        );
        return rows[0];
    } catch (error) {
        logger.error('Insert scheduled ride repository error:', error);
        throw error;
    }
};

export const findByPassenger = async (passengerId, status) => {
    try {
        let query = `SELECT * FROM scheduled_rides WHERE passenger_id = $1`;
        const params = [passengerId];
        let idx = 2;

        if (status) {
            query += ` AND status = $${idx++}`;
            params.push(status);
        }
        query += ` ORDER BY pickup_time ASC`;

        const { rows } = await db.query(query, params);
        return rows;
    } catch (error) {
        logger.error('Find scheduled rides repository error:', error);
        throw error;
    }
};

export const findById = async (id, passengerId) => {
    try {
        const { rows } = await db.query(
            `SELECT * FROM scheduled_rides WHERE id = $1 AND passenger_id = $2`,
            [id, passengerId]
        );
        return rows[0];
    } catch (error) {
        logger.error('Find scheduled ride by id repository error:', error);
        throw error;
    }
};

export const cancel = async (id, passengerId, reason) => {
    try {
        const { rows } = await db.query(
            `UPDATE scheduled_rides
             SET status = 'cancelled', cancelled_at = NOW(), cancel_reason = $3, updated_at = NOW()
             WHERE id = $1 AND passenger_id = $2 AND status = 'scheduled'
             RETURNING *`,
            [id, passengerId, reason || null]
        );
        return rows[0];
    } catch (error) {
        logger.error('Cancel scheduled ride repository error:', error);
        throw error;
    }
};

// Cron: pickup_time aane wale rides trigger karo
export const findReadyToTrigger = async (minutesBefore = 15) => {
    try {
        const { rows } = await db.query(
            `SELECT * FROM scheduled_rides
             WHERE status = 'scheduled'
               AND pickup_time <= NOW() + INTERVAL '1 minute' * $1
               AND pickup_time > NOW()
             ORDER BY pickup_time ASC`,
            [minutesBefore]
        );
        return rows;
    } catch (error) {
        logger.error('Find ready to trigger repository error:', error);
        throw error;
    }
};

export const updateStatus = async (id, status, rideId) => {
    try {
        const { rows } = await db.query(
            `UPDATE scheduled_rides
             SET status = $2, ride_id = COALESCE($3, ride_id), updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [id, status, rideId || null]
        );
        return rows[0];
    } catch (error) {
        logger.error('Update scheduled ride status repository error:', error);
        throw error;
    }
};
