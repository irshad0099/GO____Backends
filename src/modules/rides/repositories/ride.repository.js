

import { db } from '../../../infrastructure/database/postgres.js';
import logger from '../../../core/logger/logger.js';

export const createRide = async (rideData) => {
    try {
        const {
            rideNumber, passengerId, vehicleType,
            pickupLatitude, pickupLongitude, pickupAddress, pickupLocationName,
            dropoffLatitude, dropoffLongitude, dropoffAddress, dropoffLocationName,
            distanceKm, durationMinutes,
            baseFare, distanceFare, timeFare, surgeMultiplier, estimatedFare,
            paymentMethod,
            couponId             = null,
            couponDiscount       = 0,
            convenienceFee       = 0,
            isPeak               = false,
            demandSupplyRatio    = 1.0,
            subscriptionDiscount = 0,
            isFreeRide           = false,
            // ── v3.0 locked snapshot fields ────────────────────────────────
            lockedIsSubscribed   = false,
            lockedSubscriberTier = null,
            lockedSurgeCap       = 1.75,
            lockedIsPeak         = null,
            fareBeforeGst        = 0,
            gstOnFare            = 0
        } = rideData;

        const result = await db.query(
            `INSERT INTO rides (
                ride_number, passenger_id, vehicle_type,
                pickup_latitude, pickup_longitude, pickup_address, pickup_location_name,
                dropoff_latitude, dropoff_longitude, dropoff_address, dropoff_location_name,
                distance_km, duration_minutes,
                base_fare, distance_fare, time_fare, surge_multiplier, estimated_fare,
                payment_method, coupon_id, coupon_discount,
                convenience_fee, is_peak, demand_supply_ratio,
                subscription_discount, is_free_ride,
                locked_is_subscribed, locked_subscriber_tier, locked_surge_cap, locked_is_peak,
                fare_before_gst, gst_on_fare,
                status, requested_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,'requested',NOW())
            RETURNING *`,
            [
                rideNumber, passengerId, vehicleType,
                pickupLatitude, pickupLongitude, pickupAddress, pickupLocationName,
                dropoffLatitude, dropoffLongitude, dropoffAddress, dropoffLocationName,
                distanceKm, durationMinutes,
                baseFare, distanceFare, timeFare, surgeMultiplier, estimatedFare,
                paymentMethod, couponId, couponDiscount,
                convenienceFee, isPeak, demandSupplyRatio,
                subscriptionDiscount, isFreeRide,
                lockedIsSubscribed, lockedSubscriberTier, lockedSurgeCap,
                lockedIsPeak != null ? lockedIsPeak : isPeak,
                fareBeforeGst, gstOnFare
            ]
        );
        return result.rows[0];
    } catch (error) {
        logger.error('Create ride repository error:', error);
        throw error;
    }
};

export const findRideById = async (rideId) => {
    try {
        const result = await db.query(
            `SELECT r.*,
                    r.vehicle_type          AS ride_vehicle_type,
                    u.full_name             AS passenger_name,
                    u.phone_number          AS passenger_phone,
                    u.email                 AS passenger_email,
                    u.fcm_token             AS passenger_fcm_token,
                    dv.vehicle_type         AS driver_vehicle_type,
                    dv.vehicle_number,
                    dv.vehicle_model,
                    dv.vehicle_color,
                    du.full_name            AS driver_name,
                    du.phone_number         AS driver_phone,
                    du.fcm_token            AS driver_fcm_token
             FROM rides r
             LEFT JOIN users u           ON r.passenger_id = u.id
             LEFT JOIN drivers d         ON r.driver_id    = d.id
             LEFT JOIN driver_vehicle dv ON d.id           = dv.driver_id
             LEFT JOIN users du          ON d.user_id      = du.id
             WHERE r.id = $1`,
            [rideId]
        );
        return result.rows[0];
    } catch (error) {
        logger.error('Find ride by ID repository error:', error);
        throw error;
    }
};

export const findRideByRideNumber = async (rideNumber) => {
    try {
        const result = await db.query(
            `SELECT * FROM rides WHERE ride_number = $1`,
            [rideNumber]
        );
        return result.rows[0];
    } catch (error) {
        logger.error('Find ride by ride number repository error:', error);
        throw error;
    }
};

export const findActiveRideByPassenger = async (passengerId) => {
    try {
        const result = await db.query(
            `SELECT * FROM rides 
             WHERE passenger_id = $1 
               AND status IN ('requested', 'driver_assigned', 'driver_arrived', 'in_progress')
             ORDER BY requested_at DESC 
             LIMIT 1`,
            [passengerId]
        );
        return result.rows[0];
    } catch (error) {
        logger.error('Find active ride by passenger repository error:', error);
        throw error;
    }
};

export const findActiveRideByDriver = async (driverId) => {
    try {
        const result = await db.query(
            `SELECT r.*, 
                    u.full_name as passenger_name, u.phone_number as passenger_phone
             FROM rides r
             LEFT JOIN users u ON r.passenger_id = u.id
             WHERE r.driver_id = $1 
               AND r.status IN ('driver_assigned', 'driver_arrived', 'in_progress')
             ORDER BY r.requested_at DESC 
             LIMIT 1`,
            [driverId]
        );
        return result.rows[0];
    } catch (error) {
        logger.error('Find active ride by driver repository error:', error);
        throw error;
    }
};

export const findNearbyDrivers = async (vehicleType, latitude, longitude, radiusKm = 5) => {
    try {
        const result = await db.query(
            `SELECT d.*, 
                    dv.vehicle_type, dv.vehicle_number, dv.vehicle_model, dv.vehicle_color,
                    u.full_name, u.phone_number, u.fcm_token,
                    (6371 * acos(cos(radians($1)) * cos(radians(d.current_latitude)) * 
                    cos(radians(d.current_longitude) - radians($2)) + 
                    sin(radians($1)) * sin(radians(d.current_latitude)))) AS distance
             FROM drivers d
             JOIN driver_vehicle dv ON d.id = dv.driver_id
             JOIN users u ON d.user_id = u.id
             WHERE dv.vehicle_type = $3
               AND d.is_verified = true
               AND d.is_available = true
               AND d.is_on_duty = false
               AND d.current_latitude IS NOT NULL
               AND d.current_longitude IS NOT NULL
               AND (6371 * acos(cos(radians($1)) * cos(radians(d.current_latitude)) * 
                    cos(radians(d.current_longitude) - radians($2)) + 
                    sin(radians($1)) * sin(radians(d.current_latitude)))) <= $4
             ORDER BY distance
             LIMIT 10`,
            [latitude, longitude, vehicleType, radiusKm]
        );
        return result.rows;
    } catch (error) {
        logger.error('Find nearby drivers repository error:', error);
        throw error;
    }
};

export const assignDriverToRide = async (rideId, driverId, pickupDistanceKm = 0) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        const driverCheck = await client.query(
            `SELECT id FROM drivers WHERE id = $1 AND is_on_duty = false FOR UPDATE`,
            [driverId]
        );
        if (driverCheck.rowCount === 0) {
            await client.query('ROLLBACK');
            return null;
        }

        const result = await client.query(
            `UPDATE rides
             SET driver_id = $1,
                 status = 'driver_assigned',
                 driver_assigned_at = NOW(),
                 driver_pickup_distance_km = $3,
                 updated_at = NOW()
             WHERE id = $2 AND status = 'requested'
             RETURNING *`,
            [driverId, rideId, pickupDistanceKm]
        );

        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            return null;
        }

        await client.query('COMMIT');
        return result.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Assign driver to ride repository error:', error);
        throw error;
    } finally {
        client.release();
    }
};

export const updateRideStatus = async (rideId, status, additionalFields = {}) => {
    try {
        const statusFieldMap = {
            'driver_arrived': 'driver_arrived_at',
            'in_progress':    'started_at',
            'completed':      'completed_at',
            'cancelled':      'cancelled_at'
        };

        const timestampField = statusFieldMap[status];

        let query  = `UPDATE rides SET status = $1, updated_at = NOW()`;
        const params = [status];
        let paramIndex = 2;

        if (timestampField) {
            query += `, ${timestampField} = NOW()`;
        }

        Object.entries(additionalFields).forEach(([key, value]) => {
            if (value !== undefined) {
                query += `, ${key} = $${paramIndex}`;
                params.push(value);
                paramIndex++;
            }
        });

        query += ` WHERE id = $${paramIndex} RETURNING *`;
        params.push(rideId);

        const result = await db.query(query, params);
        return result.rows[0];
    } catch (error) {
        logger.error('Update ride status repository error:', error);
        throw error;
    }
};

export const updateRideField = async (rideId, field, value) => {
    try {
        const { rows } = await db.query(
            `UPDATE rides SET ${field} = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
            [value, rideId]
        );
        return rows[0];
    } catch (error) {
        logger.error('Update ride field repository error:', error);
        throw error;
    }
};

export const updateRidePayment = async (rideId, actualFare, paymentStatus) => {
    try {
        const result = await db.query(
            `UPDATE rides 
             SET actual_fare = $1, final_fare = $1,
                 payment_status = $2, updated_at = NOW()
             WHERE id = $3
             RETURNING *`,
            [actualFare, paymentStatus, rideId]
        );
        return result.rows[0];
    } catch (error) {
        logger.error('Update ride payment repository error:', error);
        throw error;
    }
};

export const updateDriverLocation = async (rideId, latitude, longitude) => {
    try {
        const result = await db.query(
            `UPDATE rides 
             SET driver_current_latitude  = $1,
                 driver_current_longitude = $2,
                 updated_at = NOW()
             WHERE id = $3
             RETURNING *`,
            [latitude, longitude, rideId]
        );
        return result.rows[0];
    } catch (error) {
        logger.error('Update driver location repository error:', error);
        throw error;
    }
};

export const findRidesByPassenger = async (passengerId, { limit = 10, offset = 0, status } = {}) => {
    try {
        let query = `
            SELECT r.*,
                   dv.vehicle_type, dv.vehicle_number,
                   u.full_name as driver_name, u.phone_number as driver_phone
            FROM rides r
            LEFT JOIN drivers d ON r.driver_id = d.id
            LEFT JOIN driver_vehicle dv ON d.id = dv.driver_id
            LEFT JOIN users u ON d.user_id = u.id
            WHERE r.passenger_id = $1
        `;
        const params = [passengerId];
        let paramIndex = 2;

        if (status) {
            query += ` AND r.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        query += ` ORDER BY r.requested_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        const result = await db.query(query, params);
        return result.rows;
    } catch (error) {
        logger.error('Find rides by passenger repository error:', error);
        throw error;
    }
};

export const findRidesByDriver = async (driverId, { limit = 10, offset = 0, status, dateFrom, dateTo } = {}) => {
    try {
        let query = `
            SELECT r.*,
                   u.full_name as passenger_name, u.phone_number as passenger_phone
            FROM rides r
            LEFT JOIN users u ON r.passenger_id = u.id
            WHERE r.driver_id = $1
        `;
        const params = [driverId];
        let paramIndex = 2;

        if (status) {
            query += ` AND r.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (dateFrom) {
            query += ` AND r.requested_at >= $${paramIndex}`;
            params.push(dateFrom);
            paramIndex++;
        }

        if (dateTo) {
            query += ` AND r.requested_at <= $${paramIndex}`;
            params.push(dateTo);
            paramIndex++;
        }

        query += ` ORDER BY r.requested_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        const result = await db.query(query, params);
        return result.rows;
    } catch (error) {
        logger.error('Find rides by driver repository error:', error);
        throw error;
    }
};

export const countRidesByPassenger = async (passengerId, status) => {
    try {
        let query  = `SELECT COUNT(*) FROM rides WHERE passenger_id = $1`;
        const params = [passengerId];
        if (status) { query += ` AND status = $2`; params.push(status); }
        const result = await db.query(query, params);
        return parseInt(result.rows[0].count);
    } catch (error) {
        logger.error('Count rides by passenger repository error:', error);
        throw error;
    }
};

export const countRidesByDriver = async (driverId, status, dateFrom, dateTo) => {
    try {
        let query  = `SELECT COUNT(*) FROM rides WHERE driver_id = $1`;
        const params = [driverId];
        let paramIndex = 2;
        if (status)   { query += ` AND status = $${paramIndex}`; params.push(status); paramIndex++; }
        if (dateFrom) { query += ` AND requested_at >= $${paramIndex}`; params.push(dateFrom); paramIndex++; }
        if (dateTo)   { query += ` AND requested_at <= $${paramIndex}`; params.push(dateTo); paramIndex++; }
        const result = await db.query(query, params);
        return parseInt(result.rows[0].count);
    } catch (error) {
        logger.error('Count rides by driver repository error:', error);
        throw error;
    }
};

export const countRecentRideRequests = async (vehicleType, latitude, longitude, radiusKm = 5, windowMinutes = 10) => {
    try {
        const result = await db.query(
            `SELECT COUNT(*)::int AS total
             FROM rides
             WHERE vehicle_type = $1
               AND requested_at >= NOW() - ($5 || ' minutes')::INTERVAL
               AND status IN ('requested', 'driver_assigned', 'driver_arrived', 'in_progress')
               AND (6371 * acos(
                    cos(radians($2)) * cos(radians(pickup_latitude)) *
                    cos(radians(pickup_longitude) - radians($3)) +
                    sin(radians($2)) * sin(radians(pickup_latitude))
               )) <= $4`,
            [vehicleType, latitude, longitude, radiusKm, windowMinutes]
        );
        return result.rows[0]?.total || 0;
    } catch (error) {
        logger.error('countRecentRideRequests error:', error);
        return 0;
    }
};

export const getRequestVelocity = async (vehicleType, latitude, longitude, radiusKm = 5, windowMinutes = 5) => {
    try {
        const result = await db.query(
            `SELECT COUNT(*)::int AS total
             FROM rides
             WHERE vehicle_type = $1
               AND requested_at >= NOW() - ($5 || ' minutes')::INTERVAL
               AND (6371 * acos(
                    cos(radians($2)) * cos(radians(pickup_latitude)) *
                    cos(radians(pickup_longitude) - radians($3)) +
                    sin(radians($2)) * sin(radians(pickup_latitude))
               )) <= $4`,
            [vehicleType, latitude, longitude, radiusKm, windowMinutes]
        );
        const count = result.rows[0]?.total || 0;
        return Math.round((count / Math.max(1, windowMinutes)) * 100) / 100;
    } catch (error) {
        logger.error('getRequestVelocity error:', error);
        return 0;
    }
};

export const getDriverDailyRideCount = async (driverId) => {
    if (!driverId) return 0;
    try {
        const result = await db.query(
            `SELECT COUNT(*)::int AS total
             FROM rides
             WHERE driver_id = $1
               AND status = 'completed'
               AND DATE(completed_at) = CURRENT_DATE`,
            [driverId]
        );
        return result.rows[0]?.total || 0;
    } catch (error) {
        logger.error('getDriverDailyRideCount error:', error);
        return 0;
    }
};

export const rateRide = async (rideId, rating, review) => {
    try {
        const result = await db.query(
            `UPDATE rides 
             SET rating = $1, review = $2, updated_at = NOW()
             WHERE id = $3
             RETURNING *`,
            [rating, review, rideId]
        );
        return result.rows[0];
    } catch (error) {
        logger.error('Rate ride repository error:', error);
        throw error;
    }
};