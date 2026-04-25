import * as driverService from '../services/driverService.js';
import logger from '../../../core/logger/logger.js';
import { sendResponse, sendError } from '../../../core/utils/response.js';

export const register = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const driverData = req.body;

        const driver = await driverService.registerDriver(userId, driverData);

        sendResponse(res, 201, 'Driver registration successful. Pending verification.', driver);
    } catch (error) {
        next(error);
    }
};


// vehicle detail verification
export const addVehicleDetail = async (req, res, next) => {
  try {

    const userId = req.user.id;
    const vehicleData = req.body;

    const vehicle = await driverService.addVehicleDetail(userId, vehicleData);

    sendResponse(res, 201, 'Vehicle details uploaded successfully. Pending verification.', vehicle);

  } catch (error) {
    next(error);
  }
};


export const getProfile = async (req, res, next) => {
    try {
        const userId = req.user.id;

        const profile = await driverService.getDriverProfile(userId);

        sendResponse(res, 200, '', profile);
    } catch (error) {
        next(error);
    }
};

export const updateProfile = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const updates = req.body;

        const updatedProfile = await driverService.updateDriverProfile(userId, updates);

        sendResponse(res, 200, 'Driver profile updated successfully', updatedProfile);
    } catch (error) {
        next(error);
    }
};

export const updateLocation = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { latitude, longitude } = req.body;

        const result = await driverService.updateDriverLocation(userId, latitude, longitude);

        sendResponse(res, 200, 'Location updated successfully', result);
    } catch (error) {
        next(error);
    }
};

export const toggleAvailability = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { isAvailable } = req.body;

        const result = await driverService.toggleAvailability(userId, isAvailable);

        sendResponse(res, 200, `Driver is now ${result.isAvailable ? 'available' : 'unavailable'}`, result);
    } catch (error) {
        next(error);
    }
};

export const getRideHistory = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 10, status } = req.query;

        const history = await driverService.getDriverRideHistory(userId, { page, limit, status });

        sendResponse(res, 200, '', history);
    } catch (error) {
        next(error);
    }
};

export const getEarnings = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { period = 'weekly' } = req.query;

        const earnings = await driverService.getDriverEarnings(userId, period);

        sendResponse(res, 200, '', earnings);
    } catch (error) {
        next(error);
    }
};

export const getCurrentRide = async (req, res, next) => {
    try {
        const userId = req.user.id;

        const ride = await driverService.getCurrentRide(userId);

        sendResponse(res, 200, '', ride);
    } catch (error) {
        next(error);
    }
};

// ========== NEW CONTROLLER FUNCTIONS (Scoring & Metrics) ==========

export const getDriverScore = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const score = await driverService.getDriverScore(userId);
        sendResponse(res, 200, '', score);
    } catch (error) {
        next(error);
    }
};

export const getDriverBadge = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const badge = await driverService.getDriverBadge(userId);
        sendResponse(res, 200, '', badge);
    } catch (error) {
        next(error);
    }
};

export const getDailyMetrics = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { days = 7 } = req.query;
        const metrics = await driverService.getDriverDailyMetrics(userId, days);
        sendResponse(res, 200, '', metrics);
    } catch (error) {
        next(error);
    }
};




