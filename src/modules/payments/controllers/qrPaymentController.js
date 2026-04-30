import logger from '../../../core/logger/logger.js';
import { ApiError } from '../../../core/errors/ApiError.js';
import { createOrder, verifyAndConfirmPayment, getOrderDetail } from '../services/paymentService.js';
import { validateQRPayment, closeRideQR } from '../../../core/services/qrService.js';

/**
 * Generate QR code for payment
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const generatePaymentQR = async (req, res) => {
    try {
        const userId = req.user.id;
        const { amount, purpose, ride_id, description } = req.body;

        // Validate required fields
        if (!amount || !purpose) {
            throw new ApiError(400, 'Amount and purpose are required');
        }

        if (amount <= 0) {
            throw new ApiError(400, 'Amount must be greater than 0');
        }

        // Create payment order with QR method
        const result = await createOrder(userId, {
            amount,
            purpose,
            payment_method: 'qr',
            payment_gateway: 'razorpay',
            ride_id,
            description: description || `QR payment for ${purpose}`,
            metadata: { qr_payment: true }
        });

        logger.info(`[QR Payment] QR generated | User: ${userId} | Order: ${result.data.order.orderNumber}`);

        res.status(201).json({
            success: true,
            message: 'QR code generated successfully',
            data: result.data
        });

    } catch (error) {
        logger.error('[QR Payment] Generate QR error:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to generate QR code',
            data: {}
        });
    }
};

/**
 * Verify QR code payment
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const verifyQRPayment = async (req, res) => {
    try {
        const userId = req.user.id;
        const { order_number, gateway_payment_id, gateway_signature } = req.body;

        // Validate required fields
        if (!order_number || !gateway_payment_id || !gateway_signature) {
            throw new ApiError(400, 'Order number, payment ID, and signature are required');
        }

        // Validate QR payment
        const qrValidation = await validateQRPayment({
            orderNumber: order_number,
            gatewayPaymentId: gateway_payment_id,
            gatewaySignature: gateway_signature
        });

        if (!qrValidation.success) {
            throw new ApiError(400, 'QR payment validation failed');
        }

        // Verify and confirm payment with Razorpay
        const result = await verifyAndConfirmPayment({
            gateway_order_id: order_number, // This should be the gateway order ID
            gateway_payment_id,
            gateway_signature
        });

        logger.info(`[QR Payment] QR verified | User: ${userId} | Order: ${order_number}`);

        res.status(200).json({
            success: true,
            message: 'QR payment verified successfully',
            data: result.data
        });

    } catch (error) {
        logger.error('[QR Payment] Verify QR error:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to verify QR payment',
            data: {}
        });
    }
};

/**
 * Get QR payment status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getQRPaymentStatus = async (req, res) => {
    try {
        const userId = req.user.id;
        const { order_number } = req.params;

        if (!order_number) {
            throw new ApiError(400, 'Order number is required');
        }

        // Get order details
        const orderResponse = await getOrderDetail(userId, order_number);
        const order = orderResponse.data.order;

        // Check if this was a QR payment
        if (order.paymentMethod !== 'qr') {
            throw new ApiError(400, 'This is not a QR payment order');
        }

        res.status(200).json({
            success: true,
            message: 'QR payment status retrieved',
            data: {
                order,
                qrStatus: order.status === 'success' ? 'completed' : 'pending',
                expiresAt: order.expiresAt
            }
        });

    } catch (error) {
        logger.error('[QR Payment] Get status error:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to get QR payment status',
            data: {}
        });
    }
};

/**
 * Close QR payment (cancel/expire)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const closeQRPayment = async (req, res) => {
    try {
        const userId = req.user.id;
        const { order_number } = req.body;

        if (!order_number) {
            throw new ApiError(400, 'Order number is required');
        }

        // Get order details to find ride_id
        const orderResponse = await getOrderDetail(userId, order_number);
        const order = orderResponse.data.order;

        if (order.rideId) {
            // Close QR for ride payment
            await closeRideQR(order.rideId);
        }

        logger.info(`[QR Payment] QR closed | User: ${userId} | Order: ${order_number}`);

        res.status(200).json({
            success: true,
            message: 'QR payment closed successfully',
            data: {}
        });

    } catch (error) {
        logger.error('[QR Payment] Close QR error:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to close QR payment',
            data: {}
        });
    }
};
