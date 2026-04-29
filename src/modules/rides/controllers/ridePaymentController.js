import * as rideService from '../services/rideService.js';
import { updateRidePaymentStatus } from '../services/ridePaymentService.js';
import { createOrder } from '../../payments/services/paymentService.js';
import logger from '../../../core/logger/logger.js';
import { ApiError } from '../../../core/errors/ApiError.js';

export const createRidePayment = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { ride_id, payment_method, payment_gateway } = req.body;

        // First get ride details to calculate fare
        const ride = await rideService.getRideDetails(userId, ride_id, 'passenger');
        if (!ride) {
            throw new ApiError('Ride not found', 404);
        }

        // Check if ride is completed (only completed rides can be paid)
        if (ride.status !== 'completed') {
            throw new ApiError('Ride must be completed before payment', 400);
        }

        // Check if payment already exists for this ride
        // TODO: Add payment check in rideService

        // Handle cash payment differently
        if (payment_method === 'cash') {
            // For cash payments, mark as collected by driver
            const updatedRide = await rideService.updateRidePaymentStatus(ride_id, {
                payment_status: 'cash_collected',
                payment_method: 'cash',
                payment_collected_at: new Date()
            });

            res.status(200).json({
                success: true,
                message: 'Cash payment recorded. Please pay driver directly.',
                data: {
                    ride: updatedRide,
                    payment_method: 'cash',
                    amount: ride.finalFare || ride.estimatedFare,
                    status: 'cash_collected'
                }
            });
            return;
        }

        // For other payment methods (QR, UPI, Wallet), create payment order
        const paymentOrder = await createOrder(userId, {
            amount: ride.finalFare || ride.estimatedFare,
            purpose: 'ride_payment',
            payment_method,
            payment_gateway,
            ride_id,
            description: `Payment for ride ${ride.rideNumber}`,
        });

        res.status(201).json({
            success: true,
            message: 'Ride payment order created',
            data: paymentOrder.data,
        });
    } catch (error) {
        next(error);
    }
};

export const calculateRidePayment = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { 
            vehicleType, 
            pickupLatitude, 
            pickupLongitude, 
            dropoffLatitude, 
            dropoffLongitude,
            payment_method = 'card'
        } = req.body;

        // Calculate base fare
        const fare = await rideService.calculateFare({
            vehicleType,
            pickupLatitude: parseFloat(pickupLatitude),
            pickupLongitude: parseFloat(pickupLongitude),
            dropoffLatitude: parseFloat(dropoffLatitude),
            dropoffLongitude: parseFloat(dropoffLongitude)
        });

        // Apply subscription benefits if user has active subscription
        const { applyRideBenefits } = await import('../../subscription/services/subscriptionService.js');
        const benefits = await applyRideBenefits(userId, fare.estimatedFare);

        const finalAmount = benefits.finalAmount;
        const discountAmount = benefits.discountAmount;

        // Create payment order preview
        const paymentOrder = await createOrder(userId, {
            amount: finalAmount,
            purpose: 'ride_payment',
            payment_method,
            payment_gateway: 'razorpay',
            ride_id: null, // Will be set when ride is created
            description: 'Pre-ride fare calculation',
        });

        res.status(200).json({
            success: true,
            message: 'Ride fare calculated with payment options',
            data: {
                originalFare: fare,
                subscriptionBenefits: benefits,
                finalAmount,
                discountAmount,
                paymentOrder: paymentOrder.data,
                requiresPayment: finalAmount > 0,
            },
        });
    } catch (error) {
        next(error);
    }
};

export const getRidePaymentStatus = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { ride_id } = req.params;

        // Get ride details with payment info
        const ride = await rideService.getRideDetails(userId, ride_id, 'passenger');
        if (!ride) {
            throw new ApiError('Ride not found', 404);
        }

        // Get payment order for this ride
        const { getOrderDetail } = await import('../../payments/services/paymentService.js');
        let paymentStatus = null;

        if (ride.paymentOrderNumber) {
            try {
                const payment = await getOrderDetail(userId, ride.paymentOrderNumber);
                paymentStatus = payment.data;
            } catch (error) {
                // Payment order might not exist yet
                paymentStatus = null;
            }
        }

        res.status(200).json({
            success: true,
            data: {
                ride: {
                    id: ride.id,
                    rideNumber: ride.rideNumber,
                    status: ride.status,
                    finalFare: ride.finalFare,
                    estimatedFare: ride.estimatedFare,
                },
                payment: paymentStatus,
                paymentRequired: ride.status === 'completed' && (!paymentStatus || paymentStatus.order.status !== 'success'),
            },
        });
    } catch (error) {
        next(error);
    }
};
