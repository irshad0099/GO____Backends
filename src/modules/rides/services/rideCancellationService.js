import * as cancelRepo from '../repositories/rideCancellation.repository.js';
import * as rideRepo from '../repositories/ride.repository.js';
import * as driverRepo from '../../drivers/repositories/driver.repository.js';
import { chargeCancellationFee } from '../../wallet/services/walletService.js';
import { refundFreeRideOnCancel } from '../../subscription/services/subscriptionService.js';
import { NotFoundError, ApiError } from '../../../core/errors/ApiError.js';
import logger from '../../../core/logger/logger.js';
import { calculateCancellationPenalty } from '../../../core/utils/rideCalculator.js';

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
        if (ride.status !== 'requested') {
            const pen = calculateCancellationPenalty(data.driver_distance_meters);
            if (pen.isApplicable) {
                penaltyApplied = true;
                penaltyAmount  = pen.penalty;
                driverShare    = pen.driverShare;
                platformShare  = pen.platformShare;
            }
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

        // // Update ride status
        // await rideRepo.updateRideStatus(rideId, 'cancelled', {
        //     cancelled_by: 'passenger',
        //     cancellation_reason: data.reason_code,
        //     cancelled_at: new Date()
        // });


        await rideRepo.updateRideStatus(rideId, 'cancelled', {
            cancelled_by: 'passenger',
            cancellation_reason: data.reason_code,
        });

        // FIX: Free up the driver if one was already assigned
        if (ride.driver_id) {
            await driverRepo.updateDriver(ride.driver_id, { is_on_duty: false });
        }

        // Refund the free ride if this ride was a subscription free ride —
        // user shouldn't lose a free ride to a cancellation.
        if (ride.is_free_ride) {
            await refundFreeRideOnCancel(userId);
        }

        // Penalty actually charge karo wallet se
        if (penaltyApplied && penaltyAmount > 0) {
            try {
                await chargeCancellationFee(userId, {
                    ride_id:     rideId,
                    amount:      penaltyAmount,
                    description: `Cancellation fee for ride #${rideId}`,
                });
            } catch (feeErr) {
                // Cancellation toh ho gayi — fee fail hone pe log karo, ride block mat karo
                logger.error(`[cancelRide] Cancellation fee charge failed | ride=${rideId} | user=${userId}:`, feeErr.message);
            }
        }

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

export const driverCancelRide = async (driverUserId, rideId) => {
    try {
        const driver = await driverRepo.findDriverByUserId(driverUserId);
        if (!driver) throw new NotFoundError('Driver not found');

        const ride = await rideRepo.findRideById(rideId);
        if (!ride) throw new NotFoundError('Ride');
        if (ride.driver_id !== driver.id) throw new ApiError(403, 'This ride is not assigned to you');

        const cancellableStatuses = ['driver_assigned', 'driver_arrived'];
        if (!cancellableStatuses.includes(ride.status)) {
            throw new ApiError(400, `Cannot cancel ride in '${ride.status}' status`);
        }

        await cancelRepo.insert({
            ride_id:              rideId,
            cancelled_by_user:    driverUserId,
            cancelled_by_role:    'driver',
            reason_code:          'emergency',
            reason_text:          'Driver emergency cancel',
            driver_distance_meters: 0,
            penalty_applied:      false,
            penalty_amount:       0,
            driver_share:         0,
            platform_share:       0,
            ride_status_at_cancel: ride.status,
        });

        await rideRepo.updateRideStatus(rideId, 'cancelled', {
            cancelled_by:         'driver',
            cancellation_reason:  'emergency',
        });

        // FIX: Free up the driver
        await driverRepo.updateDriver(driver.id, { is_on_duty: false });

        // Refund the free ride to the passenger (driver-initiated cancel
        // should never burn the passenger's free ride).
        if (ride.is_free_ride) {
            await refundFreeRideOnCancel(ride.passenger_id);
        }

        logger.info(`[driverCancelRide] driver=${driver.id} emergency cancelled ride=${rideId}`);
        return { rideId, status: 'cancelled', message: 'Ride cancelled successfully' };
    } catch (error) {
        logger.error('Driver cancel ride service error:', error);
        throw error;
    }
};
