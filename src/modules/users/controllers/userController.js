import * as userService from '../services/userService.js';
import logger from '../../../core/logger/logger.js';

export const getProfile = async (req, res, next) => {
    try {
        const userId = req.user.id;
        
        const profile = await userService.getUserProfile(userId);

        res.status(200).json({
            success: true,
            data: profile
        });
    } catch (error) {
        next(error);
    }
};

export const updateProfile = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const updates = req.body;
        
        const updatedProfile = await userService.updateUserProfile(userId, updates);

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: updatedProfile
        });
    } catch (error) {
        next(error);
    }
};

export const uploadProfilePicture = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const file = req.file;
        
        const result = await userService.uploadProfilePicture(userId, file);

        res.status(200).json({
            success: true,
            message: 'Profile picture uploaded successfully',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

export const getRideHistory = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 10 } = req.query;
        
        const history = await userService.getUserRideHistory(userId, { page, limit });

        res.status(200).json({
            success: true,
            data: history
        });
    } catch (error) {
        next(error);
    }
};

export const getWalletBalance = async (req, res, next) => {
    try {
        const userId = req.user.id;
        
        const wallet = await userService.getUserWallet(userId);

        res.status(200).json({
            success: true,
            data: wallet
        });
    } catch (error) {
        next(error);
    }
};

export const addMoneyToWallet = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { amount, paymentMethod } = req.body;
        
        const transaction = await userService.addMoneyToWallet(userId, amount, paymentMethod);

        res.status(200).json({
            success: true,
            message: 'Money added to wallet successfully',
            data: transaction
        });
    } catch (error) {
        next(error);
    }
};