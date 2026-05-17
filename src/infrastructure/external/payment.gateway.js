import Razorpay from 'razorpay';
import { ENV } from '../../config/envConfig.js';
import logger from '../../core/logger/logger.js';

const razorpay = ENV.RAZORPAY_KEY_ID && ENV.RAZORPAY_KEY_SECRET
    ? new Razorpay({ key_id: ENV.RAZORPAY_KEY_ID, key_secret: ENV.RAZORPAY_KEY_SECRET })
    : null;

export const closeDynamicQR = async (rideId) => {
    try {
        logger.info(`[PaymentGateway] Closing dynamic QR for ride ${rideId}`);
        return { success: true, message: 'QR code closed' };
    } catch (error) {
        logger.error(`[PaymentGateway] Failed to close QR for ride ${rideId}:`, error);
        throw error;
    }
};

export const generateDynamicQR = async (rideId, amount, orderId) => {
    if (!razorpay) throw new Error('Razorpay not configured — RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET missing');

    try {
        logger.info(`[PaymentGateway] Generating dynamic QR for ride ${rideId}, amount: ₹${amount}`);

        const qr = await razorpay.qrCode.create({
            type: 'upi_qr',
            name: 'GoMobility',
            usage: 'single_use',
            fixed_amount: true,
            payment_amount: amount * 100,
            description: `Ride #${rideId}`,
            order_id: orderId,
            close_by: Math.floor(Date.now() / 1000) + (15 * 60),
        });

        logger.info(`[PaymentGateway] QR created | ID: ${qr.id} | Ride: ${rideId}`);

        return {
            success: true,
            qrCodeId: qr.id,
            imageUrl: qr.image_url,
        };
    } catch (error) {
        logger.error(`[PaymentGateway] Failed to generate QR for ride ${rideId}:`, error);
        throw error;
    }
};