import logger from '../../../core/logger/logger.js';
import {
    getDashboardStats,
    getAllUsers,
    getAllUsersCount,
    getUserById,
    toggleUserStatus,
    getAllDrivers,
    getAllDriversCount,
    getDriverById,
    verifyDriver,
    toggleDriverStatus,
    getAllRides,
    getAllRidesCount,
    getAllTransactions,
    getAllTransactionsCount,
    getRevenueByDay,
    getRevenueByVehicle,
} from '../repositories/admin.Repository.js';

// ─────────────────────────────────────────────────────────────────────────────
//  DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

export const fetchDashboardStats = async () => {
    const stats = await getDashboardStats();
    return {
        success: true,
        data: {
            users: {
                total:    parseInt(stats.total_users),
                newToday: parseInt(stats.new_users_today),
                active:   parseInt(stats.active_users),
            },
            drivers: {
                total:    parseInt(stats.total_drivers),
                online:   parseInt(stats.online_drivers),
                verified: parseInt(stats.verified_drivers),
            },
            rides: {
                total:     parseInt(stats.total_rides),
                today:     parseInt(stats.rides_today),
                ongoing:   parseInt(stats.ongoing_rides),
                completed: parseInt(stats.completed_rides),
                cancelled: parseInt(stats.cancelled_rides),
            },
            revenue: {
                today: parseFloat(stats.revenue_today),
                month: parseFloat(stats.revenue_month),
            },
        },
    };
};

// ─────────────────────────────────────────────────────────────────────────────
//  USER MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

export const fetchAllUsers = async (filters) => {
    const [users, total] = await Promise.all([
        getAllUsers(filters),
        getAllUsersCount(filters),
    ]);

    return {
        success: true,
        data: {
            users,
            pagination: {
                total,
                limit:   filters.limit,
                offset:  filters.offset,
                hasMore: filters.offset + filters.limit < total,
            },
        },
    };
};

export const fetchUserDetail = async (userId) => {
    const user = await getUserById(userId);
    if (!user) {
        const err = new Error('User not found');
        err.statusCode = 404;
        throw err;
    }
    return { success: true, data: user };
};

export const changeUserStatus = async (userId, isActive) => {
    const user = await toggleUserStatus(userId, isActive);
    if (!user) {
        const err = new Error('User not found');
        err.statusCode = 404;
        throw err;
    }
    logger.info(`[Admin] User ${isActive ? 'activated' : 'deactivated'} | ID: ${userId}`);
    return {
        success: true,
        message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
        data:    user,
    };
};

// ─────────────────────────────────────────────────────────────────────────────
//  DRIVER MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

export const fetchAllDrivers = async (filters) => {
    const [drivers, total] = await Promise.all([
        getAllDrivers(filters),
        getAllDriversCount(filters),
    ]);

    return {
        success: true,
        data: {
            drivers,
            pagination: {
                total,
                limit:   filters.limit,
                offset:  filters.offset,
                hasMore: filters.offset + filters.limit < total,
            },
        },
    };
};

export const fetchDriverDetail = async (driverId) => {
    const driver = await getDriverById(driverId);
    if (!driver) {
        const err = new Error('Driver not found');
        err.statusCode = 404;
        throw err;
    }
    return { success: true, data: driver };
};

export const changeDriverVerification = async (driverId, isVerified) => {
    const driver = await verifyDriver(driverId, isVerified);
    if (!driver) {
        const err = new Error('Driver not found');
        err.statusCode = 404;
        throw err;
    }
    logger.info(`[Admin] Driver ${isVerified ? 'verified' : 'unverified'} | ID: ${driverId}`);
    return {
        success: true,
        message: `Driver ${isVerified ? 'verified' : 'verification removed'} successfully`,
        data:    driver,
    };
};

export const changeDriverStatus = async (driverId, isActive) => {
    const result = await toggleDriverStatus(driverId, isActive);
    if (!result) {
        const err = new Error('Driver not found');
        err.statusCode = 404;
        throw err;
    }
    logger.info(`[Admin] Driver ${isActive ? 'activated' : 'deactivated'} | ID: ${driverId}`);
    return {
        success: true,
        message: `Driver ${isActive ? 'activated' : 'deactivated'} successfully`,
        data:    result,
    };
};

// ─────────────────────────────────────────────────────────────────────────────
//  RIDE MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

export const fetchAllRides = async (filters) => {
    const [rides, total] = await Promise.all([
        getAllRides(filters),
        getAllRidesCount(filters),
    ]);

    return {
        success: true,
        data: {
            rides,
            pagination: {
                total,
                limit:   filters.limit,
                offset:  filters.offset,
                hasMore: filters.offset + filters.limit < total,
            },
        },
    };
};

// ─────────────────────────────────────────────────────────────────────────────
//  TRANSACTION MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

export const fetchAllTransactions = async (filters) => {
    const [transactions, total] = await Promise.all([
        getAllTransactions(filters),
        getAllTransactionsCount(filters),
    ]);

    return {
        success: true,
        data: {
            transactions,
            pagination: {
                total,
                limit:   filters.limit,
                offset:  filters.offset,
                hasMore: filters.offset + filters.limit < total,
            },
        },
    };
};

// ─────────────────────────────────────────────────────────────────────────────
//  ANALYTICS
// ─────────────────────────────────────────────────────────────────────────────

export const fetchRevenueAnalytics = async (days) => {
    const [byDay, byVehicle] = await Promise.all([
        getRevenueByDay(days),
        getRevenueByVehicle(),
    ]);

    return {
        success: true,
        data: {
            byDay:      byDay.map(r => ({
                date:         r.date,
                totalRides:   parseInt(r.total_rides),
                totalRevenue: parseFloat(r.total_revenue),
            })),
            byVehicle:  byVehicle.map(r => ({
                vehicleType:  r.vehicle_type,
                totalRides:   parseInt(r.total_rides),
                totalRevenue: parseFloat(r.total_revenue),
                avgFare:      parseFloat(r.avg_fare),
            })),
        },
    };
};