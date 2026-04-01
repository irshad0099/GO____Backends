import * as cancelRepo from '../repositories/rideCancellation.repository.js';
import * as rideRepo from '../repositories/ride.repository.js';
import { NotFoundError, ApiError } from '../../../core/errors/ApiError.js';
import logger from '../../../core/logger/logger.js';
import { ENV } from '../../../config/envConfig.js';

export const cancelRide = async (userId, rideId, data) => {
    try {
        const ride = await rideRepo.findRideById(rideId);
        if (!ride) throw new NotFoundError('Ride');

        // Check if this user is the passenger
        if (ride.passenger_id !== userId) {
            throw new ApiError(403, 'You can only cancel your own ride');
        }

        // Check if ride is cancellable
        const cancellableStatuses = ['requested', 'driver_assigned', 'driver_arrived'];
        if (!cancellableStatuses.includes(ride.status)) {
            throw new ApiError(400, `Cannot cancel ride in '${ride.status}' status`);
        }

        // Calculate penalty
        let penaltyApplied = false;
        let penaltyAmount = 0;
        let driverShare = 0;
        let platformShare = 0;

        // Penalty lagti hai agar: driver assigned hai + driver already near
        if (ride.status !== 'requested' && data.driver_distance_meters > ENV.CANCELLATION_DISTANCE_THRESHOLD) {
            penaltyApplied = true;
            penaltyAmount = ENV.CANCELLATION_PENALTY;
            driverShare = (penaltyAmount * ENV.CANCELLATION_DRIVER_SHARE_PERCENT) / 100;
            platformShare = (penaltyAmount * ENV.CANCELLATION_PLATFORM_SHARE_PERCENT) / 100;
        }

        // Insert cancellation record
        const cancellation = await cancelRepo.insert({
            ride_id: rideId,
            cancelled_by_user: userId,
            cancelled_by_role: 'passenger',
            reason_code: data.reason_code,
            reason_text: data.reason_text,
            driver_distance_meters: data.driver_distance_meters || 0,
            penalty_applied: penaltyApplied,
            penalty_amount: penaltyAmount,
            driver_share: driverShare,
            platform_share: platformShare,
            ride_status_at_cancel: ride.status
        });

        // Update ride status
        await rideRepo.updateRideStatus(rideId, 'cancelled', {
            cancelled_by: 'passenger',
            cancellation_reason: data.reason_code,
            cancelled_at: new Date()
        });

        return {
            rideId,
            status: 'cancelled',
            penaltyApplied,
            penaltyAmount,
            message: penaltyApplied
                ? `Ride cancelled. Cancellation fee of ₹${penaltyAmount} applied.`
                : 'Ride cancelled successfully. No penalty charged.'
        };
    } catch (error) {
        logger.error('Cancel ride service error:', error);
        throw error;
    }
};
