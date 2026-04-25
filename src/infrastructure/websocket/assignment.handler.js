/**
 * Real-Time Driver Assignment Handler
 *
 * Handles:
 * - Driver assignment to ride
 * - Real-time map pings to passenger
 * - Location tracking initiation
 * - Assignment notifications
 */

import { getIO } from '../../config/websocketConfig.js';
import { emitToPassenger, emitToDriver, setupRideRoom } from './socket.events.js';
import { storeActiveRideSession } from './reconnection.handler.js';
import logger from '../../core/logger/logger.js';

/**
 * Assign driver to ride and start real-time tracking
 * Called when driver accepts ride
 */
export const assignDriverToRide = async (rideId, driverId, driverData) => {
    try {
        const io = getIO();

        const assignmentData = {
            rideId,
            driverId,
            driverName: driverData.name,
            driverPhone: driverData.phone,
            driverRating: driverData.rating,
            vehicleNumber: driverData.vehicleNumber,
            vehicleType: driverData.vehicleType,
            vehicleColor: driverData.vehicleColor,
            vehicleImage: driverData.vehicleImage,
            assignedAt: new Date().toISOString(),
            estimatedArrivalTime: driverData.estimatedArrivalTime
        };

        logger.info('✅ Driver assigned to ride', {
            rideId,
            driverId,
            driverName: driverData.name
        });

        return assignmentData;
    } catch (error) {
        logger.error('❌ Driver assignment failed', { rideId, driverId, error: error.message });
        throw error;
    }
};

/**
 * Location ping server-side mein nahi hota.
 *
 * Sahi flow:
 * 1. Driver (client) har 5 sec mein emit karta hai: socket.emit('driver:location_update', { latitude, longitude, rideId })
 * 2. socket.server.js us event ko receive karta hai
 * 3. Server sirf us ride room mein broadcast karta hai: io.to(`ride:${rideId}`).emit('driver:map_ping', ...)
 * 4. Passenger ko directly mil jaata hai
 *
 * Server pe koi interval nahi chahiye.
 */

/**
 * Stop location tracking for a ride (cleanup only)
 */
export const stopLocationPing = (rideId) => {
    logger.info('⭕ Location tracking stopped for ride', { rideId });
};

/**
 * Send estimated arrival time update to passenger
 */
export const updateEstimatedArrival = (rideId, passengerId, estimatedMinutes) => {
    try {
        emitToPassenger(passengerId, 'ride:eta_update', {
            rideId,
            estimatedMinutes,
            message: `Driver will arrive in ${estimatedMinutes} minutes`,
            timestamp: new Date().toISOString()
        });

        logger.debug('⏱️ ETA updated', { rideId, estimatedMinutes });
    } catch (error) {
        logger.error('❌ Failed to update ETA', { rideId, error: error.message });
    }
};

/**
 * Notify passenger of driver arrival
 */
export const notifyDriverArrival = (rideId, passengerId, driverId, location) => {
    try {
        emitToPassenger(passengerId, 'ride:driver_arrived', {
            rideId,
            driverId,
            location,
            message: 'Your driver has arrived!',
            timestamp: new Date().toISOString()
        });

        logger.info('🔔 Driver arrival notification sent', { rideId, passengerId });
    } catch (error) {
        logger.error('❌ Failed to notify driver arrival', { rideId, error: error.message });
    }
};

/**
 * Send assignment details to passenger (with driver info and ETA)
 */
export const sendAssignmentToPassenger = (passengerId, assignmentData) => {
    try {
        emitToPassenger(passengerId, 'ride:driver_assigned', {
            ...assignmentData,
            message: `${assignmentData.driverName} is on the way!`,
            mapUrl: `/track/${assignmentData.rideId}`
        });

        logger.info('📤 Assignment details sent to passenger', { passengerId });
    } catch (error) {
        logger.error('❌ Failed to send assignment', { passengerId, error: error.message });
    }
};

/**
 * Send assignment confirmation to driver
 */
export const sendAssignmentToDriver = (driverId, rideData) => {
    try {
        emitToDriver(driverId, 'ride:assignment_confirmed', {
            rideId: rideData.id,
            passengerName: rideData.passengerName,
            passengerPhone: rideData.passengerPhone,
            pickupLocation: rideData.pickupLocation,
            dropoffLocation: rideData.dropoffLocation,
            estimatedFare: rideData.estimatedFare,
            estimatedDistance: rideData.estimatedDistance,
            estimatedDuration: rideData.estimatedDuration,
            message: 'Ride assigned. Start heading to pickup location.',
            timestamp: new Date().toISOString()
        });

        logger.info('📤 Assignment confirmation sent to driver', { driverId });
    } catch (error) {
        logger.error('❌ Failed to send assignment to driver', { driverId, error: error.message });
    }
};

/**
 * Handle OTP verification for ride start
 */
export const verifyRideOTP = (rideId, passengerId, driverId, otp) => {
    try {
        const io = getIO();

        io.to(`ride:${rideId}`).emit('ride:otp_verified', {
            rideId,
            verifiedAt: new Date().toISOString(),
            message: 'OTP verified. Ride started!'
        });

        logger.info('✅ Ride OTP verified', { rideId });
    } catch (error) {
        logger.error('❌ OTP verification failed', { rideId, error: error.message });
        throw error;
    }
};

export default {
    assignDriverToRide,
    stopLocationPing,
    updateEstimatedArrival,
    notifyDriverArrival,
    sendAssignmentToPassenger,
    sendAssignmentToDriver,
    verifyRideOTP
};
