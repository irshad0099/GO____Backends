import * as driverService from '../services/driverService.js';
import logger from '../../../core/logger/logger.js';

export const register = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const driverData = req.body;
        
        const driver = await driverService.registerDriver(userId, driverData);

        res.status(201).json({
            success: true,
            message: 'Driver registration successful. Pending verification.',
            data: driver
        });
    } catch (error) {
        next(error);
    }
};

export const getProfile = async (req, res, next) => {
    try {
        const userId = req.user.id;
        
        const profile = await driverService.getDriverProfile(userId);

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
        
        const updatedProfile = await driverService.updateDriverProfile(userId, updates);

        res.status(200).json({
            success: true,
            message: 'Driver profile updated successfully',
            data: updatedProfile
        });
    } catch (error) {
        next(error);
    }
};

export const updateLocation = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { latitude, longitude } = req.body;
        
        const result = await driverService.updateDriverLocation(userId, latitude, longitude);

        res.status(200).json({
            success: true,
            message: 'Location updated successfully',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

export const toggleAvailability = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { isAvailable } = req.body;
        
        const result = await driverService.toggleAvailability(userId, isAvailable);

        res.status(200).json({
            success: true,
            message: `Driver is now ${result.isAvailable ? 'available' : 'unavailable'}`,
            data: result
        });
    } catch (error) {
        next(error);
    }
};

export const getRideHistory = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 10, status } = req.query;
        
        const history = await driverService.getDriverRideHistory(userId, { page, limit, status });

        res.status(200).json({
            success: true,
            data: history
        });
    } catch (error) {
        next(error);
    }
};

export const getEarnings = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { period = 'weekly' } = req.query;
        
        const earnings = await driverService.getDriverEarnings(userId, period);

        res.status(200).json({
            success: true,
            data: earnings
        });
    } catch (error) {
        next(error);
    }
};

export const getCurrentRide = async (req, res, next) => {
    try {
        const userId = req.user.id;
        
        const ride = await driverService.getCurrentRide(userId);

        res.status(200).json({
            success: true,
            data: ride
        });
    } catch (error) {
        next(error);
    }
};

// ========== NEW CONTROLLER FUNCTIONS (Scoring & Metrics) ==========

export const getDriverScore = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const score = await driverService.getDriverScore(userId);
        res.status(200).json({
            success: true,
            data: score
        });
    } catch (error) {
        next(error);
    }
};

export const getDriverBadge = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const badge = await driverService.getDriverBadge(userId);
        res.status(200).json({
            success: true,
            data: badge
        });
    } catch (error) {
        next(error);
    }
};

export const getDailyMetrics = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { days = 7 } = req.query;
        const metrics = await driverService.getDriverDailyMetrics(userId, days);
        res.status(200).json({
            success: true,
            data: metrics
        });
    } catch (error) {
        next(error);
    }
};