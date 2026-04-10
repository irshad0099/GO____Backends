import * as otpRepo from '../repositories/rideOtp.repository.js';
import { smsProvider } from '../../../infrastructure/external/sms.provider.js';
import logger from '../../../core/logger/logger.js';

const OTP_EXPIRY_MINUTES = 10;

// Generate 4-digit OTP
const generateOTP = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
};

// Driver arrive hone pe OTP generate hota hai
export const generateRideOTP = async (rideId, passengerPhone = null) => {
    const startTime = Date.now();

    try {
        logger.info('🚗 Generating Ride OTP', { rideId });

        const otpCode = generateOTP();
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);

        const otp = await otpRepo.insert(rideId, otpCode, expiresAt);

        // Send OTP via SMS if passenger phone is provided
        if (passengerPhone) {
            try {
                logger.debug('📲 Sending Ride OTP to passenger', {
                    rideId,
                    phone: passengerPhone.slice(-4),
                    otpCode: otpCode.slice(0, 2) + '**' // Log masked OTP
                });

                await smsProvider.sendOTP(passengerPhone, otpCode, 'ride_start');

                logger.info('✅ Ride OTP sent successfully to passenger', {
                    rideId,
                    phone: passengerPhone.slice(-4),
                    duration: Date.now() - startTime
                });
            } catch (smsError) {
                logger.error('⚠️ Failed to send Ride OTP via SMS (OTP still saved in DB)', {
                    rideId,
                    phone: passengerPhone.slice(-4),
                    error: smsError.message,
                    duration: Date.now() - startTime
                });
                // Don't throw - OTP is already saved in DB, SMS is optional
            }
        }

        return {
            rideId,
            otpCode: otp.otp_code,
            expiresAt: otp.expires_at,
            smsSent: !!passengerPhone,
            message: passengerPhone
                ? 'OTP sent to your phone. Share with driver to start the ride'
                : 'Share this OTP with your driver to start the ride'
        };
    } catch (error) {
        logger.error('❌ Generate ride OTP service error', {
            rideId,
            error: error.message,
            stack: error.stack,
            duration: Date.now() - startTime
        });
        throw error;
    }
};

// Driver OTP enter karta hai — verify karo
export const verifyRideOTP = async (rideId, otpCode) => {
    try {
        const result = await otpRepo.verify(rideId, otpCode);

        if (!result.success) {
            const messages = {
                no_active_otp: 'No active OTP found. Request a new one.',
                max_attempts_exceeded: 'Too many wrong attempts. Request a new OTP.',
                invalid_otp: `Wrong OTP. ${result.attemptsLeft} attempt(s) left.`
            };
            return {
                verified: false,
                message: messages[result.reason] || 'OTP verification failed'
            };
        }

        return {
            verified: true,
            message: 'OTP verified! Ride can start now.'
        };
    } catch (error) {
        logger.error('Verify ride OTP service error:', error);
        throw error;
    }
};
