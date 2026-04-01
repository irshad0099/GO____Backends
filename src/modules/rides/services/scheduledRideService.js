import * as schedRepo from '../repositories/scheduledRide.repository.js';
import { NotFoundError, ApiError } from '../../../core/errors/ApiError.js';
import logger from '../../../core/logger/logger.js';

const MIN_ADVANCE_MINUTES = 30;
const MAX_ADVANCE_DAYS = 7;

export const scheduleRide = async (userId, data) => {
    try {
        const pickupTime = new Date(data.pickup_time);
        const now = new Date();

        // Min 30 min advance
        const minTime = new Date(now.getTime() + MIN_ADVANCE_MINUTES * 60000);
        if (pickupTime < minTime) {
            throw new ApiError(400, `Scheduled ride must be at least ${MIN_ADVANCE_MINUTES} minutes in advance`);
        }

        // Max 7 days advance
        const maxTime = new Date(now.getTime() + MAX_ADVANCE_DAYS * 24 * 60 * 60000);
        if (pickupTime > maxTime) {
            throw new ApiError(400, `Cannot schedule more than ${MAX_ADVANCE_DAYS} days in advance`);
        }

        const result = await schedRepo.insert({
            passenger_id: userId,
            ...data
        });

        return {
            id: result.id,
            pickupTime: result.pickup_time,
            status: result.status,
            pickupAddress: result.pickup_address,
            dropoffAddress: result.dropoff_address,
            vehicleType: result.vehicle_type,
            message: 'Ride scheduled successfully!'
        };
    } catch (error) {
        logger.error('Schedule ride service error:', error);
        throw error;
    }
};

export const getMyScheduledRides = async (userId, status) => {
    try {
        const rides = await schedRepo.findByPassenger(userId, status);
        return rides.map(r => ({
            id: r.id, status: r.status,
            pickupTime: r.pickup_time,
            pickupAddress: r.pickup_address, pickupLocationName: r.pickup_location_name,
            dropoffAddress: r.dropoff_address, dropoffLocationName: r.dropoff_location_name,
            vehicleType: r.vehicle_type, paymentMethod: r.payment_method,
            estimatedFare: r.estimated_fare ? parseFloat(r.estimated_fare) : null,
            rideId: r.ride_id, createdAt: r.created_at
        }));
    } catch (error) {
        logger.error('Get scheduled rides service error:', error);
        throw error;
    }
};

export const cancelScheduledRide = async (userId, scheduleId, reason) => {
    try {
        const result = await schedRepo.cancel(scheduleId, userId, reason);
        if (!result) throw new NotFoundError('Scheduled ride');

        return { id: result.id, status: 'cancelled', message: 'Scheduled ride cancelled' };
    } catch (error) {
        logger.error('Cancel scheduled ride service error:', error);
        throw error;
    }
};
