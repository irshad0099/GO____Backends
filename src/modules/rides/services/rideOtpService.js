import * as otpRepo from '../repositories/rideOtp.repository.js';
import logger from '../../../core/logger/logger.js';

const OTP_EXPIRY_MINUTES = 10;

// Generate 4-digit OTP
const generateOTP = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
};

// Driver arrive hone pe OTP generate hota hai
export const generateRideOTP = async (rideId) => {
    try {
        const otpCode = generateOTP();
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);

        const otp = await otpRepo.insert(rideId, otpCode, expiresAt);

        return {
            rideId,
            otpCode: otp.otp_code,
            expiresAt: otp.expires_at,
            message: 'Share this OTP with your driver to start the ride'
        };
    } catch (error) {
        logger.error('Generate ride OTP service error:', error);
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
