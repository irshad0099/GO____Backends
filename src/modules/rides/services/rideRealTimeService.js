/**
 * Ride Real-Time Service
 *
 * Production-ready service for:
 * - Driver assignment with real-time tracking
 * - Location pings
 * - Payment processing
 * - Complete ride lifecycle
 */

import {
    assignDriverToRide,
    startLocationPing,
    stopLocationPing,
    updateEstimatedArrival,
    notifyDriverArrival,
    sendAssignmentToPassenger,
    sendAssignmentToDriver
} from '../../../infrastructure/websocket/assignment.handler.js';

import {
    initiatePayment,
    sendFareBreakdown,
    processPayment,
    sendPaymentStatus,
    handlePaymentSuccess,
    handlePaymentFailure,
    sendInvoice,
    processWalletPayment,
    processCardPayment
} from '../../../infrastructure/websocket/payment.handler.js';

import logger from '../../../core/logger/logger.js';

export class RideRealTimeService {
    constructor(rideRepository, driverRepository, passengerRepository, paymentService) {
        this.rideRepository = rideRepository;
        this.driverRepository = driverRepository;
        this.passengerRepository = passengerRepository;
        this.paymentService = paymentService;
    }

    /**
     * STEP 1: Assign driver to ride and start tracking
     */
    async assignDriver(rideId, driverId) {
        try {
            const ride = await this.rideRepository.findById(rideId);
            const driver = await this.driverRepository.findById(driverId);
            const passenger = await this.passengerRepository.findById(ride.passengerId);

            if (!ride || !driver) {
                throw new Error('Ride or Driver not found');
            }

            // Update ride with driver
            await this.rideRepository.update(rideId, {
                driverId,
                status: 'assigned',
                assignedAt: new Date()
            });

            // Prepare assignment data
            const assignmentData = await assignDriverToRide(rideId, driverId, {
                name: driver.name,
                phone: driver.phone,
                rating: driver.rating,
                vehicleNumber: driver.vehicleNumber,
                vehicleType: driver.vehicleType,
                vehicleColor: driver.vehicleColor,
                vehicleImage: driver.vehicleImage,
                estimatedArrivalTime: this.calculateETA(driver.location, ride.pickupLocation)
            });

            // Send assignment to passenger (with map tracking URL)
            sendAssignmentToPassenger(ride.passengerId, assignmentData);

            // Send assignment to driver
            sendAssignmentToDriver(driverId, {
                id: rideId,
                passengerName: passenger.name,
                passengerPhone: passenger.phone,
                pickupLocation: ride.pickupLocation,
                dropoffLocation: ride.dropoffLocation,
                estimatedFare: ride.estimatedFare,
                estimatedDistance: ride.estimatedDistance,
                estimatedDuration: ride.estimatedDuration
            });

            logger.info('✅ Driver assigned and notifications sent', {
                rideId,
                driverId
            });

            return assignmentData;
        } catch (error) {
            logger.error('❌ Driver assignment failed', {
                rideId,
                driverId,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * STEP 2: Start real-time location tracking
     * Driver location should be emitted from client every 5 seconds
     */
    async startRideTracking(socket, rideId, passengerId, driverId) {
        try {
            const ride = await this.rideRepository.findById(rideId);

            if (ride.status !== 'assigned') {
                throw new Error('Ride must be assigned before tracking');
            }

            // Start location ping
            startLocationPing(socket, rideId, passengerId, driverId);

            logger.info('🟢 Real-time tracking started', { rideId, driverId });

            return true;
        } catch (error) {
            logger.error('❌ Failed to start tracking', { rideId, error: error.message });
            throw error;
        }
    }

    /**
     * STEP 3: Start ride (after driver arrives and picks up passenger)
     */
    async startRide(rideId, driverId, otp) {
        try {
            const ride = await this.rideRepository.findById(rideId);

            if (ride.status !== 'assigned') {
                throw new Error('Ride must be assigned first');
            }

            // Update ride status
            await this.rideRepository.update(rideId, {
                status: 'started',
                startedAt: new Date(),
                startOTP: otp
            });

            logger.info('🟢 Ride started', { rideId, driverId });

            return { success: true, rideId };
        } catch (error) {
            logger.error('❌ Failed to start ride', { rideId, error: error.message });
            throw error;
        }
    }

    /**
     * STEP 4: Complete ride and initiate payment
     */
    async completeRideAndPay(rideId, finalData) {
        try {
            const ride = await this.rideRepository.findById(rideId);
            const driver = await this.driverRepository.findById(ride.driverId);

            if (ride.status !== 'started') {
                throw new Error('Ride must be started before completion');
            }

            // Calculate final fare
            const fareData = this.calculateFare(ride, finalData);

            // Update ride status
            await this.rideRepository.update(rideId, {
                status: 'completed',
                completedAt: new Date(),
                totalDistance: finalData.totalDistance,
                actualDuration: finalData.actualDuration,
                finalFare: fareData.finalAmount
            });

            logger.info('✅ Ride completed', {
                rideId,
                fare: fareData.finalAmount
            });

            // Stop location tracking
            stopLocationPing(rideId);

            // Send fare breakdown to passenger
            sendFareBreakdown(ride.passengerId, rideId, fareData);

            // Initiate payment
            const paymentData = await initiatePayment(
                rideId,
                ride.passengerId,
                ride.driverId,
                fareData
            );

            return { ride, fareData, paymentData };
        } catch (error) {
            logger.error('❌ Ride completion failed', {
                rideId,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * STEP 5: Process payment (Wallet or Card)
     */
    async processPaymentForRide(rideId, passengerId, driverId, paymentMethod = 'wallet') {
        try {
            const ride = await this.rideRepository.findById(rideId);

            if (ride.status !== 'completed') {
                throw new Error('Ride must be completed before payment');
            }

            // Send payment status (processing)
            sendPaymentStatus(rideId, passengerId, driverId, {
                transactionId: `TXN_${rideId}_${Date.now()}`,
                status: 'processing',
                amount: ride.finalFare
            });

            let transaction;

            if (paymentMethod === 'wallet') {
                // Process wallet payment
                transaction = await processWalletPayment(
                    passengerId,
                    ride.finalFare,
                    rideId
                );
            } else if (paymentMethod === 'card') {
                // Process card payment via gateway
                transaction = await processCardPayment({
                    rideId,
                    finalAmount: ride.finalFare,
                    paymentMethod
                }, 'razorpay');
            }

            logger.info('⏳ Payment processing initiated', {
                rideId,
                method: paymentMethod,
                amount: ride.finalFare
            });

            return transaction;
        } catch (error) {
            logger.error('❌ Payment processing failed', {
                rideId,
                error: error.message
            });

            // Handle payment failure
            handlePaymentFailure(rideId, passengerId, driverId, error);
            throw error;
        }
    }

    /**
     * STEP 6: Handle successful payment and send invoice
     */
    async completePayment(rideId, transactionId) {
        try {
            const ride = await this.rideRepository.findById(rideId);
            const driver = await this.driverRepository.findById(ride.driverId);

            // Update ride payment status
            await this.rideRepository.update(rideId, {
                paymentStatus: 'completed',
                transactionId,
                paidAt: new Date()
            });

            // Calculate driver earnings
            const driverEarnings = this.calculateDriverEarnings(ride);

            // Update driver wallet
            await this.driverRepository.updateEarnings(
                ride.driverId,
                driverEarnings
            );

            // Handle payment success
            const successData = await handlePaymentSuccess(
                rideId,
                ride.passengerId,
                ride.driverId,
                {
                    transactionId,
                    amount: ride.finalFare,
                    paymentMethod: 'wallet',
                    driverEarnings
                }
            );

            // Send invoice to both parties
            sendInvoice(ride.passengerId, ride.driverId, {
                rideId,
                finalAmount: ride.finalFare,
                distance: ride.totalDistance,
                duration: ride.actualDuration,
                pickupLocation: ride.pickupLocation,
                dropoffLocation: ride.dropoffLocation,
                breakdown: {
                    baseFare: ride.baseFare,
                    distanceFare: ride.distanceFare,
                    durationFare: ride.durationFare,
                    platformFee: ride.platformFee,
                    taxes: ride.taxes
                },
                driverEarnings
            });

            logger.info('✅ Payment completed and invoice sent', {
                rideId,
                transactionId,
                driverEarnings
            });

            return successData;
        } catch (error) {
            logger.error('❌ Payment completion failed', {
                rideId,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * UTILITY: Calculate fare
     */
    calculateFare(ride, finalData) {
        const baseFare = 50; // ₹50
        const perKmRate = 8; // ₹8 per km
        const perMinRate = 1; // ₹1 per minute
        const platformFee = 20; // ₹20
        const taxRate = 0.05; // 5% tax

        const distanceFare = finalData.totalDistance * perKmRate;
        const durationFare = (finalData.actualDuration / 60) * perMinRate; // Convert to minutes
        const subtotal = baseFare + distanceFare + durationFare;
        const taxes = subtotal * taxRate;
        const totalBeforeFee = subtotal + taxes;
        const finalAmount = totalBeforeFee + platformFee;

        return {
            baseFare,
            distanceFare,
            durationFare,
            subtotal,
            platformFee,
            taxes,
            totalFare: totalBeforeFee,
            finalAmount,
            discount: 0
        };
    }

    /**
     * UTILITY: Calculate driver earnings
     */
    calculateDriverEarnings(ride) {
        // Driver gets 80% of ride fare, platform gets 20%
        return ride.finalFare * 0.8;
    }

    /**
     * UTILITY: Calculate ETA
     */
    calculateETA(driverLocation, pickupLocation) {
        // Simplified: return random 3-15 minutes
        // In production, use actual distance calculation
        return Math.floor(Math.random() * 12) + 3;
    }
}

export default RideRealTimeService;
