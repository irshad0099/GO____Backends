import QRCode from 'qrcode';
import logger from '../logger/logger.js';
import { generateDynamicQR, closeDynamicQR } from '../../infrastructure/external/payment.gateway.js';

/**
 * Generate QR code for ride payment
 * @param {Object} options
 * @param {number} options.rideId - Ride ID
 * @param {number} options.amount - Amount in rupees
 * @param {string} options.orderId - Razorpay order ID
 * @param {string} options.orderNumber - Order number
 * @returns {Promise<Object>} QR code data
 */
export const generateRidePaymentQR = async (options) => {
    try {
        const { rideId, amount, orderId, orderNumber } = options;
        
        logger.info(`[QR Service] Generating QR for ride ${rideId}, amount: ₹${amount}`);
        
        // Step 1: Generate dynamic QR with Razorpay (if available)
        let razorpayQR = null;
        try {
            razorpayQR = await generateDynamicQR(rideId, amount, orderId);
        } catch (error) {
            logger.warn(`[QR Service] Razorpay QR generation failed, falling back to UPI QR: ${error.message}`);
        }
        
        // Step 2: Generate UPI QR code as fallback
        const upiData = {
            // Format: upi://pay?pa=merchant@upi&pn=Merchant&am=amount&cu=INR&tr=transaction_ref
            pa: 'gomobility@upi', // Replace with actual UPI ID
            pn: 'GoMobility',
            am: amount.toString(),
            cu: 'INR',
            tr: orderNumber,
            tn: `Payment for ride #${rideId}`
        };
        
        const upiUrl = `upi://pay?${new URLSearchParams(upiData).toString()}`;
        
        // Generate QR code image
        const qrCodeDataUrl = await QRCode.toDataURL(upiUrl, {
            width: 300,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });
        
        const qrResult = {
            success: true,
            rideId,
            amount,
            orderNumber,
            orderId,
            qrCode: qrCodeDataUrl,
            upiUrl,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
            razorpayQR: razorpayQR
        };
        
        logger.info(`[QR Service] QR generated successfully for ride ${rideId}`);
        return qrResult;
        
    } catch (error) {
        logger.error(`[QR Service] Failed to generate QR for ride ${options.rideId}:`, error);
        throw error;
    }
};

/**
 * Generate QR code for wallet recharge
 * @param {Object} options
 * @param {number} options.amount - Amount in rupees
 * @param {string} options.orderId - Razorpay order ID
 * @param {string} options.orderNumber - Order number
 * @param {string} options.userId - User ID
 * @returns {Promise<Object>} QR code data
 */
export const generateWalletRechargeQR = async (options) => {
    try {
        const { amount, orderId, orderNumber, userId } = options;
        
        logger.info(`[QR Service] Generating wallet recharge QR, amount: ₹${amount}`);
        
        // Generate UPI QR for wallet recharge
        const upiData = {
            pa: 'gomobility@upi', // Replace with actual UPI ID
            pn: 'GoMobility',
            am: amount.toString(),
            cu: 'INR',
            tr: orderNumber,
            tn: `Wallet recharge - ${orderNumber}`
        };
        
        const upiUrl = `upi://pay?${new URLSearchParams(upiData).toString()}`;
        
        // Generate QR code image
        const qrCodeDataUrl = await QRCode.toDataURL(upiUrl, {
            width: 300,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });
        
        const qrResult = {
            success: true,
            amount,
            orderNumber,
            orderId,
            userId,
            qrCode: qrCodeDataUrl,
            upiUrl,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
            type: 'wallet_recharge'
        };
        
        logger.info(`[QR Service] Wallet recharge QR generated successfully`);
        return qrResult;
        
    } catch (error) {
        logger.error(`[QR Service] Failed to generate wallet recharge QR:`, error);
        throw error;
    }
};

/**
 * Close QR code for a ride
 * @param {number} rideId - Ride ID
 * @returns {Promise<Object>}
 */
export const closeRideQR = async (rideId) => {
    try {
        logger.info(`[QR Service] Closing QR for ride ${rideId}`);
        
        // Close dynamic QR with Razorpay if available
        const result = await closeDynamicQR(rideId);
        
        logger.info(`[QR Service] QR closed successfully for ride ${rideId}`);
        return result;
        
    } catch (error) {
        logger.error(`[QR Service] Failed to close QR for ride ${rideId}:`, error);
        throw error;
    }
};

/**
 * Validate QR code payment
 * @param {Object} options
 * @param {string} options.orderNumber - Order number
 * @param {string} options.gatewayPaymentId - Payment ID from gateway
 * @param {string} options.gatewaySignature - Signature from gateway
 * @returns {Promise<Object>}
 */
export const validateQRPayment = async (options) => {
    try {
        const { orderNumber, gatewayPaymentId, gatewaySignature } = options;
        
        logger.info(`[QR Service] Validating QR payment for order ${orderNumber}`);
        
        // This would typically validate the payment with Razorpay
        // For now, return validation success (to be implemented with actual Razorpay validation)
        
        return {
            success: true,
            orderNumber,
            gatewayPaymentId,
            gatewaySignature,
            validatedAt: new Date()
        };
        
    } catch (error) {
        logger.error(`[QR Service] Failed to validate QR payment for order ${options.orderNumber}:`, error);
        throw error;
    }
};
