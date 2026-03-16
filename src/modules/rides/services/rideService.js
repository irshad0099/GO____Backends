import * as rideRepo from '../repositories/ride.repository.js';
import * as driverRepo from '../../drivers/repositories/driver.repository.js';
import * as walletRepo from '../../wallet/repositories/wallet.repository.js';
import *as rideCalculator from '../../../core/utils/rideCalculator.js';
import { ApiError, NotFoundError, ConflictError } from '../../../core/errors/ApiError.js';
import logger from '../../../core/logger/logger.js';
import { ENV } from '../../../config/envConfig.js';   // ✅ sahi

export const requestRide = async (userId, rideData) => {
    try {
        // Check if user has active ride
        const activeRide = await rideRepo.findActiveRideByPassenger(userId);
        if (activeRide) {
            throw new ConflictError('You already have an active ride');
        }

        // Calculate distance
        const distanceKm = rideCalculator.calculateDistance(
            rideData.pickupLatitude,
            rideData.pickupLongitude,
            rideData.dropoffLatitude,
            rideData.dropoffLongitude
        );

        // Calculate duration
        const durationMinutes = rideCalculator.calculateDuration(
            distanceKm,
            rideData.vehicleType
        );

        // Find nearby drivers for surge calculation
        const nearbyDrivers = await rideRepo.findNearbyDrivers(
            rideData.vehicleType,
            rideData.pickupLatitude,
            rideData.pickupLongitude,
            ENV.DEFAULT_SEARCH_RADIUS_KM || 2.5
        );

        // Calculate surge multiplier
        const totalRequests = 10; // This should come from Redis/cache
        const surgeMultiplier = rideCalculator.calculateSurgeMultiplier(
            nearbyDrivers.length,
            totalRequests
        );

        // Calculate fare
        const fare = rideCalculator.calculateRideFare(
            rideData.vehicleType,
            distanceKm,
            durationMinutes,
            surgeMultiplier
        );

        // Generate ride number
        const rideNumber = rideCalculator.generateRideNumber();

        // Create ride
        const ride = await rideRepo.createRide({
            rideNumber,
            passengerId: userId,
            vehicleType: rideData.vehicleType,
            pickupLatitude: rideData.pickupLatitude,
            pickupLongitude: rideData.pickupLongitude,
            pickupAddress: rideData.pickupAddress,
            pickupLocationName: rideData.pickupLocationName,
            dropoffLatitude: rideData.dropoffLatitude,
            dropoffLongitude: rideData.dropoffLongitude,
            dropoffAddress: rideData.dropoffAddress,
            dropoffLocationName: rideData.dropoffLocationName,
            distanceKm,
            durationMinutes,
            baseFare: fare.baseFare,
            distanceFare: fare.distanceFare,
            timeFare: fare.timeFare,
            surgeMultiplier: fare.surgeMultiplier,
            estimatedFare: fare.estimatedFare,
            paymentMethod: rideData.paymentMethod || 'cash'
        });

        logger.info(`Ride requested: ${rideNumber} for user ${userId}`);

        return {
            rideId: ride.id,
            rideNumber: ride.ride_number,
            vehicleType: ride.vehicle_type,
            pickupAddress: ride.pickup_address,
            dropoffAddress: ride.dropoff_address,
            distanceKm: ride.distance_km,
            durationMinutes: ride.duration_minutes,
            estimatedFare: ride.estimated_fare,
            surgeMultiplier: ride.surge_multiplier,
            status: ride.status,
            requestedAt: ride.requested_at,
            nearbyDrivers: nearbyDrivers.length,
            message: 'Ride requested successfully. Finding nearby drivers...'
        };
    } catch (error) {
        logger.error('Request ride service error:', error);
        throw error;
    }
};

export const findNearbyDrivers = async (vehicleType, latitude, longitude) => {
    try {
        const drivers = await rideRepo.findNearbyDrivers(
            vehicleType,
            latitude,
            longitude,
            ENV.DEFAULT_SEARCH_RADIUS_KM || 5
        );

        return drivers.map(driver => ({
            id: driver.id,
            name: driver.full_name,
            vehicleType: driver.vehicle_type,
            vehicleNumber: driver.vehicle_number,
            vehicleModel: driver.vehicle_model,
            vehicleColor: driver.vehicle_color,
            rating: parseFloat(driver.rating || 0).toFixed(1),
            distance: parseFloat(driver.distance).toFixed(1),
            location: {
                latitude: driver.current_latitude,
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
        // Get driver details
        const driver = await driverRepo.findDriverByUserId(driverUserId);
        if (!driver) {
            throw new NotFoundError('Driver not found');
        }

        if (!driver.is_verified) {
            throw new ApiError(403, 'Driver not verified');
        }

        // Check if driver has active ride
        const activeRide = await rideRepo.findActiveRideByDriver(driver.id);
        if (activeRide) {
            throw new ConflictError('You already have an active ride');
        }

        // Get ride details
        const ride = await rideRepo.findRideById(rideId);
        if (!ride) {
            throw new NotFoundError('Ride not found');
        }

        if (ride.status !== 'requested') {
            throw new ConflictError('Ride is no longer available');
        }

        // Assign driver to ride
        const updatedRide = await rideRepo.assignDriverToRide(rideId, driver.id);

        // Update driver availability
        await driverRepo.updateDriver(driver.id, { is_on_duty: true });

        logger.info(`Driver ${driverUserId} accepted ride ${rideId}`);

        return {
            rideId: updatedRide.id,
            rideNumber: updatedRide.ride_number,
            status: updatedRide.status,
            message: 'Ride accepted successfully'
        };
    } catch (error) {
        logger.error('Accept ride service error:', error);
        throw error;
    }
};

export const updateRideStatus = async (driverUserId, rideId, statusData) => {
    try {
        const { status, cancellationReason } = statusData;

        // Get driver details
        const driver = await driverRepo.findDriverByUserId(driverUserId);
        if (!driver) {
            throw new NotFoundError('Driver not found');
        }

        // Get ride details
        const ride = await rideRepo.findRideById(rideId);
        if (!ride) {
            throw new NotFoundError('Ride not found');
        }

        // Verify driver is assigned to this ride
        if (ride.driver_id !== driver.id) {
            throw new ApiError(403, 'You are not assigned to this ride');
        }

        // Validate status transition
        validateStatusTransition(ride.status, status);

        let additionalFields = {};
        if (status === 'cancelled') {
            additionalFields.cancelled_by = 'driver';
            additionalFields.cancellation_reason = cancellationReason || 'Driver cancelled';
            
            // Free driver for next ride
            await driverRepo.updateDriver(driver.id, { is_on_duty: false });
        }

        if (status === 'completed') {
            // Calculate final fare
            const finalFare = calculateFinalFare(ride);
            additionalFields.actual_fare = finalFare;
            additionalFields.final_fare = finalFare;
            additionalFields.payment_status = 'pending';
            
            // Free driver for next ride
            await driverRepo.updateDriver(driver.id, { is_on_duty: false });
            
            // Update driver stats
            await driverRepo.updateDriver(driver.id, {
                total_rides: driver.total_rides + 1,
                total_earnings: (driver.total_earnings || 0) + finalFare
            });
        }

        // if (status === 'driver_arrived') {
        //     additionalFields.driver_arrived_at = new Date();
        // }

        // if (status === 'in_progress') {
        //     additionalFields.started_at = new Date();
        // }

        // Update ride status
        const updatedRide = await rideRepo.updateRideStatus(rideId, status, additionalFields);

        logger.info(`Ride ${rideId} status updated to ${status}`);

        return {
            rideId: updatedRide.id,
            rideNumber: updatedRide.ride_number,
            status: updatedRide.status,
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
        if (!ride) {
            throw new NotFoundError('Ride not found');
        }

        // Verify user has access to this ride
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
            rides: rides.map(ride => formatRideListResponse(ride)),
            pagination: {
                page: parseInt(page),
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
        if (!driver) {
            throw new NotFoundError('Driver not found');
        }

        const offset = (page - 1) * limit;
        
        const rides = await rideRepo.findRidesByDriver(driver.id, { limit, offset, status });
        const total = await rideRepo.countRidesByDriver(driver.id, status);

        return {
            rides: rides.map(ride => formatRideListResponse(ride)),
            pagination: {
                page: parseInt(page),
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
            if (!driver) {
                throw new NotFoundError('Driver not found');
            }
            ride = await rideRepo.findActiveRideByDriver(driver.id);
        }

        if (!ride) {
            return { hasActiveRide: false };
        }

        return {
            hasActiveRide: true,
            ride: formatRideResponse(ride)
        };
    } catch (error) {
        logger.error('Get current ride service error:', error);
        throw error;
    }
};

export const rateRide = async (userId, rideId, rating, review) => {
    try {
        const ride = await rideRepo.findRideById(rideId);
        if (!ride) {
            throw new NotFoundError('Ride not found');
        }

        if (ride.passenger_id !== userId) {
            throw new ApiError(403, 'You are not authorized to rate this ride');
        }

        if (ride.status !== 'completed') {
            throw new ApiError(400, 'Can only rate completed rides');
        }

        if (ride.rating) {
            throw new ApiError(400, 'Ride already rated');
        }

        const updatedRide = await rideRepo.rateRide(rideId, rating, review);

        // Update driver rating
        if (ride.driver_id) {
            await updateDriverRating(ride.driver_id);
        }

        return {
            success: true,
            message: 'Ride rated successfully'
        };
    } catch (error) {
        logger.error('Rate ride service error:', error);
        throw error;
    }
};

// Helper functions
const validateStatusTransition = (currentStatus, newStatus) => {
    const validTransitions = {
        'requested': ['driver_assigned', 'cancelled'],
        'driver_assigned': ['driver_arrived', 'cancelled'],
        'driver_arrived': ['in_progress', 'cancelled'],
        'in_progress': ['completed'],
        'completed': [],
        'cancelled': []
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
        throw new ApiError(400, `Cannot transition from ${currentStatus} to ${newStatus}`);
    }
};

const calculateFinalFare = (ride) => {
    // Add waiting charges, tolls, etc.
    return ride.estimated_fare;
};

const updateDriverRating = async (driverId) => {
    try {
        const result = await db.query(
            `UPDATE drivers 
             SET rating = (
                 SELECT AVG(rating) 
                 FROM rides 
                 WHERE driver_id = $1 AND rating IS NOT NULL
             )
             WHERE id = $1`,
            [driverId]
        );
        return result.rows[0];
    } catch (error) {
        logger.error('Update driver rating error:', error);
    }
};

const formatRideResponse = (ride) => ({
    id: ride.id,
    rideNumber: ride.ride_number,
    vehicleType: ride.vehicle_type,
    pickupAddress: ride.pickup_address,
    pickupLocation: {
        latitude: ride.pickup_latitude,
        longitude: ride.pickup_longitude
    },
    dropoffAddress: ride.dropoff_address,
    dropoffLocation: {
        latitude: ride.dropoff_latitude,
        longitude: ride.dropoff_longitude
    },
    distanceKm: ride.distance_km,
    durationMinutes: ride.duration_minutes,
    estimatedFare: ride.estimated_fare,
    actualFare: ride.actual_fare,
    status: ride.status,
    paymentStatus: ride.payment_status,
    paymentMethod: ride.payment_method,
    requestedAt: ride.requested_at,
    driverAssignedAt: ride.driver_assigned_at,
    startedAt: ride.started_at,
    completedAt: ride.completed_at,
    cancelledAt: ride.cancelled_at,
    cancelledBy: ride.cancelled_by,
    cancellationReason: ride.cancellation_reason,
    passenger: ride.passenger_name ? {
        name: ride.passenger_name,
        phone: ride.passenger_phone
    } : null,
    driver: ride.driver_name ? {
        name: ride.driver_name,
        phone: ride.driver_phone,
        vehicleType: ride.vehicle_type,
        vehicleNumber: ride.vehicle_number,
        vehicleModel: ride.vehicle_model,
        vehicleColor: ride.vehicle_color
    } : null,
    driverLocation: ride.driver_current_latitude ? {
        latitude: ride.driver_current_latitude,
        longitude: ride.driver_current_longitude
    } : null,
    rating: ride.rating,
    review: ride.review
});

const formatRideListResponse = (ride) => ({
    id: ride.id,
    rideNumber: ride.ride_number,
    vehicleType: ride.vehicle_type,
    pickupAddress: ride.pickup_address,
    dropoffAddress: ride.dropoff_address,
    distanceKm: ride.distance_km,
    estimatedFare: ride.estimated_fare,
    actualFare: ride.actual_fare,
    status: ride.status,
    paymentStatus: ride.payment_status,
    requestedAt: ride.requested_at,
    completedAt: ride.completed_at,
    passengerName: ride.passenger_name,
    driverName: ride.driver_name
});