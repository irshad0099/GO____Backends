/**
 * EXAMPLE: WebSocket Integration in Ride Service
 *
 * This file shows how to integrate WebSocket events into your ride services.
 * Copy these patterns into your actual service files.
 */

import {
    emitRideStatusUpdate,
    emitRideRequest,
    emitDriverLocation,
    emitToDriver,
    emitToPassenger,
    broadcastEvent
} from '../../../infrastructure/websocket/index.js';
import logger from '../../../core/logger/logger.js';

export class RideServiceWithWebSocket {

    /**
     * Create a new ride and broadcast to available drivers
     */
    async createRide(rideData) {
        try {
            // Create ride in DB
            const ride = await this.rideRepository.create({
                passengerId: rideData.passengerId,
                pickupLocation: rideData.pickupLocation,
                dropoffLocation: rideData.dropoffLocation,
                estimatedFare: rideData.estimatedFare,
                status: 'pending'
            });

            logger.info('🚗 New ride created', { rideId: ride.id });

            // Broadcast to all drivers in real-time
            emitRideRequest(
                ride.id,
                ride.passengerId,
                ride.pickupLocation,
                ride.dropoffLocation,
                ride.estimatedFare
            );

            return ride;
        } catch (error) {
            logger.error('❌ Failed to create ride', { error: error.message });
            throw error;
        }
    }

    /**
     * Driver accepts a ride request
     */
    async acceptRide(rideId, driverId) {
        try {
            const ride = await this.rideRepository.findById(rideId);

            if (!ride) {
                throw new Error('Ride not found');
            }

            if (ride.status !== 'pending') {
                throw new Error(`Ride is already ${ride.status}`);
            }

            // Update ride status
            await this.rideRepository.update(rideId, {
                driverId,
                status: 'accepted',
                acceptedAt: new Date()
            });

            // Get driver and passenger details
            const driver = await this.driverRepository.findById(driverId);
            const passenger = await this.passengerRepository.findById(ride.passengerId);

            logger.info('✅ Ride accepted', { rideId, driverId });

            // Notify both parties in real-time
            emitRideStatusUpdate(rideId, driverId, ride.passengerId, 'accepted', {
                driverName: driver.name,
                driverPhone: driver.phone,
                vehicleNumber: driver.vehicleNumber,
                vehicleType: driver.vehicleType,
                rating: driver.rating,
                acceptedAt: new Date()
            });

            return { ride, driver };
        } catch (error) {
            logger.error('❌ Failed to accept ride', { rideId, driverId, error: error.message });
            throw error;
        }
    }

    /**
     * Start a ride
     */
    async startRide(rideId) {
        try {
            const ride = await this.rideRepository.findById(rideId);

            if (ride.status !== 'accepted') {
                throw new Error(`Ride must be accepted before starting. Current status: ${ride.status}`);
            }

            // Update ride status
            await this.rideRepository.update(rideId, {
                status: 'started',
                startedAt: new Date()
            });

            logger.info('🟢 Ride started', { rideId });

            // Notify both driver and passenger
            emitRideStatusUpdate(rideId, ride.driverId, ride.passengerId, 'started', {
                startedAt: new Date(),
                estimatedDuration: ride.estimatedDuration
            });

            return ride;
        } catch (error) {
            logger.error('❌ Failed to start ride', { rideId, error: error.message });
            throw error;
        }
    }

    /**
     * Complete a ride
     */
    async completeRide(rideId, finalData = {}) {
        try {
            const ride = await this.rideRepository.findById(rideId);

            if (ride.status !== 'started') {
                throw new Error(`Ride must be started before completing. Current status: ${ride.status}`);
            }

            // Calculate final fare if not provided
            const finalFare = finalData.finalFare || ride.estimatedFare;

            // Update ride status
            await this.rideRepository.update(rideId, {
                status: 'completed',
                completedAt: new Date(),
                finalFare,
                totalDistance: finalData.totalDistance,
                actualDuration: finalData.actualDuration
            });

            logger.info('✅ Ride completed', { rideId, finalFare });

            // Notify both parties
            emitRideStatusUpdate(rideId, ride.driverId, ride.passengerId, 'completed', {
                finalFare,
                totalDistance: finalData.totalDistance,
                actualDuration: finalData.actualDuration,
                completedAt: new Date()
            });

            // After completion, you can trigger payment/rating flows
            return ride;
        } catch (error) {
            logger.error('❌ Failed to complete ride', { rideId, error: error.message });
            throw error;
        }
    }

    /**
     * Cancel a ride
     */
    async cancelRide(rideId, cancelledBy, reason) {
        try {
            const ride = await this.rideRepository.findById(rideId);

            // Can cancel in pending, accepted, or started status
            const cancellableStatuses = ['pending', 'accepted', 'started'];
            if (!cancellableStatuses.includes(ride.status)) {
                throw new Error(`Cannot cancel ride in ${ride.status} status`);
            }

            // Update ride status
            await this.rideRepository.update(rideId, {
                status: 'cancelled',
                cancelledAt: new Date(),
                cancelledBy,
                cancellationReason: reason
            });

            logger.info('❌ Ride cancelled', { rideId, cancelledBy, reason });

            // Notify both parties
            emitRideStatusUpdate(rideId, ride.driverId, ride.passengerId, 'cancelled', {
                cancelledBy,
                reason,
                cancelledAt: new Date()
            });

            return ride;
        } catch (error) {
            logger.error('❌ Failed to cancel ride', { rideId, error: error.message });
            throw error;
        }
    }

    /**
     * Update driver location during ride
     */
    async updateDriverLocationDuringRide(rideId, driverId, location) {
        try {
            const ride = await this.rideRepository.findById(rideId);

            if (ride.status !== 'started' && ride.status !== 'accepted') {
                return; // Don't send location updates for non-active rides
            }

            // Update location in Redis (for geo-queries)
            await updateDriverLocation(driverId, location, true);

            // Send real-time location to passenger
            emitDriverLocation(rideId, driverId, ride.passengerId, location);

            logger.debug('📍 Driver location updated during ride', { rideId, driverId });

            return true;
        } catch (error) {
            logger.error('❌ Failed to update driver location', { rideId, error: error.message });
            // Don't throw - location updates are non-critical
            return false;
        }
    }

    /**
     * Send notification to passenger
     */
    async notifyPassenger(passengerId, title, message, data = {}) {
        try {
            emitToPassenger(passengerId, 'notification:new', {
                title,
                message,
                ...data,
                timestamp: new Date().toISOString()
            });

            logger.debug('📢 Notification sent to passenger', { passengerId, title });
        } catch (error) {
            logger.error('❌ Failed to notify passenger', { passengerId, error: error.message });
        }
    }

    /**
     * Send notification to driver
     */
    async notifyDriver(driverId, title, message, data = {}) {
        try {
            emitToDriver(driverId, 'notification:new', {
                title,
                message,
                ...data,
                timestamp: new Date().toISOString()
            });

            logger.debug('📢 Notification sent to driver', { driverId, title });
        } catch (error) {
            logger.error('❌ Failed to notify driver', { driverId, error: error.message });
        }
    }
}

/**
 * INTEGRATION PATTERN:
 *
 * In your actual ride controller or service:
 *
 * ```javascript
 * import { RideServiceWithWebSocket } from './websocketIntegration.example.js';
 *
 * class RideController {
 *   async startRide(req, res) {
 *     try {
 *       const rideService = new RideServiceWithWebSocket();
 *       const result = await rideService.startRide(req.body.rideId);
 *
 *       res.json({
 *         success: true,
 *         data: result
 *       });
 *     } catch (error) {
 *       res.status(400).json({
 *         success: false,
 *         message: error.message
 *       });
 *     }
 *   }
 * }
 * ```
 */

export default RideServiceWithWebSocket;
