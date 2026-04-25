/**
 * Real-Time Payment Handler
 *
 * Handles:
 * - Real-time payment processing
 * - Payment status updates
 * - Fare calculation and display
 * - Payment confirmation
 * - Transaction logging
 */

import { getIO } from '../../config/websocketConfig.js';
import { emitToPassenger, emitToDriver } from './socket.events.js';
import logger from '../../core/logger/logger.js';

/**
 * Initiate payment for ride
 * Called when ride is completed
 */
export const initiatePayment = async (rideId, passengerId, driverId, fareData) => {
    try {
        const paymentData = {
            rideId,
            passengerId,
            driverId,
            baseFare: fareData.baseFare,
            distanceFare: fareData.distanceFare,
            durationFare: fareData.durationFare,
            surgePricing: fareData.surgePricing || 0,
            tollCharges: fareData.tollCharges || 0,
            platformFee: fareData.platformFee,
            taxes: fareData.taxes,
            totalFare: fareData.totalFare,
            discount: fareData.discount || 0,
            finalAmount: fareData.finalAmount,
            paymentMethod: fareData.paymentMethod || 'wallet',
            initiatedAt: new Date().toISOString()
        };

        logger.info('💳 Payment initiated', { rideId, totalFare: paymentData.totalFare });

        return paymentData;
    } catch (error) {
        logger.error('❌ Payment initiation failed', { rideId, error: error.message });
        throw error;
    }
};

/**
 * Send fare breakdown to passenger before payment
 */
export const sendFareBreakdown = (passengerId, rideId, fareData) => {
    try {
        emitToPassenger(passengerId, 'payment:fare_breakdown', {
            rideId,
            breakdown: {
                baseFare: fareData.baseFare,
                distanceFare: fareData.distanceFare,
                durationFare: fareData.durationFare,
                surgePricing: fareData.surgePricing || 0,
                tollCharges: fareData.tollCharges || 0,
                platformFee: fareData.platformFee,
                taxes: fareData.taxes,
                subtotal: fareData.subtotal,
                discount: fareData.discount || 0,
                totalAmount: fareData.finalAmount
            },
            message: 'Review your fare before payment',
            timestamp: new Date().toISOString()
        });

        logger.debug('💵 Fare breakdown sent', { passengerId, rideId });
    } catch (error) {
        logger.error('❌ Failed to send fare breakdown', { passengerId, error: error.message });
    }
};

/**
 * Process real-time payment
 * Returns payment gateway response
 */
export const processPayment = async (paymentData, paymentGateway) => {
    try {
        const transactionId = `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const processedPayment = {
            transactionId,
            rideId: paymentData.rideId,
            amount: paymentData.finalAmount,
            currency: 'INR',
            paymentMethod: paymentData.paymentMethod,
            status: 'processing',
            processedAt: new Date().toISOString(),
            gateway: paymentGateway
        };

        logger.info('⏳ Payment processing started', {
            transactionId,
            rideId: paymentData.rideId,
            amount: paymentData.finalAmount
        });

        return processedPayment;
    } catch (error) {
        logger.error('❌ Payment processing failed', { error: error.message });
        throw error;
    }
};

/**
 * Send payment status to passenger and driver
 */
export const sendPaymentStatus = (rideId, passengerId, driverId, paymentStatus) => {
    try {
        const statusMessage = {
            rideId,
            transactionId: paymentStatus.transactionId,
            status: paymentStatus.status,
            amount: paymentStatus.amount,
            timestamp: new Date().toISOString()
        };

        // Send to passenger
        emitToPassenger(passengerId, 'payment:status_update', {
            ...statusMessage,
            message: getPaymentStatusMessage(paymentStatus.status)
        });

        // Send to driver
        emitToDriver(driverId, 'payment:status_update', {
            ...statusMessage,
            message: getPaymentStatusMessage(paymentStatus.status)
        });

        logger.info('💳 Payment status sent', {
            rideId,
            status: paymentStatus.status
        });
    } catch (error) {
        logger.error('❌ Failed to send payment status', { rideId, error: error.message });
    }
};

/**
 * Handle successful payment
 */
export const handlePaymentSuccess = async (rideId, passengerId, driverId, transactionData) => {
    try {
        const successData = {
            rideId,
            transactionId: transactionData.transactionId,
            amount: transactionData.amount,
            status: 'completed',
            completedAt: new Date().toISOString(),
            receipt: {
                receiptNumber: `REC_${Date.now()}`,
                fare: transactionData.amount,
                paymentMethod: transactionData.paymentMethod,
                timestamp: new Date().toISOString()
            }
        };

        // Notify passenger
        emitToPassenger(passengerId, 'payment:success', {
            ...successData,
            message: '✅ Payment successful!',
            receiptUrl: `/receipt/${successData.receipt.receiptNumber}`
        });

        // Notify driver
        emitToDriver(driverId, 'payment:received', {
            ...successData,
            message: '✅ Payment received!',
            earnings: transactionData.driverEarnings
        });

        logger.info('✅ Payment successful', {
            rideId,
            transactionId: transactionData.transactionId,
            amount: transactionData.amount
        });

        return successData;
    } catch (error) {
        logger.error('❌ Payment success handling failed', { rideId, error: error.message });
        throw error;
    }
};

/**
 * Handle payment failure
 */
export const handlePaymentFailure = (rideId, passengerId, driverId, error) => {
    try {
        const failureData = {
            rideId,
            status: 'failed',
            error: error.message,
            failedAt: new Date().toISOString(),
            retryable: error.retryable || true
        };

        // Notify passenger
        emitToPassenger(passengerId, 'payment:failed', {
            ...failureData,
            message: '❌ Payment failed. Please try again.',
            retryUrl: `/payment/retry/${rideId}`
        });

        // Notify driver (for logging)
        emitToDriver(driverId, 'payment:failed_notification', {
            rideId,
            message: 'Payment processing failed. Please contact support.'
        });

        logger.error('❌ Payment failed', {
            rideId,
            error: error.message
        });

        return failureData;
    } catch (err) {
        logger.error('❌ Payment failure handling error', { rideId, error: err.message });
    }
};

/**
 * Handle wallet payment (instant)
 */
export const processWalletPayment = async (passengerId, amount, rideId) => {
    try {
        const walletTransaction = {
            transactionId: `WALLET_${Date.now()}`,
            passengerId,
            rideId,
            amount,
            type: 'debit',
            status: 'completed',
            processedAt: new Date().toISOString(),
            description: `Payment for ride ${rideId}`
        };

        logger.info('💰 Wallet payment processed', {
            passengerId,
            amount,
            rideId
        });

        return walletTransaction;
    } catch (error) {
        logger.error('❌ Wallet payment failed', { passengerId, error: error.message });
        throw error;
    }
};

/**
 * Handle card payment (via payment gateway)
 */
export const processCardPayment = async (paymentData, gateway = 'razorpay') => {
    try {
        // This will be replaced with actual gateway API call
        const cardTransaction = {
            transactionId: `CARD_${Date.now()}`,
            rideId: paymentData.rideId,
            amount: paymentData.finalAmount,
            type: 'card',
            gateway,
            status: 'pending', // Will update after gateway response
            initiatedAt: new Date().toISOString()
        };

        logger.info('🏦 Card payment initiated', {
            rideId: paymentData.rideId,
            gateway,
            amount: paymentData.finalAmount
        });

        return cardTransaction;
    } catch (error) {
        logger.error('❌ Card payment initiation failed', { error: error.message });
        throw error;
    }
};

/**
 * Send payment reminder to passenger
 */
export const sendPaymentReminder = (passengerId, rideId, amount) => {
    try {
        emitToPassenger(passengerId, 'payment:reminder', {
            rideId,
            amount,
            message: `Please complete payment of ₹${amount} for your ride`,
            actionUrl: `/complete-payment/${rideId}`,
            timestamp: new Date().toISOString()
        });

        logger.debug('🔔 Payment reminder sent', { passengerId, rideId });
    } catch (error) {
        logger.error('❌ Failed to send payment reminder', { passengerId, error: error.message });
    }
};

/**
 * Get payment status message for UI
 */
function getPaymentStatusMessage(status) {
    const messages = {
        'processing': '⏳ Processing your payment...',
        'completed': '✅ Payment successful!',
        'failed': '❌ Payment failed. Please retry.',
        'pending': '⏳ Awaiting payment confirmation...',
        'refunded': '💵 Refund processed'
    };

    return messages[status] || 'Payment status updated';
}

/**
 * Send invoice to both parties
 */
export const sendInvoice = (passengerId, driverId, invoiceData) => {
    try {
        const invoice = {
            invoiceNumber: `INV_${Date.now()}`,
            rideId: invoiceData.rideId,
            fare: invoiceData.finalAmount,
            distance: invoiceData.distance,
            duration: invoiceData.duration,
            pickupLocation: invoiceData.pickupLocation,
            dropoffLocation: invoiceData.dropoffLocation,
            date: new Date().toISOString(),
            breakdown: invoiceData.breakdown
        };

        // Send to passenger
        emitToPassenger(passengerId, 'payment:invoice', {
            ...invoice,
            message: 'Your ride invoice',
            downloadUrl: `/invoice/download/${invoice.invoiceNumber}`
        });

        // Send to driver
        emitToDriver(driverId, 'payment:settlement', {
            ...invoice,
            driverEarnings: invoiceData.driverEarnings,
            platformFee: invoiceData.platformFee,
            message: 'Ride settlement'
        });

        logger.info('📄 Invoice sent', {
            invoiceNumber: invoice.invoiceNumber,
            rideId: invoiceData.rideId
        });

        return invoice;
    } catch (error) {
        logger.error('❌ Failed to send invoice', { error: error.message });
    }
};

export default {
    initiatePayment,
    sendFareBreakdown,
    processPayment,
    sendPaymentStatus,
    handlePaymentSuccess,
    handlePaymentFailure,
    processWalletPayment,
    processCardPayment,
    sendPaymentReminder,
    sendInvoice
};
