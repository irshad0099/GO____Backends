import { pool } from '../../../infrastructure/database/postgres.js';
import logger from '../../../core/logger/logger.js';
import { NotFoundError } from '../../../core/errors/ApiError.js';
import * as rideRepo from '../repositories/ride.repository.js';
import * as driverRepo from '../../drivers/repositories/driver.repository.js';
import { creditDriverEarnings } from '../../drivers/services/earningsService.js';
import { updatePaymentOrderStatus, getActivePaymentOrderByRideId } from '../../payments/repositories/payment.Repository.js';

// ─────────────────────────────────────────────────────────────────────────────
//  Cash Collection Service — Driver confirms cash/personal UPI collection
//  Called when driver taps "Paise mil gaye" / "Collected" in app
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Confirm cash collection by driver
 * @param {number} driverUserId — driver user ID (from JWT)
 * @param {number} rideId — ride ID
 * @param {Object} data — { collection_method: 'cash' | 'personal_upi' }
 */
export const confirmCashCollection = async (driverUserId, rideId, {
    collection_method = 'cash'
}) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Fetch ride with validation
        const ride = await rideRepo.findRideById(rideId);
        if (!ride) {
            throw new NotFoundError('Ride not found');
        }

        // Verify driver is assigned to this ride
        const driver = await driverRepo.findDriverByUserId(driverUserId);
        if (!driver || ride.driver_id !== driver.id) {
            throw new NotFoundError('You are not assigned to this ride');
        }

        // Only completed rides can have cash collected
        if (ride.status !== 'completed') {
            const err = new Error('Ride must be completed before collection');
            err.statusCode = 400;
            throw err;
        }

        // Check if already collected or paid
        if (ride.payment_status === 'collected_by_driver') {
            await client.query('ROLLBACK');
            return {
                success: true,
                message: 'Collection already confirmed',
                alreadyConfirmed: true,
            };
        }

        if (ride.payment_status === 'paid') {
            const err = new Error('Ride is already paid via online method');
            err.statusCode = 400;
            throw err;
        }

        // 2. Calculate splits
        const finalFare = parseFloat(ride.final_fare || ride.actual_fare || 0);
        const commissionRate = parseFloat(ride.commission_rate || process.env.DEFAULT_COMMISSION_RATE || 0.20);
        const platformFee = Math.round(finalFare * commissionRate * 100) / 100;
        const netEarnings = Math.round((finalFare - platformFee) * 100) / 100;

        // 3. Cancel any pending online payment order for this ride
        const activeOrder = await getActivePaymentOrderByRideId(rideId, 'ride_payment');
        if (activeOrder) {
            await updatePaymentOrderStatus(client, activeOrder.id, 'cancelled', {
                failureReason: 'Cancelled due to cash collection',
            });
            logger.info(`[Collection] Cancelled online order ${activeOrder.order_number} for ride ${rideId}`);
        }

        // 4. Update ride payment status
        const updatedRide = await client.query(
            `UPDATE rides
             SET payment_status = 'collected_by_driver',
                 collection_method_actual = $1,
                 platform_share = $2,
                 collection_confirmed_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3
             RETURNING *`,
            [collection_method, platformFee, rideId]
        );

        // 5. Credit driver earnings (this handles wallet credit + cash_balance update)
        const earningsResult = await creditDriverEarnings({
            driverUserId,
            rideId,
            netEarnings,
            platformFee,
            paymentMethod: 'cash',
            collectionMethodActual: collection_method,
        });

        await client.query('COMMIT');

        logger.info(
            `[Collection] Cash confirmed | Driver: ${driver.id} | Ride: ${rideId} | Fare: ₹${finalFare} | Net: ₹${netEarnings}`
        );

        return {
            success: true,
            message: 'Cash collection confirmed successfully',
            data: {
                ride: {
                    id: updatedRide.rows[0].id,
                    rideNumber: updatedRide.rows[0].ride_number,
                    paymentStatus: updatedRide.rows[0].payment_status,
                    collectionMethodActual: updatedRide.rows[0].collection_method_actual,
                    collectionConfirmedAt: updatedRide.rows[0].collection_confirmed_at,
                },
                earnings: {
                    finalFare,
                    platformFee,
                    netEarnings,
                    commissionRate,
                },
                driverWallet: earningsResult.data?.walletBalance,
                alreadyConfirmed: false,
            },
        };
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error(`[Collection] confirmCashCollection error | Driver: ${driverUserId} | Ride: ${rideId}:`, error);
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Get collection status for a ride
 * @param {number} userId — user ID (driver or passenger)
 * @param {number} rideId — ride ID
 * @param {string} role — 'driver' | 'passenger'
 */
export const getCollectionStatus = async (userId, rideId, role) => {
    try {
        const ride = await rideRepo.findRideById(rideId);
        if (!ride) {
            throw new NotFoundError('Ride not found');
        }

        // Authorization check
        if (role === 'driver') {
            const driver = await driverRepo.findDriverByUserId(userId);
            if (!driver || ride.driver_id !== driver.id) {
                throw new NotFoundError('You are not assigned to this ride');
            }
        } else if (role === 'passenger') {
            if (ride.passenger_id !== userId) {
                throw new NotFoundError('This is not your ride');
            }
        }

        const isCollectable = ride.status === 'completed' &&
                              ride.payment_method === 'cash' &&
                              ride.payment_status === 'pending';

        return {
            success: true,
            data: {
                rideId: ride.id,
                rideNumber: ride.ride_number,
                status: ride.status,
                paymentStatus: ride.payment_status,
                paymentMethod: ride.payment_method,
                finalFare: parseFloat(ride.final_fare || ride.actual_fare || 0),
                isCollectable,
                collectionConfirmedAt: ride.collection_confirmed_at,
                collectionMethodActual: ride.collection_method_actual,
            },
        };
    } catch (error) {
        logger.error(`[Collection] getCollectionStatus error | Ride: ${rideId}:`, error);
        throw error;
    }
};

/**
 * Cron job: Flag rides with pending cash collection older than 2 hours
 * Called by scheduled job to alert admin for manual review
 */
export const flagStaleCashCollections = async () => {
    try {
        const result = await pool.query(
            `UPDATE rides
             SET payment_status = 'admin_review_required',
                 admin_flag_reason = 'Cash collection not confirmed within 2 hours',
                 updated_at = CURRENT_TIMESTAMP
             WHERE status = 'completed'
               AND payment_method = 'cash'
               AND payment_status = 'pending'
               AND completed_at < CURRENT_TIMESTAMP - INTERVAL '2 hours'
             RETURNING id, ride_number, driver_id`
        );

        if (result.rows.length > 0) {
            logger.warn(`[Collection] Flagged ${result.rows.length} rides for admin review (stale cash collection)`);
        }

        return {
            success: true,
            flaggedCount: result.rows.length,
            rides: result.rows,
        };
    } catch (error) {
        logger.error('[Collection] flagStaleCashCollections error:', error);
        throw error;
    }
};
