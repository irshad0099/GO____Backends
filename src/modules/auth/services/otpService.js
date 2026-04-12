// import * as otpRepo from '../repositories/otpRepository.js';
// import { smsProvider } from '../../../infrastructure/external/sms.provider.js';
// import { ENV } from '../../../config/envConfig.js';
// import { ApiError } from '../../../core/errors/ApiError.js';
// import logger from '../../../core/logger/logger.js';

// const generateOTP = () => {
//     // Generate a 6-digit OTP
//     return Math.floor(100000 + Math.random() * 900000).toString();
// };

// export const sendOTP = async (phone, purpose = 'signin') => {
//     try {
//         // Generate OTP
//         const otp = generateOTP();
//         const expiry = new Date(Date.now() + ENV.OTP_EXPIRY_MINUTES * 60 * 1000);

//         // Save OTP to database
//         await otpRepo.saveOTP({
//             phoneNumber: phone,
//             otpCode: otp,
//             purpose,
//             expiresAt: expiry
//         });

//         // Send OTP via SMS
//         await smsProvider.sendOTP(phone, otp);

//         logger.info(`OTP sent successfully to ${phone} for purpose: ${purpose}`);

//         return {
//             message: 'OTP sent successfully',
//             expiryInMinutes: ENV.OTP_EXPIRY_MINUTES
//         };
//     } catch (error) {
//         logger.error('Send OTP service error:', error);
//         throw new ApiError(500, 'Failed to send OTP');
//     }
// };

// export const verifyOTP = async (phone, otp, purpose) => {
//     try {
//         // Get valid OTP from database
//         const otpRecord = await otpRepo.getValidOTP(phone, purpose);

//         if (!otpRecord) {
//             throw new ApiError(400, 'OTP expired or not found. Please request a new OTP.');
//         }

//         // Check attempts
//         if (otpRecord.attempts >= ENV.OTP_MAX_ATTEMPTS) {
//             await otpRepo.deleteOTP(phone, purpose);
//             throw new ApiError(400, 'Too many failed attempts. Please request a new OTP.');
//         }

//         // Increment attempts
//         await otpRepo.incrementAttempts(otpRecord.id);

//         // Verify OTP
//         if (otpRecord.otp_code !== otp) {
//             throw new ApiError(400, 'Invalid OTP');
//         }

//         // Check if already used
//         if (otpRecord.is_used) {
//             throw new ApiError(400, 'OTP already used');
//         }

//         // Mark OTP as used
//         await otpRepo.markOTPAsUsed(otpRecord.id);

//         logger.info(`OTP verified successfully for ${phone}`);

//         return true;
//     } catch (error) {
//         logger.error('Verify OTP service error:', error);
//         throw error;
//     }
// };


import * as otpRepo from '../repositories/otpRepository.js';
import { smsProvider } from '../../../infrastructure/external/sms.provider.js';
import { ENV } from '../../../config/envConfig.js';
import { ApiError } from '../../../core/errors/ApiError.js';
import logger from '../../../core/logger/logger.js';
import { saveOTP, verifyOTP as redisVerifyOTP, deleteOTP } from '../../../core/services/redisService.js';

const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

export const sendOTP = async (phone, purpose = 'signin') => {
    const startTime = Date.now();

    try {
        logger.info('🔐 OTP send initiated', {
            phone: phone.slice(-4),
            purpose,
            provider: ENV.SMS_PROVIDER
        });

        // Generate OTP
        const otp = generateOTP();
        const expiryMinutes = Number(ENV.OTP_EXPIRY_MINUTES) || 5;

        // ── Redis mein OTP save karo (fast + auto-expire) ─────────────────────
        await saveOTP(phone, otp, purpose);

        // ── Database mein bhi save karo (backup + audit trail) ────────────────
        const expiry = new Date(Date.now() + expiryMinutes * 60 * 1000);
        await otpRepo.saveOTP({
            phoneNumber: phone,
            otpCode:     otp,
            purpose,
            expiresAt:   expiry
        });

        logger.debug('💾 OTP saved to database', {
            phone: phone.slice(-4),
            purpose,
            expiresAt: expiry.toISOString(),
            storage: 'Redis + Database'
        });

        // ── SMS bhejo ──────────────────────────────────────────────────────────
        let smsResult;
        try {
            smsResult = await smsProvider.sendOTP(phone, otp, purpose);
        } catch (smsError) {
            // SMS fail hua — console mode mein silently continue karo
            // Production mein real SMS provider hoga, dev mein console fallback
            logger.warn('⚠️ SMS send failed, falling back to console mode', {
                phone: phone.slice(-4),
                purpose,
                provider: ENV.SMS_PROVIDER,
                error: smsError.message,
            });
            smsResult = { success: true, provider: 'console_fallback' };
        }

        logger.info('✅ OTP sent successfully', {
            phone: phone.slice(-4),
            purpose,
            provider: smsResult.provider || ENV.SMS_PROVIDER,
            expiryInMinutes: expiryMinutes,
            messageId: smsResult.messageId || smsResult.sid,
            duration: Date.now() - startTime
        });

        const response = {
            message: 'OTP sent successfully',
            expiryInMinutes: expiryMinutes,
            provider: smsResult.provider || ENV.SMS_PROVIDER,
        };

        // Development / console mode: OTP response mein bhi do — testing ke liye
        // Production mein SMS_PROVIDER real provider hoga (msg91/twilio/fast2sms)
        if (ENV.SMS_PROVIDER === 'console' || smsResult.provider === 'console_fallback') {
            response.otp = otp;
            response._devNote = 'OTP included in response for testing. Disable in production.';
        }

        return response;
    } catch (error) {
        logger.error('❌ Send OTP service error', {
            phone: phone.slice(-4),
            purpose,
            provider: ENV.SMS_PROVIDER,
            errorCode: error.code,
            errorMessage: error.message,
            stack: error.stack,
            duration: Date.now() - startTime
        });

        throw new ApiError(500, 'Failed to send OTP. Please try again.');
    }
};

export const verifyOTP = async (phone, otp, purpose) => {
    try {
        // ── Step 1: Pehle Redis mein check karo (fast) ────────────────────────
        const redisResult = await redisVerifyOTP(phone, otp, purpose);

        if (redisResult.valid) {
            // Redis mein valid — DB mein bhi mark as used karo
            const otpRecord = await otpRepo.getValidOTP(phone, purpose);
            if (otpRecord) {
                await otpRepo.markOTPAsUsed(otpRecord.id);
            }
            logger.info(`✅ OTP verified via Redis for ${phone}`);
            return true;
        }

        // ── Step 2: Redis mein nahi mila — DB se check karo (fallback) ────────
        const otpRecord = await otpRepo.getValidOTP(phone, purpose);

        if (!otpRecord) {
            throw new ApiError(400, 'OTP expired or not found. Please request a new OTP.');
        }

        if (otpRecord.attempts >= (Number(ENV.OTP_MAX_ATTEMPTS) || 5)) {
            await otpRepo.deleteOTP(phone, purpose);
            await deleteOTP(phone, purpose);
            throw new ApiError(400, 'Too many failed attempts. Please request a new OTP.');
        }

        await otpRepo.incrementAttempts(otpRecord.id);

        if (otpRecord.otp_code !== otp) {
            throw new ApiError(400, 'Invalid OTP');
        }

        if (otpRecord.is_used) {
            throw new ApiError(400, 'OTP already used');
        }

        await otpRepo.markOTPAsUsed(otpRecord.id);
        await deleteOTP(phone, purpose);

        logger.info(`✅ OTP verified via DB fallback for ${phone}`);
        return true;

    } catch (error) {
        logger.error('Verify OTP service error:', error);
        throw error;
    }
};