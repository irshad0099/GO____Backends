import { confirmManualCollection } from '../services/rideCollectionService.js';
import { getRideDetails } from '../services/rideService.js';
import logger from '../../../core/logger/logger.js';
import { ApiError } from '../../../core/errors/ApiError.js';

/**
 * Confirm cash payment collected by driver
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const confirmCashPayment = async (req, res, next) => {
    try {
        const userId = req.user.id; // Driver user ID
        const { ride_id, method = 'cash' } = req.body;

        // Get ride details to verify
        const ride = await getRideDetails(userId, ride_id, 'driver');
        if (!ride) {
            throw new ApiError(404, 'Ride not found');
        }

        // Check if ride is completed
        if (ride.status !== 'completed') {
            throw new ApiError(400, 'Ride must be completed before confirming cash payment');
        }

        // Confirm cash collection with ledger entry creation
        const result = await confirmManualCollection(userId, ride_id, { method });

        res.status(200).json({
            success: true,
            message: result.message,
            data: result.data
        });

    } catch (error) {
        next(error);
    }
};

/**
 * Get cash payment status for a ride
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getCashPaymentStatus = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { ride_id } = req.params;

        // Get ride details
        const ride = await getRideDetails(userId, ride_id, 'driver');
        if (!ride) {
            throw new ApiError(404, 'Ride not found');
        }

        res.status(200).json({
            success: true,
            message: 'Cash payment status retrieved',
            data: {
                ride_id: ride.id,
                ride_number: ride.rideNumber,
                payment_status: ride.paymentStatus,
                payment_method: ride.paymentMethod,
                amount: ride.finalFare || ride.estimatedFare,
                payment_collected_at: ride.paymentCollectedAt,
                cash_confirmed_at: ride.cashConfirmedAt,
                status: ride.status
            }
        });

    } catch (error) {
        next(error);
    }
};
