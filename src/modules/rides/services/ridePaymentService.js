import { findRideById, updateRidePayment, updateRideStatus } from '../repositories/ride.repository.js';
import { pool } from '../../../infrastructure/database/postgres.js';
import logger from '../../../core/logger/logger.js';
import { ApiError } from '../../../core/errors/ApiError.js';

/**
 * Update ride payment status for cash payments
 * @param {number} rideId - Ride ID
 * @param {Object} updateData - Payment update data
 * @returns {Promise<Object>} Updated ride details
 */
export const updateRidePaymentStatus = async (rideId, updateData) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const result = await client.query(
            `UPDATE rides 
             SET payment_status = $1, 
                 payment_method = $2, 
                 payment_collected_at = $3,
                 updated_at = NOW() 
             WHERE id = $4 
             RETURNING *`,
            [
                updateData.payment_status || 'cash_collected',
                updateData.payment_method || 'cash',
                updateData.payment_collected_at || new Date(),
                rideId
            ]
        );

        await client.query('COMMIT');
        
        logger.info(`[RidePayment] Cash payment recorded for ride ${rideId}`);
        return result.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error(`[RidePayment] Failed to update ride payment status for ride ${rideId}:`, error);
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Get ride payment status
 * @param {number} rideId - Ride ID
 * @returns {Promise<Object>} Ride payment details
 */
export const getRidePaymentStatus = async (rideId) => {
    try {
        const ride = await findRideById(rideId);
        
        if (!ride) {
            throw new ApiError('Ride not found', 404);
        }

        return {
            rideId: ride.id,
            rideNumber: ride.ride_number,
            paymentStatus: ride.payment_status,
            paymentMethod: ride.payment_method,
            amount: ride.final_fare || ride.estimated_fare,
            paymentCollectedAt: ride.payment_collected_at,
            status: ride.status
        };
    } catch (error) {
        logger.error(`[RidePayment] Failed to get ride payment status for ride ${rideId}:`, error);
        throw error;
    }
};

/**
 * Confirm cash collection by driver
 * @param {number} rideId - Ride ID
 * @param {number} driverId - Driver ID
 * @returns {Promise<Object>} Updated ride details
 */
export const confirmCashCollection = async (rideId, driverId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const ride = await findRideById(rideId);
        
        if (!ride) {
            throw new ApiError('Ride not found', 404);
        }

        if (ride.driver_id !== driverId) {
            throw new ApiError('You are not assigned to this ride', 403);
        }

        if (ride.payment_status !== 'cash_collected') {
            throw new ApiError('Cash payment not recorded for this ride', 400);
        }

        // Mark cash as confirmed by driver
        const result = await client.query(
            `UPDATE rides 
             SET payment_status = 'cash_confirmed',
                 cash_confirmed_by_driver = $1,
                 cash_confirmed_at = NOW(),
                 updated_at = NOW() 
             WHERE id = $2 
             RETURNING *`,
            [driverId, rideId]
        );
        
        await client.query('COMMIT');

        logger.info(`[RidePayment] Cash confirmed by driver ${driverId} for ride ${rideId}`);
        return result.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error(`[RidePayment] Failed to confirm cash collection for ride ${rideId}:`, error);
        throw error;
    } finally {
        client.release();
    }
};
