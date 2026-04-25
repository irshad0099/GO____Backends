import logger from '../../../core/logger/logger.js';
import {
    fetchDashboardStats,
    fetchAllUsers,
    fetchUserDetail,
    changeUserStatus,
    fetchAllDrivers,
    fetchDriverDetail,
    changeDriverVerification,
    changeDriverStatus,
    fetchAllRides,
    fetchAllTransactions,
    fetchRevenueAnalytics,
} from '../services/adminservice.js';
import { sendResponse, sendError } from '../../../core/utils/response.js';

// ─────────────────────────────────────────────────────────────────────────────
//  DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/v1/admin/dashboard
export const getDashboard = async (req, res) => {
    try {
        const result = await fetchDashboardStats();
        return sendResponse(res, 200, result.message || '', result.data ?? result);
    } catch (error) {
        logger.error(`[AdminController] ${error.message}`);
        return sendError(res, error.statusCode || 500, error.message || 'Internal server error');
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  USERS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/v1/admin/users
export const getUsers = async (req, res) => {
    try {
        const { limit = 20, offset = 0, search, status } = req.query;
        const result = await fetchAllUsers({
            limit: parseInt(limit), offset: parseInt(offset), search, status,
        });
        return sendResponse(res, 200, result.message || '', result.data ?? result);
    } catch (error) {
        logger.error(`[AdminController] ${error.message}`);
        return sendError(res, error.statusCode || 500, error.message || 'Internal server error');
    }
};

// GET /api/v1/admin/users/:userId
export const getUser = async (req, res) => {
    try {
        const result = await fetchUserDetail(parseInt(req.params.userId));
        return sendResponse(res, 200, result.message || '', result.data ?? result);
    } catch (error) {
        logger.error(`[AdminController] ${error.message}`);
        return sendError(res, error.statusCode || 500, error.message || 'Internal server error');
    }
};

// PATCH /api/v1/admin/users/:userId/status
export const updateUserStatus = async (req, res) => {
    try {
        const result = await changeUserStatus(parseInt(req.params.userId), req.body.is_active);
        return sendResponse(res, 200, result.message || '', result.data ?? result);
    } catch (error) {
        logger.error(`[AdminController] ${error.message}`);
        return sendError(res, error.statusCode || 500, error.message || 'Internal server error');
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  DRIVERS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/v1/admin/drivers
export const getDrivers = async (req, res) => {
    try {
        const { limit = 20, offset = 0, search, status, is_verified } = req.query;
        const result = await fetchAllDrivers({
            limit: parseInt(limit), offset: parseInt(offset),
            search, status,
            isVerified: is_verified !== undefined ? is_verified === 'true' : undefined,
        });
        return sendResponse(res, 200, result.message || '', result.data ?? result);
    } catch (error) {
        logger.error(`[AdminController] ${error.message}`);
        return sendError(res, error.statusCode || 500, error.message || 'Internal server error');
    }
};

// GET /api/v1/admin/drivers/:driverId
export const getDriver = async (req, res) => {
    try {
        const result = await fetchDriverDetail(parseInt(req.params.driverId));
        return sendResponse(res, 200, result.message || '', result.data ?? result);
    } catch (error) {
        logger.error(`[AdminController] ${error.message}`);
        return sendError(res, error.statusCode || 500, error.message || 'Internal server error');
    }
};

// PATCH /api/v1/admin/drivers/:driverId/verify
export const updateDriverVerification = async (req, res) => {
    try {
        const result = await changeDriverVerification(parseInt(req.params.driverId), req.body.is_verified);
        return sendResponse(res, 200, result.message || '', result.data ?? result);
    } catch (error) {
        logger.error(`[AdminController] ${error.message}`);
        return sendError(res, error.statusCode || 500, error.message || 'Internal server error');
    }
};

// PATCH /api/v1/admin/drivers/:driverId/status
export const updateDriverStatus = async (req, res) => {
    try {
        const result = await changeDriverStatus(parseInt(req.params.driverId), req.body.is_active);
        return sendResponse(res, 200, result.message || '', result.data ?? result);
    } catch (error) {
        logger.error(`[AdminController] ${error.message}`);
        return sendError(res, error.statusCode || 500, error.message || 'Internal server error');
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  RIDES
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/v1/admin/rides
export const getRides = async (req, res) => {
    try {
        const { limit = 20, offset = 0, status, vehicle_type, start_date, end_date } = req.query;
        const result = await fetchAllRides({
            limit: parseInt(limit), offset: parseInt(offset),
            status, vehicleType: vehicle_type,
            startDate: start_date, endDate: end_date,
        });
        return sendResponse(res, 200, result.message || '', result.data ?? result);
    } catch (error) {
        logger.error(`[AdminController] ${error.message}`);
        return sendError(res, error.statusCode || 500, error.message || 'Internal server error');
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  TRANSACTIONS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/v1/admin/transactions
export const getTransactions = async (req, res) => {
    try {
        const { limit = 20, offset = 0, type, category, status, start_date, end_date } = req.query;
        const result = await fetchAllTransactions({
            limit: parseInt(limit), offset: parseInt(offset),
            type, category, status,
            startDate: start_date, endDate: end_date,
        });
        return sendResponse(res, 200, result.message || '', result.data ?? result);
    } catch (error) {
        logger.error(`[AdminController] ${error.message}`);
        return sendError(res, error.statusCode || 500, error.message || 'Internal server error');
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  ANALYTICS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/v1/admin/analytics/revenue?days=7
export const getRevenueAnalytics = async (req, res) => {
    try {
        const { days = 7 } = req.query;
        const result = await fetchRevenueAnalytics(parseInt(days));
        return sendResponse(res, 200, result.message || '', result.data ?? result);
    } catch (error) {
        logger.error(`[AdminController] ${error.message}`);
        return sendError(res, error.statusCode || 500, error.message || 'Internal server error');
    }
};
