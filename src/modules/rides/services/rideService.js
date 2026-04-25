import * as rideRepo from '../repositories/ride.repository.js';
import * as driverRepo from '../../drivers/repositories/driver.repository.js';
import * as walletRepo from '../../wallet/repositories/wallet.Repository.js';
import * as rideCalculator from '../../../core/utils/rideCalculator.js';
import { getWeatherSignal } from '../../../core/utils/weatherService.js';
import { ApiError, NotFoundError, ConflictError } from '../../../core/errors/ApiError.js';
import logger from '../../../core/logger/logger.js';
import { ENV } from '../../../config/envConfig.js';
import { db } from '../../../infrastructure/database/postgres.js';
import { payForRide } from '../../wallet/services/walletService.js';
import { creditDriverEarnings } from '../../drivers/services/earningsService.js';

// ─── Helper: gather REAL demand + weather signals ───────────────────────────
const gatherDemandSignals = async (vehicleType, latitude, longitude) => {
    const searchRadius    = Number(ENV.DEFAULT_SEARCH_RADIUS_KM) || 5;
    const demandWindow    = Number(ENV.DEMAND_WINDOW_MINUTES)    || 10;
    const velocityWindow  = Number(ENV.VELOCITY_WINDOW_MINUTES)  || 5;

    // All four queries run in parallel — demand + weather
    const [rideRequests, requestVelocity, nearbyDrivers, weatherSignal] = await Promise.all([
        rideRepo.countRecentRideRequests(vehicleType, latitude, longitude, searchRadius, demandWindow),
        rideRepo.getRequestVelocity(vehicleType, latitude, longitude, searchRadius, velocityWindow),
        rideRepo.findNearbyDrivers(vehicleType, latitude, longitude, searchRadius),
        getWeatherSignal(latitude, longitude)
    ]);

    const availableDrivers = nearbyDrivers.length;
    const pickupDistanceKm = availableDrivers > 0
        ? Number(nearbyDrivers[0].distance || 0)
        : 0;

    return { rideRequests, requestVelocity, availableDrivers, nearbyDrivers, pickupDistanceKm, weatherSignal };
};

// ═════════════════════════════════════════════════════════════════════════════
//  REQUEST RIDE — estimated fare with REAL demand signals
// ═════════════════════════════════════════════════════════════════════════════
export const requestRide = async (userId, rideData) => {
    try {
        const activeRide = await rideRepo.findActiveRideByPassenger(userId);
        if (activeRide) {
            throw new ConflictError('You already have an active ride');
        }

        // Distance & duration
        const distanceKm = rideCalculator.calculateDistance(
            rideData.pickupLatitude, rideData.pickupLongitude,
            rideData.dropoffLatitude, rideData.dropoffLongitude
        );
        const durationMinutes = rideCalculator.calculateDuration(distanceKm, rideData.vehicleType);

        // Real demand signals from DB
        const signals = await gatherDemandSignals(
            rideData.vehicleType,
            rideData.pickupLatitude,
            rideData.pickupLongitude
        );

        // Closest driver's daily ride count for platform fee cap
        const selectedDriverId = signals.availableDrivers > 0 ? signals.nearbyDrivers[0].id : null;
        const driverDailyRideCount = await rideRepo.getDriverDailyRideCount(selectedDriverId);

        // Calculate estimated fare (dynamic surge + weather, no waiting yet)
        const goFare = rideCalculator.calculateEstimatedFare({
            vehicleType:             rideData.vehicleType,
            distanceKm,
            estimatedDurationMinutes: durationMinutes,
            pickupDistanceKm:        signals.pickupDistanceKm,
            driverDailyRideCount,
            rideRequests:            signals.rideRequests,
            availableDrivers:        signals.availableDrivers,
            requestVelocity:         signals.requestVelocity,
            weatherSignal:           signals.weatherSignal
        });

        const fare = {
            baseFare:        goFare.passenger.baseFare,
            distanceFare:    goFare.passenger.distanceFare,
            timeFare:        durationMinutes,
            surgeMultiplier: goFare.passenger.surgeMultiplier,
            estimatedFare:   goFare.passenger.estimatedFare
        };

        const rideNumber = rideCalculator.generateRideNumber();

        const ride = await rideRepo.createRide({
            rideNumber,
            passengerId:       userId,
            vehicleType:       rideData.vehicleType,
            pickupLatitude:    rideData.pickupLatitude,
            pickupLongitude:   rideData.pickupLongitude,
            pickupAddress:     rideData.pickupAddress,
            pickupLocationName: rideData.pickupLocationName,
            dropoffLatitude:   rideData.dropoffLatitude,
            dropoffLongitude:  rideData.dropoffLongitude,
            dropoffAddress:    rideData.dropoffAddress,
            dropoffLocationName: rideData.dropoffLocationName,
            distanceKm,
            durationMinutes,
            baseFare:        fare.baseFare,
            distanceFare:    fare.distanceFare,
            timeFare:        fare.timeFare,
            surgeMultiplier: fare.surgeMultiplier,
            estimatedFare:   fare.estimatedFare,
            paymentMethod:   rideData.paymentMethod || 'cash'
        });

        logger.info(`Ride requested: ${rideNumber} for user ${userId}`);

        return {
            rideId:           ride.id,
            rideNumber:       ride.ride_number,
            vehicleType:      ride.vehicle_type,
            pickupAddress:    ride.pickup_address,
            dropoffAddress:   ride.dropoff_address,
            distanceKm:       ride.distance_km,
            durationMinutes:  ride.duration_minutes,
            estimatedFare:    ride.estimated_fare,
            surgeMultiplier:  ride.surge_multiplier,
            passengerFareBreakdown: goFare.passenger,
            driverEarningBreakdown: goFare.driver,
            pricingSignals:         goFare.signals,
            status:           ride.status,
            requestedAt:      ride.requested_at,
            nearbyDrivers:    signals.availableDrivers,
            message: 'Ride requested successfully. Finding nearby drivers...'
        };
    } catch (error) {
        logger.error('Request ride service error:', error);
        throw error;
    }
};

// ═════════════════════════════════════════════════════════════════════════════
//  CALCULATE FARE API — estimate with real demand (no booking)
//  Same flow as requestRide — pickup/dropoff se distance, demand signals from DB
// ═════════════════════════════════════════════════════════════════════════════
export const calculateFare = async (fareData) => {
    try {
        const { vehicleType, pickupLatitude, pickupLongitude, dropoffLatitude, dropoffLongitude } = fareData;

        // Same distance + duration calculation as requestRide
        const distanceKm = rideCalculator.calculateDistance(
            pickupLatitude, pickupLongitude,
            dropoffLatitude, dropoffLongitude
        );
        const durationMinutes = rideCalculator.calculateDuration(distanceKm, vehicleType);

        // Same demand signals from DB as requestRide
        const signals = await gatherDemandSignals(vehicleType, pickupLatitude, pickupLongitude);

        const selectedDriverId = signals.availableDrivers > 0 ? signals.nearbyDrivers[0].id : null;
        const driverDailyRideCount = await rideRepo.getDriverDailyRideCount(selectedDriverId);

        return rideCalculator.calculateEstimatedFare({
            vehicleType,
            distanceKm,
            estimatedDurationMinutes: durationMinutes,
            pickupDistanceKm:        signals.pickupDistanceKm,
            driverDailyRideCount,
            rideRequests:            signals.rideRequests,
            availableDrivers:        signals.availableDrivers,
            requestVelocity:         signals.requestVelocity,
            weatherSignal:           signals.weatherSignal
        });
    } catch (error) {
        logger.error('Calculate fare service error:', error);
        throw error;
    }
};

// ═════════════════════════════════════════════════════════════════════════════
//  FINAL FARE — called internally when ride status → completed
//  Uses LOCKED surge from request time + ACTUAL waiting & duration
// ═════════════════════════════════════════════════════════════════════════════
const calculateCompletionFare = async (ride) => {
    // Actual waited minutes: driver_arrived_at → started_at
    let waitedMinutes = 0;
    if (ride.driver_arrived_at && ride.started_at) {
        waitedMinutes = (new Date(ride.started_at) - new Date(ride.driver_arrived_at)) / 60000;
    }

    // Actual ride duration: started_at → completed_at
    let actualDurationMinutes = Number(ride.duration_minutes) || 0;
    if (ride.started_at && ride.completed_at) {
        actualDurationMinutes = (new Date(ride.completed_at) - new Date(ride.started_at)) / 60000;
    }

    // Pickup distance (driver location at assignment → pickup point)
    // Use the stored distance_km for pickup since we don't track driver's start point separately
    const pickupDistanceKm = 0; // TODO: track actual pickup distance when driver is assigned

    const driverDailyRideCount = await rideRepo.getDriverDailyRideCount(ride.driver_id);

    const result = rideCalculator.calculateFinalRideFare({
        vehicleType:             ride.vehicle_type,
        distanceKm:              Number(ride.distance_km) || 0,
        estimatedDurationMinutes: Number(ride.duration_minutes) || 0,
        actualDurationMinutes,
        waitedMinutes,
        surgeMultiplier:         Number(ride.surge_multiplier) || 1,
        pickupDistanceKm,
        driverDailyRideCount
    });

    return result;
};

// ═════════════════════════════════════════════════════════════════════════════
//  OTHER SERVICE METHODS (unchanged logic)
// ═════════════════════════════════════════════════════════════════════════════

export const findNearbyDrivers = async (vehicleType, latitude, longitude) => {
    try {
        const drivers = await rideRepo.findNearbyDrivers(
            vehicleType, latitude, longitude,
            ENV.DEFAULT_SEARCH_RADIUS_KM || 5
        );

        return drivers.map(driver => ({
            id:            driver.id,
            name:          driver.full_name,
            vehicleType:   driver.vehicle_type,
            vehicleNumber: driver.vehicle_number,
            vehicleModel:  driver.vehicle_model,
            vehicleColor:  driver.vehicle_color,
            rating:        parseFloat(driver.rating || 0).toFixed(1),
            distance:      parseFloat(driver.distance).toFixed(1),
            location: {
                latitude:  driver.current_latitude,
                longitude: driver.current_longitude
            }
        }));
    } catch (error) {
        logger.error('Find nearby drivers service error:', error);
        throw error;
    }
};

export const acceptRide = async (driverUserId, rideId) => {
    try {
        const driver = await driverRepo.findDriverByUserId(driverUserId);
        if (!driver) throw new NotFoundError('Driver not found');
        if (!driver.is_verified) throw new ApiError(403, 'Driver not verified');

        const activeRide = await rideRepo.findActiveRideByDriver(driver.id);
        if (activeRide) throw new ConflictError('You already have an active ride');

        const ride = await rideRepo.findRideById(rideId);
        if (!ride) throw new NotFoundError('Ride not found');
        if (ride.status !== 'requested') throw new ConflictError('Ride is no longer available');

        const updatedRide = await rideRepo.assignDriverToRide(rideId, driver.id);
        await driverRepo.updateDriver(driver.id, { is_on_duty: true });

        logger.info(`Driver ${driverUserId} accepted ride ${rideId}`);

        return {
            rideId:     updatedRide.id,
            rideNumber: updatedRide.ride_number,
            status:     updatedRide.status,
            message:    'Ride accepted successfully'
        };
    } catch (error) {
        logger.error('Accept ride service error:', error);
        throw error;
    }
};

export const updateRideStatus = async (driverUserId, rideId, statusData) => {
    try {
        const { status, cancellationReason } = statusData;

        const driver = await driverRepo.findDriverByUserId(driverUserId);
        if (!driver) throw new NotFoundError('Driver not found');

        const ride = await rideRepo.findRideById(rideId);
        if (!ride) throw new NotFoundError('Ride not found');
        if (ride.driver_id !== driver.id) throw new ApiError(403, 'You are not assigned to this ride');

        validateStatusTransition(ride.status, status);

        let additionalFields = {};

        if (status === 'cancelled') {
            additionalFields.cancelled_by = 'driver';
            additionalFields.cancellation_reason = cancellationReason || 'Driver cancelled';
            await driverRepo.updateDriver(driver.id, { is_on_duty: false });
        }

        if (status === 'completed') {
            // ── FINAL FARE with real actuals ──
            // We need completed_at for calculation, but it hasn't been set yet.
            // So we set it now for the calculation.
            const completedAt = new Date();
            const rideWithTimestamp = { ...ride, completed_at: completedAt };

            const finalResult = await calculateCompletionFare(rideWithTimestamp);

            additionalFields.actual_fare    = finalResult.passenger.finalFare;
            additionalFields.final_fare     = finalResult.passenger.finalFare;
            additionalFields.payment_status = 'pending';

            await driverRepo.updateDriver(driver.id, { is_on_duty: false });
            await driverRepo.updateDriver(driver.id, {
                total_rides:    driver.total_rides + 1,
                total_earnings: (driver.total_earnings || 0) + finalResult.driver.netEarnings
            });

            logger.info(`Ride ${rideId} final fare: ₹${finalResult.passenger.finalFare} (estimated: ₹${ride.estimated_fare})`);

            // ── AUTO WALLET PAYMENT ──
            // If payment method is wallet, auto-deduct and mark as paid immediately
            if (ride.payment_method === 'wallet') {
                try {
                    const passenger = await rideRepo.findPassengerById(ride.passenger_id);
                    if (passenger) {
                        // Process wallet payment
                        const walletPayment = await payForRide(passenger.user_id, {
                            ride_id: rideId,
                            amount: finalResult.passenger.finalFare,
                            description: `Payment for ride #${ride.ride_number}`,
                        });

                        if (walletPayment.success) {
                            // Update ride payment status to paid
                            additionalFields.payment_status = 'paid';

                            // Credit driver earnings immediately
                            await creditDriverEarnings({
                                driverUserId: driver.user_id,
                                rideId,
                                netEarnings: finalResult.driver.netEarnings,
                                platformFee: finalResult.driver.platformFee,
                                paymentMethod: 'wallet',
                            });

                            logger.info(`[Ride] Auto wallet payment successful | Ride: ${rideId} | Amount: ₹${finalResult.passenger.finalFare}`);
                        }
                    }
                } catch (walletError) {
                    // Wallet payment failed (insufficient balance etc.)
                    // Keep payment_status as 'pending', let frontend handle retry
                    logger.warn(`[Ride] Auto wallet payment failed | Ride: ${rideId}:`, walletError.message);
                    // Don't throw — ride is still completed, payment remains pending
                }
            }
        }

        const updatedRide = await rideRepo.updateRideStatus(rideId, status, additionalFields);

        logger.info(`Ride ${rideId} status updated to ${status}`);

        return {
            rideId:     updatedRide.id,
            rideNumber: updatedRide.ride_number,
            status:     updatedRide.status,
            ...(status === 'completed' && {
                estimatedFare: ride.estimated_fare,
                finalFare:     additionalFields.final_fare
            }),
            message: `Ride status updated to ${status}`
        };
    } catch (error) {
        logger.error('Update ride status service error:', error);
        throw error;
    }
};

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

        return formatRideResponse(ride);
    } catch (error) {
        logger.error('Get ride details service error:', error);
        throw error;
    }
};

export const getPassengerRideHistory = async (userId, { page = 1, limit = 10, status }) => {
    try {
        const offset = (page - 1) * limit;
        const rides = await rideRepo.findRidesByPassenger(userId, { limit, offset, status });
        const total = await rideRepo.countRidesByPassenger(userId, status);

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
        const rides = await rideRepo.findRidesByDriver(driver.id, { limit, offset, status });
        const total = await rideRepo.countRidesByDriver(driver.id, status);

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

export const rateRide = async (userId, rideId, rating, review) => {
    try {
        const ride = await rideRepo.findRideById(rideId);
        if (!ride) throw new NotFoundError('Ride not found');
        if (ride.passenger_id !== userId) throw new ApiError(403, 'You are not authorized to rate this ride');
        if (ride.status !== 'completed') throw new ApiError(400, 'Can only rate completed rides');
        if (ride.rating) throw new ApiError(400, 'Ride already rated');

        await rideRepo.rateRide(rideId, rating, review);

        if (ride.driver_id) {
            await updateDriverRating(ride.driver_id);
        }

        return { success: true, message: 'Ride rated successfully' };
    } catch (error) {
        logger.error('Rate ride service error:', error);
        throw error;
    }
};

// ─── Internal Helpers ───────────────────────────────────────────────────────

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
                 SELECT AVG(rating) FROM rides WHERE driver_id = $1 AND rating IS NOT NULL
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
    pickupLocation:  { latitude: ride.pickup_latitude, longitude: ride.pickup_longitude },
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
    driverAssignedAt: ride.driver_assigned_at,
    startedAt:       ride.started_at,
    completedAt:     ride.completed_at,
    cancelledAt:     ride.cancelled_at,
    cancelledBy:     ride.cancelled_by,
    cancellationReason: ride.cancellation_reason,
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
    id:            ride.id,
    rideNumber:    ride.ride_number,
    vehicleType:   ride.vehicle_type,
    pickupAddress: ride.pickup_address,
    dropoffAddress: ride.dropoff_address,
    distanceKm:    ride.distance_km,
    estimatedFare: ride.estimated_fare,
    actualFare:    ride.actual_fare,
    finalFare:     ride.final_fare,
    status:        ride.status,
    paymentStatus: ride.payment_status,
    requestedAt:   ride.requested_at,
    completedAt:   ride.completed_at,
    passengerName: ride.passenger_name,
    driverName:    ride.driver_name
});
