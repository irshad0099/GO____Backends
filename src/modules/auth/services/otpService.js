import * as otpRepo from '../repositories/otpRepository.js';
import { smsProvider } from '../../../infrastructure/external/sms.provider.js';
import { ENV } from '../../../config/envConfig.js';
import { ApiError } from '../../../core/errors/ApiError.js';
import logger from '../../../core/logger/logger.js';

const generateOTP = () => {
    // Generate a 6-digit OTP
    return Math.floor(100000 + Math.random() * 900000).toString();
};

export const sendOTP = async (phone, purpose = 'signin') => {
    try {
        // Generate OTP
        const otp = generateOTP();
        const expiry = new Date(Date.now() + ENV.OTP_EXPIRY_MINUTES * 60 * 1000);

        // Save OTP to database
        await otpRepo.saveOTP({
            phoneNumber: phone,
            otpCode: otp,
            purpose,
            expiresAt: expiry
        });

        // Send OTP via SMS
        await smsProvider.sendOTP(phone, otp);

        logger.info(`OTP sent successfully to ${phone} for purpose: ${purpose}`);

        return {
            message: 'OTP sent successfully',
            expiryInMinutes: ENV.OTP_EXPIRY_MINUTES
        };
    } catch (error) {
        logger.error('Send OTP service error:', error);
        throw new ApiError(500, 'Failed to send OTP');
    }
};

export const verifyOTP = async (phone, otp, purpose) => {
    try {
        // Get valid OTP from database
        const otpRecord = await otpRepo.getValidOTP(phone, purpose);

        if (!otpRecord) {
            throw new ApiError(400, 'OTP expired or not found. Please request a new OTP.');
        }

        // Check attempts
        if (otpRecord.attempts >= ENV.OTP_MAX_ATTEMPTS) {
            await otpRepo.deleteOTP(phone, purpose);
            throw new ApiError(400, 'Too many failed attempts. Please request a new OTP.');
        }

        // Increment attempts
        await otpRepo.incrementAttempts(otpRecord.id);

        // Verify OTP
        if (otpRecord.otp_code !== otp) {
            throw new ApiError(400, 'Invalid OTP');
        }

        // Check if already used
        if (otpRecord.is_used) {
            throw new ApiError(400, 'OTP already used');
        }

        // Mark OTP as used
        await otpRepo.markOTPAsUsed(otpRecord.id);

        logger.info(`OTP verified successfully for ${phone}`);

        return true;
    } catch (error) {
        logger.error('Verify OTP service error:', error);
        throw error;
    }
};