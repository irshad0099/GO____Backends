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

const handleError = (res, error) => {
    logger.error(`[AdminController] ${error.message}`);
    return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Internal server error',
    });
};

// ─────────────────────────────────────────────────────────────────────────────
//  DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/v1/admin/dashboard
export const getDashboard = async (req, res) => {
    try {
        const result = await fetchDashboardStats();
        return res.status(200).json(result);
    } catch (error) {
        return handleError(res, error);
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
        return res.status(200).json(result);
    } catch (error) {
        return handleError(res, error);
    }
};

// GET /api/v1/admin/users/:userId
export const getUser = async (req, res) => {
    try {
        const result = await fetchUserDetail(parseInt(req.params.userId));
        return res.status(200).json(result);
    } catch (error) {
        return handleError(res, error);
    }
};

// PATCH /api/v1/admin/users/:userId/status
export const updateUserStatus = async (req, res) => {
    try {
        const result = await changeUserStatus(parseInt(req.params.userId), req.body.is_active);
        return res.status(200).json(result);
    } catch (error) {
        return handleError(res, error);
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
        return res.status(200).json(result);
    } catch (error) {
        return handleError(res, error);
    }
};

// GET /api/v1/admin/drivers/:driverId
export const getDriver = async (req, res) => {
    try {
        const result = await fetchDriverDetail(parseInt(req.params.driverId));
        return res.status(200).json(result);
    } catch (error) {
        return handleError(res, error);
    }
};

// PATCH /api/v1/admin/drivers/:driverId/verify
export const updateDriverVerification = async (req, res) => {
    try {
        const result = await changeDriverVerification(parseInt(req.params.driverId), req.body.is_verified);
        return res.status(200).json(result);
    } catch (error) {
        return handleError(res, error);
    }
};

// PATCH /api/v1/admin/drivers/:driverId/status
export const updateDriverStatus = async (req, res) => {
    try {
        const result = await changeDriverStatus(parseInt(req.params.driverId), req.body.is_active);
        return res.status(200).json(result);
    } catch (error) {
        return handleError(res, error);
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
        return res.status(200).json(result);
    } catch (error) {
        return handleError(res, error);
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
        return res.status(200).json(result);
    } catch (error) {
        return handleError(res, error);
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
        return res.status(200).json(result);
    } catch (error) {
        return handleError(res, error);
    }
};