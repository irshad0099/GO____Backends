import * as rideRepo from '../repositories/ride.repository.js';
import * as driverRepo from '../../drivers/repositories/driver.repository.js';
import * as walletRepo from '../../wallet/repositories/wallet.repository.js';
import * as rideOtpService from './rideOtpService.js';
import * as rideOtpRepo from '../repositories/rideOtp.repository.js';
import * as rideCalculator from '../../../core/utils/rideCalculator.js';
import { getWeatherSignal } from '../../../core/utils/weatherService.js';
import * as couponService from '../../coupons/services/couponService.js';
import * as subscriptionService from '../../subscription/services/subscriptionService.js';
import { ApiError, NotFoundError, ConflictError } from '../../../core/errors/ApiError.js';
import logger from '../../../core/logger/logger.js';
import { ENV } from '../../../config/envConfig.js';
import { db } from '../../../infrastructure/database/postgres.js';
import { getDistanceAndDuration, getDriverETA, geocodeAddress } from '../../../core/services/googleMapsService.js';
import { 
    sendRideReceipt, 
    sendRideCancelledEmail 
} from '../../../core/services/emailService.js';

import { 
    getCachedNearbyDrivers, 
    setCachedNearbyDrivers,
    getCachedSurge,        // ++ ADD
    setCachedSurge,        // ++ ADD
} from '../../../core/services/redisService.js';
import {
    emitRideRequest,
    emitRideStatusUpdate,
    emitToPassenger,
    emitToDriver
} from '../../../infrastructure/websocket/socket.events.js';
import {
    sendAssignmentToPassenger,
    sendAssignmentToDriver,
    notifyDriverArrival
} from '../../../infrastructure/websocket/assignment.handler.js';
import { addRideCompletionJob, addNotificationJob } from '../../../infrastructure/queue/rideQueue.js';

const safeEmit = (fn, label) => {
    try { fn(); } catch (err) { logger.warn(`Socket emit failed (${label}): ${err.message}`); }
};

// ... rest of the code remains the same ...
            rideNumber:         updatedRide.ride_number,
            cancellationReason: additionalFields.cancellation_reason || null,
            ...(status === 'completed' && {
                finalFare:            additionalFields.final_fare,
                subscriptionDiscount: Number(ride.subscription_discount) || 0,
                couponDiscount:       Number(ride.coupon_discount) || 0,
                isFreeRide:           ride.is_free_ride || false
            })
        }), `ride:status_changed:${status}`);

        if (status === 'driver_arrived') {
            safeEmit(() => notifyDriverArrival(rideId, ride.passenger_id, driver.id, {
                latitude:  driver.current_latitude,
                longitude: driver.current_longitude
            }), 'ride:driver_arrived');
        }

        return {
            rideId:     updatedRide.id,
            rideNumber: updatedRide.ride_number,
            status:     updatedRide.status,
            ...(status === 'completed' && {
                estimatedFare:        ride.estimated_fare,
                finalFare:            additionalFields.final_fare,
                subscriptionDiscount: Number(ride.subscription_discount) || 0,
                couponDiscount:       Number(ride.coupon_discount)        || 0,
                isFreeRide:           ride.is_free_ride || false
            }),
            message: `Ride status updated to ${status}`
        };
    } catch (error) {
        logger.error('Update ride status service error:', error);
        throw error;
    }
};

// ═════════════════════════════════════════════════════════════════════════════
//  GET RIDE DETAILS
// ═════════════════════════════════════════════════════════════════════════════
export const getRideDetails = async (userId, rideId, userRole) => {
    try {
        const ride = await rideRepo.findRideById(rideId);
        if (!ride) throw new NotFoundError('Ride not found');

        if (userRole === 'passenger' && ride.passenger_id !== userId) {
            throw new ApiError(403, 'You do not have access to this ride');
        }
        if (userRole === 'driver') {
            const driver = await driverRepo.findDriverByUserId(userId);
            if (!driver || ride.driver_id !== driver.id) {
                throw new ApiError(403, 'You do not have access to this ride');
            }
        }

        const response = formatRideResponse(ride);

        // Passenger ko OTP dikhao jab driver assigned ho aur ride start na hui ho
        if (userRole === 'passenger' && ['driver_assigned', 'driver_arrived'].includes(ride.status)) {
            const otpRow = await rideOtpRepo.findLatest(rideId);
            response.otp = otpRow ? otpRow.otp_code : null;
        }

        return response;
    } catch (error) {
        logger.error('Get ride details service error:', error);
        throw error;
    }
};

// ═════════════════════════════════════════════════════════════════════════════
//  RIDE HISTORY
// ═════════════════════════════════════════════════════════════════════════════
export const getPassengerRideHistory = async (userId, { page = 1, limit = 10, status }) => {
    try {
        const offset = (page - 1) * limit;
        const rides  = await rideRepo.findRidesByPassenger(userId, { limit, offset, status });
        const total  = await rideRepo.countRidesByPassenger(userId, status);

        return {
            rides: rides.map(formatRideListResponse),
            pagination: {
                page:  parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        };
    } catch (error) {
        logger.error('Get passenger ride history service error:', error);
        throw error;
    }
};

export const getDriverRideHistory = async (driverUserId, { page = 1, limit = 10, status }) => {
    try {
        const driver = await driverRepo.findDriverByUserId(driverUserId);
        if (!driver) throw new NotFoundError('Driver not found');

        const offset = (page - 1) * limit;
        const rides  = await rideRepo.findRidesByDriver(driver.id, { limit, offset, status });
        const total  = await rideRepo.countRidesByDriver(driver.id, status);

        return {
            rides: rides.map(formatRideListResponse),
            pagination: {
                page:  parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        };
    } catch (error) {
        logger.error('Get driver ride history service error:', error);
        throw error;
    }
};

// ═════════════════════════════════════════════════════════════════════════════
//  GET CURRENT RIDE
// ═════════════════════════════════════════════════════════════════════════════
export const getCurrentRide = async (userId, userRole) => {
    try {
        let ride;
        if (userRole === 'passenger') {
            ride = await rideRepo.findActiveRideByPassenger(userId);
        } else {
            const driver = await driverRepo.findDriverByUserId(userId);
            if (!driver) throw new NotFoundError('Driver not found');
            ride = await rideRepo.findActiveRideByDriver(driver.id);
        }

        if (!ride) return { hasActiveRide: false };
        return { hasActiveRide: true, ride: formatRideResponse(ride) };
    } catch (error) {
        logger.error('Get current ride service error:', error);
        throw error;
    }
};

// ═════════════════════════════════════════════════════════════════════════════
//  RATE RIDE
// ═════════════════════════════════════════════════════════════════════════════
export const rateRide = async (userId, rideId, rating, review) => {
    try {
        const ride = await rideRepo.findRideById(rideId);
        if (!ride) throw new NotFoundError('Ride not found');
        if (ride.passenger_id !== userId) throw new ApiError(403, 'You are not authorized to rate this ride');
        if (ride.status !== 'completed') throw new ApiError(400, 'Can only rate completed rides');
        if (ride.rating) throw new ApiError(400, 'Ride already rated');

        await rideRepo.rateRide(rideId, rating, review);
        if (ride.driver_id) await updateDriverRating(ride.driver_id);

        // ── FCM 4: Driver ko rating notification ──────────────────────────────
        if (ride.driver_fcm_token) {
            const stars = '⭐'.repeat(Math.min(Math.round(rating), 5));
            await sendNotification(
                ride.driver_fcm_token,
                'New Rating Received!',
                `${stars} You got ${rating} stars${review ? ` — "${review}"` : ''}`,
                {
                    type:   'new_rating',
                    rideId: String(rideId),
                    rating: String(rating),
                }
            );
        }

        return { success: true, message: 'Ride rated successfully' };
    } catch (error) {
        logger.error('Rate ride service error:', error);
        throw error;
    }
};

// ─── Internal Helpers ────────────────────────────────────────────────────────
const validateStatusTransition = (currentStatus, newStatus) => {
    const validTransitions = {
        'requested':       ['driver_assigned', 'cancelled'],
        'driver_assigned': ['driver_arrived', 'cancelled'],
        'driver_arrived':  ['in_progress', 'cancelled'],
        'in_progress':     ['completed'],
        'completed':       [],
        'cancelled':       []
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
        throw new ApiError(400, `Cannot transition from ${currentStatus} to ${newStatus}`);
    }
};

const updateDriverRating = async (driverId) => {
    try {
        await db.query(
            `UPDATE drivers
             SET rating = (
                 SELECT AVG(rating) FROM rides
                 WHERE driver_id = $1 AND rating IS NOT NULL
             )
             WHERE id = $1`,
            [driverId]
        );
    } catch (error) {
        logger.error('Update driver rating error:', error);
    }
};

const formatRideResponse = (ride) => ({
    id:              ride.id,
    rideNumber:      ride.ride_number,
    vehicleType:     ride.vehicle_type,
    pickupAddress:   ride.pickup_address,
    pickupLocation:  { latitude: ride.pickup_latitude,  longitude: ride.pickup_longitude  },
    dropoffAddress:  ride.dropoff_address,
    dropoffLocation: { latitude: ride.dropoff_latitude, longitude: ride.dropoff_longitude },
    distanceKm:      ride.distance_km,
    durationMinutes: ride.duration_minutes,
    estimatedFare:   ride.estimated_fare,
    actualFare:      ride.actual_fare,
    finalFare:       ride.final_fare,
    status:          ride.status,
    paymentStatus:   ride.payment_status,
    paymentMethod:   ride.payment_method,
    requestedAt:     ride.requested_at,
    driverAssignedAt:    ride.driver_assigned_at,
    startedAt:           ride.started_at,
    completedAt:         ride.completed_at,
    cancelledAt:         ride.cancelled_at,
    cancelledBy:         ride.cancelled_by,
    cancellationReason:  ride.cancellation_reason,
    passenger: ride.passenger_name ? {
        name:  ride.passenger_name,
        phone: ride.passenger_phone
    } : null,
    driver: ride.driver_name ? {
        name:          ride.driver_name,
        phone:         ride.driver_phone,
        vehicleType:   ride.vehicle_type,
        vehicleNumber: ride.vehicle_number,
        vehicleModel:  ride.vehicle_model,
        vehicleColor:  ride.vehicle_color
    } : null,
    driverLocation: ride.driver_current_latitude ? {
        latitude:  ride.driver_current_latitude,
        longitude: ride.driver_current_longitude
    } : null,
    rating: ride.rating,
    review: ride.review
});

const formatRideListResponse = (ride) => ({
    id:             ride.id,
    rideNumber:     ride.ride_number,
    vehicleType:    ride.vehicle_type,
    pickupAddress:  ride.pickup_address,
    dropoffAddress: ride.dropoff_address,
    distanceKm:     ride.distance_km,
    estimatedFare:  ride.estimated_fare,
    actualFare:     ride.actual_fare,
    finalFare:      ride.final_fare,
    status:         ride.status,
    paymentStatus:  ride.payment_status,
    requestedAt:    ride.requested_at,
    completedAt:    ride.completed_at,
    passengerName:  ride.passenger_name,
    driverName:     ride.driver_name
});