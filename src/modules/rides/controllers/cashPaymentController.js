import { confirmCashCollection } from '../services/ridePaymentService.js';
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
        const userId = req.user.id; // Driver ID
        const { ride_id } = req.body;

        // Get ride details to verify
        const ride = await getRideDetails(userId, ride_id, 'driver');
        if (!ride) {
            throw new ApiError('Ride not found', 404);
        }

        // Check if ride is completed
        if (ride.status !== 'completed') {
            throw new ApiError('Ride must be completed before confirming cash payment', 400);
        }

        // Check if payment status is cash_collected
        if (ride.paymentStatus !== 'cash_collected') {
            throw new ApiError('Cash payment not recorded for this ride', 400);
        }

        // Confirm cash collection
        const updatedRide = await confirmCashCollection(ride_id, userId);

        res.status(200).json({
            success: true,
            message: 'Cash payment confirmed successfully',
            data: {
                ride: updatedRide,
                payment_method: 'cash',
                amount: ride.finalFare || ride.estimatedFare,
                status: 'cash_confirmed',
                confirmed_at: new Date()
            }
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
            throw new ApiError('Ride not found', 404);
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
