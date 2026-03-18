import { db } from '../../../infrastructure/database/postgres.js';
import logger from '../../../core/logger/logger.js';

export const createRide = async (rideData) => {
    try {
        const {
            rideNumber,
            passengerId,
            vehicleType,
            pickupLatitude,
            pickupLongitude,
            pickupAddress,
            pickupLocationName,
            dropoffLatitude,
            dropoffLongitude,
            dropoffAddress,
            dropoffLocationName,
            distanceKm,
            durationMinutes,
            baseFare,
            distanceFare,
            timeFare,
            surgeMultiplier,
            estimatedFare,
            paymentMethod
        } = rideData;

        const result = await db.query(
            `INSERT INTO rides (
                ride_number, passenger_id, vehicle_type,
                pickup_latitude, pickup_longitude, pickup_address, pickup_location_name,
                dropoff_latitude, dropoff_longitude, dropoff_address, dropoff_location_name,
                distance_km, duration_minutes,
                base_fare, distance_fare, time_fare, surge_multiplier, estimated_fare,
                payment_method, status, requested_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 'requested', NOW())
            RETURNING *`,
            [
                rideNumber, passengerId, vehicleType,
                pickupLatitude, pickupLongitude, pickupAddress, pickupLocationName,
                dropoffLatitude, dropoffLongitude, dropoffAddress, dropoffLocationName,
                distanceKm, durationMinutes,
                baseFare, distanceFare, timeFare, surgeMultiplier, estimatedFare,
                paymentMethod
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
                    u.full_name as passenger_name, u.phone_number as passenger_phone,
                    dv.vehicle_type, dv.vehicle_number, dv.vehicle_model, dv.vehicle_color,
                    du.full_name as driver_name, du.phone_number as driver_phone
             FROM rides r
             LEFT JOIN users u ON r.passenger_id = u.id
             LEFT JOIN drivers d ON r.driver_id = d.id
             LEFT JOIN driver_vehicle dv ON d.id = dv.driver_id
             LEFT JOIN users du ON d.user_id = du.id
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
                    u.full_name, u.phone_number,
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

export const assignDriverToRide = async (rideId, driverId) => {
    try {
        const result = await db.query(
            `UPDATE rides 
             SET driver_id = $1, 
                 status = 'driver_assigned',
                 driver_assigned_at = NOW(),
                 updated_at = NOW()
             WHERE id = $2
             RETURNING *`,
            [driverId, rideId]
        );
        return result.rows[0];
    } catch (error) {
        logger.error('Assign driver to ride repository error:', error);
        throw error;
    }
};

export const updateRideStatus = async (rideId, status, additionalFields = {}) => {
    try {
        const statusFieldMap = {
            'driver_arrived': 'driver_arrived_at',
            'in_progress': 'started_at',
            'completed': 'completed_at',
            'cancelled': 'cancelled_at'
        };

        const timestampField = statusFieldMap[status];
        
        let query = `UPDATE rides SET status = $1, updated_at = NOW()`;
        const params = [status];
        let paramIndex = 2;

        if (timestampField) {
            query += `, ${timestampField} = NOW()`;
        }

        // Add additional fields (cancellation reason, final fare, etc.)
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

export const updateRidePayment = async (rideId, actualFare, paymentStatus) => {
    try {
        const result = await db.query(
            `UPDATE rides 
             SET actual_fare = $1, 
                 final_fare = $1,
                 payment_status = $2,
                 updated_at = NOW()
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
             SET driver_current_latitude = $1,
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

export const findRidesByDriver = async (driverId, { limit = 10, offset = 0, status } = {}) => {
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
        let query = `SELECT COUNT(*) FROM rides WHERE passenger_id = $1`;
        const params = [passengerId];

        if (status) {
            query += ` AND status = $2`;
            params.push(status);
        }

        const result = await db.query(query, params);
        return parseInt(result.rows[0].count);
    } catch (error) {
        logger.error('Count rides by passenger repository error:', error);
        throw error;
    }
};

export const countRidesByDriver = async (driverId, status) => {
    try {
        let query = `SELECT COUNT(*) FROM rides WHERE driver_id = $1`;
        const params = [driverId];

        if (status) {
            query += ` AND status = $2`;
            params.push(status);
        }

        const result = await db.query(query, params);
        return parseInt(result.rows[0].count);
    } catch (error) {
        logger.error('Count rides by driver repository error:', error);
        throw error;
    }
};

export const rateRide = async (rideId, rating, review) => {
    try {
        const result = await db.query(
            `UPDATE rides 
             SET rating = $1, 
                 review = $2,
                 updated_at = NOW()
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