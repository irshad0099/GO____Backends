import * as userRepo from '../../users/repositories/user.repository.js';
import * as otpService from './otpService.js';
import * as tokenService from './tokenService.js';

import * as sessionRepo from '../repositories/sessionRepository.js';
import { ApiError, ConflictError, NotFoundError, AuthError } from '../../../core/errors/ApiError.js';
import logger from '../../../core/logger/logger.js';

export const signup = async ({ phone, email, fullName }) => {
    try {
        // Check if user exists
        const existingUser = await userRepo.findUserByPhone(phone);
        if (existingUser) {
            throw new ConflictError('User already exists with this phone number');
        }

        if (email) {
            const existingEmail = await userRepo.findUserByEmail(email);
            if (existingEmail) {
                throw new ConflictError('Email already registered');
            }
        }

        // Send OTP
        const result = await otpService.sendOTP(phone, 'signup');

        // Store temporary data in cache/session if needed
        // For now, just return success

        return result;
    } catch (error) {
        logger.error('Signup service error:', error);
        throw error;
    }
};

export const verifySignup = async ({ phone, otp, email, fullName }) => {
    try {
        // Verify OTP
        await otpService.verifyOTP(phone, otp, 'signup');

        // Check if user already exists (might have been created in another request)
        let user = await userRepo.findUserByPhone(phone);
        
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
                is_verified: true
            });
        }

        // Generate tokens
        const accessToken = tokenService.generateAccessToken(user);
        const refreshToken = tokenService.generateRefreshToken(user);

        // Create session
        await sessionRepo.createSession({
            userId: user.id,
            refreshToken,
            deviceId: null,
            deviceType: null,
            ipAddress: null,
            userAgent: null
        });

        logger.info('User signed up successfully:', { userId: user.id, phone });

        return {
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                phone: user.phone_number,
                email: user.email,
                fullName: user.full_name,
                role: user.role,
                isVerified: user.is_verified
            }
        };
    } catch (error) {
        logger.error('Verify signup service error:', error);
        throw error;
    }
};

export const signin = async (phone) => {
    try {
        // Check if user exists
        const user = await userRepo.findUserByPhone(phone);
        if (!user) {
            throw new NotFoundError('User not found. Please sign up first.');
        }

        if (!user.is_active) {
            throw new AuthError('Account is deactivated. Please contact support.');
        }

        // Send OTP
        const result = await otpService.sendOTP(phone, 'signin');

        return result;
    } catch (error) {
        logger.error('Signin service error:', error);
        throw error;
    }
};

export const verifySignin = async ({ phone, otp, ipAddress, userAgent }) => {
    try {
        // Verify OTP
        await otpService.verifyOTP(phone, otp, 'signin');

        // Get user
        const user = await userRepo.findUserByPhone(phone);
        if (!user) {
            throw new NotFoundError('User not found');
        }

        if (!user.is_active) {
            throw new AuthError('Account is deactivated. Please contact support.');
        }

        // Update last login
        await userRepo.updateUser(user.id, {
            last_login: new Date()
        });

        // Generate tokens
        const accessToken = tokenService.generateAccessToken(user);
        const refreshToken = tokenService.generateRefreshToken(user);

        // Create session
        await sessionRepo.createSession({
            userId: user.id,
            refreshToken,
            ipAddress,
            userAgent
        });

        logger.info('User signed in successfully:', { userId: user.id, phone });

        return {
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                phone: user.phone_number,
                email: user.email,
                fullName: user.full_name,
                role: user.role,
                isVerified: user.is_verified,
                isActive: user.is_active
            }
        };
    } catch (error) {
        logger.error('Verify signin service error:', error);
        throw error;
    }
};

export const logout = async (refreshToken) => {
    try {
        // Delete session
        await sessionRepo.deleteSession(refreshToken);

        return { message: 'Logged out successfully' };
    } catch (error) {
        logger.error('Logout service error:', error);
        throw error;
    }
};

export const refreshToken = async (refreshToken) => {
    try {
        // Verify refresh token
        const decoded = tokenService.verifyToken(refreshToken);

        // Check if session exists
        const session = await sessionRepo.findSession(refreshToken);
        if (!session || session.is_revoked) {
            throw new AuthError('Invalid refresh token');
        }

        // Get user
        const user = await userRepo.findUserById(decoded.userId);
        if (!user || !user.is_active) {
            throw new AuthError('User not found or inactive');
        }

        // Generate new tokens
        const newAccessToken = tokenService.generateAccessToken(user);
        const newRefreshToken = tokenService.generateRefreshToken(user);

        // Delete old session and create new one
        await sessionRepo.deleteSession(refreshToken);
        await sessionRepo.createSession({
            userId: user.id,
            refreshToken: newRefreshToken
        });

        return {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken
        };
    } catch (error) {
        logger.error('Refresh token service error:', error);
        throw new AuthError('Invalid or expired refresh token');
    }
};