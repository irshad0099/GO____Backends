import logger from '../logger/logger.js';

// ─────────────────────────────────────────────────────────────────────────────
//  Payment Socket Service
//  Handles real-time socket events for payment flows
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Emit fare breakdown to passenger when ride completes
 * @param {Object} io — Socket.io instance
 * @param {number} passengerUserId — Passenger user ID
 * @param {Object} data — Fare breakdown data
 */
export const emitFareBreakdown = (io, passengerUserId, data) => {
    try {
        io.to(`user_${passengerUserId}`).emit('payment:fare_breakdown', {
            finalFare: data.finalFare,
            breakdown: data.breakdown,
            paymentMethod: data.paymentMethod,
            timestamp: new Date().toISOString(),
        });
        logger.info(`[Socket] Fare breakdown emitted to passenger ${passengerUserId}`);
    } catch (error) {
        logger.error('[Socket] emitFareBreakdown error:', error);
    }
};

/**
 * Emit payment status update to both passenger and driver
 * @param {Object} io — Socket.io instance
 * @param {Object} data — { passengerUserId, driverUserId, status, message, rideId }
 */
export const emitPaymentStatusUpdate = (io, data) => {
    try {
        const { passengerUserId, driverUserId, status, message, rideId } = data;
        const payload = {
            rideId,
            paymentStatus: status,
            message,
            timestamp: new Date().toISOString(),
        };

        // Emit to passenger
        if (passengerUserId) {
            io.to(`user_${passengerUserId}`).emit('payment:status_update', payload);
        }

        // Emit to driver
        if (driverUserId) {
            io.to(`driver_${driverUserId}`).emit('payment:status_update', payload);
        }

        logger.info(`[Socket] Payment status update emitted | Status: ${status} | Ride: ${rideId}`);
    } catch (error) {
        logger.error('[Socket] emitPaymentStatusUpdate error:', error);
    }
};

/**
 * Emit payment success to passenger
 * @param {Object} io — Socket.io instance
 * @param {number} passengerUserId — Passenger user ID
 * @param {Object} data — Receipt data
 */
export const emitPaymentSuccess = (io, passengerUserId, data) => {
    try {
        io.to(`user_${passengerUserId}`).emit('payment:success', {
            rideId: data.rideId,
            amountPaid: data.amountPaid,
            receiptUrl: data.receiptUrl,
            paymentMethod: data.paymentMethod,
            timestamp: new Date().toISOString(),
        });
        logger.info(`[Socket] Payment success emitted to passenger ${passengerUserId}`);
    } catch (error) {
        logger.error('[Socket] emitPaymentSuccess error:', error);
    }
};

/**
 * Emit payment received to driver
 * @param {Object} io — Socket.io instance
 * @param {number} driverUserId — Driver user ID
 * @param {Object} data — Earnings data
 */
export const emitPaymentReceived = (io, driverUserId, data) => {
    try {
        io.to(`driver_${driverUserId}`).emit('payment:received', {
            rideId: data.rideId,
            netEarnings: data.netEarnings,
            platformFee: data.platformFee,
            paymentMethod: data.paymentMethod,
            timestamp: new Date().toISOString(),
        });
        logger.info(`[Socket] Payment received emitted to driver ${driverUserId}`);
    } catch (error) {
        logger.error('[Socket] emitPaymentReceived error:', error);
    }
};

/**
 * Emit payment failure to passenger
 * @param {Object} io — Socket.io instance
 * @param {number} passengerUserId — Passenger user ID
 * @param {Object} data — Failure details
 */
export const emitPaymentFailed = (io, passengerUserId, data) => {
    try {
        io.to(`user_${passengerUserId}`).emit('payment:failed', {
            rideId: data.rideId,
            reason: data.reason,
            retryUrl: data.retryUrl,
            shortfallAmount: data.shortfallAmount, // For wallet insufficient balance
            timestamp: new Date().toISOString(),
        });
        logger.warn(`[Socket] Payment failed emitted to passenger ${passengerUserId} | Reason: ${data.reason}`);
    } catch (error) {
        logger.error('[Socket] emitPaymentFailed error:', error);
    }
};

/**
 * Emit payment reminder to passenger (after 5 min delay)
 * @param {Object} io — Socket.io instance
 * @param {number} passengerUserId — Passenger user ID
 * @param {Object} data — Reminder details
 */
export const emitPaymentReminder = (io, passengerUserId, data) => {
    try {
        io.to(`user_${passengerUserId}`).emit('payment:reminder', {
            rideId: data.rideId,
            amountDue: data.amountDue,
            retryUrl: data.retryUrl,
            timestamp: new Date().toISOString(),
        });
        logger.info(`[Socket] Payment reminder emitted to passenger ${passengerUserId}`);
    } catch (error) {
        logger.error('[Socket] emitPaymentReminder error:', error);
    }
};

/**
 * Emit cash collection confirmation to driver
 * @param {Object} io — Socket.io instance
 * @param {number} driverUserId — Driver user ID
 * @param {Object} data — Collection confirmation data
 */
export const emitCollectionConfirmed = (io, driverUserId, data) => {
    try {
        io.to(`driver_${driverUserId}`).emit('ride:collection_confirmed', {
            rideId: data.rideId,
            netEarnings: data.netEarnings,
            collectionMethod: data.collectionMethod,
            timestamp: new Date().toISOString(),
        });
        logger.info(`[Socket] Collection confirmed emitted to driver ${driverUserId}`);
    } catch (error) {
        logger.error('[Socket] emitCollectionConfirmed error:', error);
    }
};

/**
 * Emit payment settled to passenger (after cash collection)
 * @param {Object} io — Socket.io instance
 * @param {number} passengerUserId — Passenger user ID
 * @param {Object} data — Settlement data
 */
export const emitPaymentSettled = (io, passengerUserId, data) => {
    try {
        io.to(`user_${passengerUserId}`).emit('ride:payment_settled', {
            rideId: data.rideId,
            amount: data.amount,
            method: data.method,
            message: data.message || 'Payment settled',
            timestamp: new Date().toISOString(),
        });
        logger.info(`[Socket] Payment settled emitted to passenger ${passengerUserId}`);
    } catch (error) {
        logger.error('[Socket] emitPaymentSettled error:', error);
    }
};

/**
 * Schedule delayed payment reminder (5 minutes after ride completion)
 * @param {Object} io — Socket.io instance
 * @param {number} passengerUserId — Passenger user ID
 * @param {Object} data — Reminder details
 * @param {number} delayMs — Delay in milliseconds (default: 5 min)
 */
export const schedulePaymentReminder = (io, passengerUserId, data, delayMs = 5 * 60 * 1000) => {
    setTimeout(() => {
        emitPaymentReminder(io, passengerUserId, data);
    }, delayMs);
};
