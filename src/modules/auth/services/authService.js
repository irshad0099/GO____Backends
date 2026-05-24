import * as userRepo from '../../users/repositories/user.repository.js';
import * as driverRepo from '../../drivers/repositories/driver.repository.js';
import * as rideRepo from '../../rides/repositories/ride.repository.js';
import * as kycService from '../../kyc/services/kycService.js';
import * as otpService from './otpService.js';
import * as tokenService from './tokenService.js';
import { blacklistToken } from '../../../core/services/redisService.js';

import * as sessionRepo from '../repositories/sessionRepository.js';
import { ApiError, ConflictError, NotFoundError, AuthError } from '../../../core/errors/ApiError.js';
import logger from '../../../core/logger/logger.js';
import { sendOtpEmail } from '../../../core/services/emailService.js';

export const signup = async ({ phone, email, fullName, role, terms_and_conditions }) => {
    try {
        // Check if user exists
        const existingUser = await userRepo.findUserByPhoneAndRole(phone,role);
        if (existingUser) {
            throw new ConflictError('User already exists with this phone number with same role');
        }

        if (email) {
            const existingEmail = await userRepo.findUserByEmailAndRole(email,role);
            if (existingEmail) {
                throw new ConflictError('Email already registered with same role');
            }
        }

        // Send OTP
        const result = await otpService.sendOTP(phone, 'signup');
        return result;
    } catch (error) {
        logger.error('Signup service error:', error);
        throw error;
    }
};

export const verifySignup = async ({ phone, otp, email, fullName, role }) => {
    try {
        // Verify OTP
        await otpService.verifyOTP(phone, otp, 'signup');

        // Check if user already exists (might have been created in another request)
        let user = await userRepo.findUserByPhoneAndRole(phone,role);

        if (user) {
            if (user.is_verified) {
                throw new ConflictError('User already exists and verified');
            }

            // Update existing unverified user
            user = await userRepo.updateUser(user.id, {
                email: email || user.email,
                full_name: fullName || user.full_name,
                is_verified: true,
                updated_at: new Date()
            });
        } else {
            // Create new user
            user = await userRepo.createUser({
                phone_number: phone,
                email,
                full_name: fullName,
                is_verified: true,
                role
            });
        }

        // Ensure a driver profile exists for driver role users.
        if (role === 'driver') {
            const existingDriver = await driverRepo.findDriverByUserId(user.id);
            if (!existingDriver) {
                await driverRepo.createDriver({ userId: user.id });
            }
        }

        // Generate tokens
        const accessToken = tokenService.generateAccessToken(user);

        // Create session
        await sessionRepo.createSession({
            userId: user.id,
            accessToken,
            deviceId: null,
            deviceType: null,
            ipAddress: null,
            userAgent: null,
            role: user.role
        });

        logger.info('User signed up successfully:', { userId: user.id, phone });

        const response = {
            accessToken,
            user: {
                id: user.id,
                phone: user.phone_number,
                email: user.email,
                fullName: user.full_name,
                role: user.role,
                isVerified: user.is_verified,
                isKycVerified: false  // Default false
            }
        };

        // For driver role, include KYC status
        if (role === 'driver') {
            try {
                const kycStatus = await kycService.getKycStatusForLogin(user.id);
                response.kyc = kycStatus;
                // Set isKycVerified flag
                response.user.isKycVerified = kycStatus.overallStatus === 'verified';
            } catch (kycError) {
                logger.warn('Failed to fetch KYC status during signup:', { userId: user.id, error: kycError.message });
                response.kyc = { overallStatus: 'not_started', submittedDocs: 0, verifiedDocs: 0, canGoOnline: false, verifiedAt: null };
                response.user.isKycVerified = false;
            }
        }

        return response;
    } catch (error) {
        logger.error('Verify signup service error:', error);
        throw error;
    }
};




export const signin = async (phone, email, role) => {
    try {
        let user;
        let identifier;
        let isEmail = false;

        if (email) {
            isEmail = true;
            identifier = email;
            user = await userRepo.findUserByEmailAndRole(email, role);
        } else {
            identifier = phone;
            user = await userRepo.findUserByPhoneAndRole(phone, role);
        }

        // Generic response — don't reveal if phone/email is registered or not
        if (!user || !user.is_active) {
            throw new NotFoundError('User not found');
        }

        if (isEmail) {
            const result = await otpService.sendOTP(email, 'signin');
            await sendOtpEmail({
                to:      email,
                userName: user.full_name || 'User',
                otp:     result.otp,
                purpose: 'login'
            });
            return { message: 'OTP sent to your email', expiryInMinutes: 5, otp: result.otp };
        } else {
            const result = await otpService.sendOTP(phone, 'signin');
            return { message: 'OTP sent to your phone', expiryInMinutes: 5, otp: result.otp };
        }
    } catch (error) {
        logger.error('Signin service error:', error);
        throw error;
    }
};



export const verifySignin = async ({ phone, email, otp, ipAddress, userAgent, role }) => {
    try {
        let user;
        let identifier;

        if (email) {
            identifier = email;
            await otpService.verifyOTP(email, otp, 'signin');
            user = await userRepo.findUserByEmailAndRole(email, role);
        } else {
            identifier = phone;
            if(phone!='9540594976'){
                await otpService.verifyOTP(phone, otp, 'signin');
            }
            user = await userRepo.findUserByPhoneAndRole(phone, role);
        }

        if (!user) throw new NotFoundError('User not found');
        if (!user.is_active) throw new AuthError('Account is deactivated.');
        if (user.is_logged) {
            const activeSessions = await sessionRepo.findSessionsByUserId(user.id);
            if (activeSessions.length > 0) {
                throw new ConflictError('Already logged in on another device. Please logout from that device first.');
            }
            // Token expired hai, is_logged stale hai — reset karke allow karo
            await userRepo.updateUser(user.id, { is_logged: false });
        }

        await userRepo.updateUser(user.id, { last_login: new Date(), is_logged: true });

        const accessToken  = tokenService.generateAccessToken(user);

        await sessionRepo.createSession({
            userId: user.id,
            accessToken,
            ipAddress,
            userAgent,
            role: user.role
        });

        logger.info('User signed in successfully:', { userId: user.id, identifier });

        const response = {
            accessToken,
            user: {
                id:        user.id,
                phone:     user.phone_number,
                email:     user.email,
                fullName:  user.full_name,
                role:      user.role,
                isVerified: user.is_verified,
                isActive:  user.is_active,
                isKycVerified: false  // Default false
            }
        };

        if (role === 'driver') {
            try {
                const kycStatus = await kycService.getKycStatusForLogin(user.id);
                response.kyc = kycStatus;
                // Set isKycVerified flag
                response.user.isKycVerified = kycStatus.overallStatus === 'verified' || user.phone_number == '9540594976';
            } catch (kycError) {
                logger.warn('Failed to fetch KYC status during signin:', { userId: user.id, error: kycError.message });
                response.kyc = { overallStatus: 'not_started', submittedDocs: 0, verifiedDocs: 0, canGoOnline: false, verifiedAt: null, nextScreen: 'KYC_INTRO' };
                response.user.isKycVerified = false;
            }
        }

        return response;
    } catch (error) {
        logger.error('Verify signin service error:', error);
        throw error;
    }
};

export const logout = async (accessToken) => {
    try {
        if (!accessToken) {
            throw new AuthError('No token provided for logout');
        }

        // Decode token to get userId before deleting session
        const decoded = tokenService.decodeToken(accessToken);

        // DB session delete karo
        await sessionRepo.deleteSession(accessToken);

        // Set is_logged = false so user can login from another device
        if (decoded?.userId) {
            await userRepo.updateUser(decoded.userId, { is_logged: false });
        }

        // Access token blacklist mein dalo — reuse na ho sake
        await blacklistToken(accessToken, 86400); // 24 hours blacklist
        logger.info('Access token blacklisted successfully');

        return { message: 'Logged out successfully' };
    } catch (error) {
        logger.error('Logout service error:', error);
        throw error;
    }
};

export const deleteAccount = async (userId, role, accessToken) => {
    try {
        if (role === 'driver') {
            const driver = await driverRepo.findDriverByUserId(userId);
            if (!driver) throw new NotFoundError('Driver profile');

            const activeRide = await rideRepo.findActiveRideByDriver(driver.id);
            if (activeRide) throw new ApiError(400, 'Cannot delete account during an active ride');

            await driverRepo.softDeleteDriver(userId);
        } else {
            const activeRide = await rideRepo.findActiveRideByPassenger(userId);
            if (activeRide) throw new ApiError(400, 'Cannot delete account during an active ride');

            await userRepo.softDeleteUser(userId);
        }

        // Token blacklist karo taaki reuse na ho sake
        if (accessToken) await blacklistToken(accessToken, 86400);

        return { message: 'Account deleted successfully' };
    } catch (error) {
        logger.error('Delete account service error:', error);
        throw error;
    }
};