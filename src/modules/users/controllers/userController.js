import * as userService from '../services/userService.js';
import logger from '../../../core/logger/logger.js';
import { sendResponse } from '../../../core/utils/response.js';
import * as userRepo from '../repositories/user.repository.js';
import * as sessionRepo from '../../auth/repositories/sessionRepository.js';
import { blacklistToken } from '../../../core/services/redisService.js';

export const getProfile = async (req, res, next) => {
    try {
        const userId = req.user.id;

        const profile = await userService.getUserProfile(userId);

        sendResponse(res, 200, '', profile);
    } catch (error) {
        next(error);
    }
};

export const updateProfile = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const updates = req.body;

        const updatedProfile = await userService.updateUserProfile(userId, updates);

        sendResponse(res, 200, 'Profile updated successfully', updatedProfile);
    } catch (error) {
        next(error);
    }
};

export const uploadProfilePicture = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const file = req.file;

        const result = await userService.uploadProfilePicture(userId, file);

        sendResponse(res, 200, 'Profile picture uploaded successfully', result);
    } catch (error) {
        next(error);
    }
};

export const getRideHistory = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 10 } = req.query;

        const history = await userService.getUserRideHistory(userId, { page, limit });

        sendResponse(res, 200, '', history);
    } catch (error) {
        next(error);
    }
};

export const getWalletBalance = async (req, res, next) => {
    try {
        const userId = req.user.id;

        const wallet = await userService.getUserWallet(userId);

        sendResponse(res, 200, '', wallet);
    } catch (error) {
        next(error);
    }
};

export const addMoneyToWallet = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { amount, paymentMethod } = req.body;

        const transaction = await userService.addMoneyToWallet(userId, amount, paymentMethod);

        sendResponse(res, 200, 'Money added to wallet successfully', transaction);
    } catch (error) {
        next(error);
    }
};

export const deleteAccount = async (req, res, next) => {
    try {
        const userId = req.user.id;

        // Sirf is_active false karo
        await userRepo.updateUser(userId, { 
            is_active: false
        });

        // Token blacklist karo
        const authHeader = req.headers.authorization || '';
        const accessToken = authHeader.startsWith('Bearer ') 
            ? authHeader.split(' ')[1] 
            : null;
        if (accessToken) {
            await blacklistToken(accessToken, 86400);
        }

        res.status(200).json({ 
            success: true, 
            message: 'Account deleted successfully' 
        });
    } catch (error) {
        logger.error('Delete account error:', error);
        next(error);
    }
};
