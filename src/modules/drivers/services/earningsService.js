import * as earningsRepo from '../repositories/earnings.repository.js';
import * as driverRepo from '../repositories/driver.repository.js';
import { NotFoundError } from '../../../core/errors/ApiError.js';
import logger from '../../../core/logger/logger.js';

// ─── Weekly earnings list ───────────────────────────────────────────────────
export const getWeeklyEarnings = async (userId, { limit = 10, offset = 0 }) => {
    try {
        const driver = await driverRepo.findDriverByUserId(userId);
        if (!driver) throw new NotFoundError('Driver profile');

        const weeks = await earningsRepo.findWeeklyEarnings(driver.id, { limit, offset });

        return weeks.map(w => ({
            weekStart: w.week_start,
            weekEnd: w.week_end,
            totalRides: w.total_rides,
            completedRides: w.completed_rides,
            cancelledRides: w.cancelled_rides,
            rideEarnings: parseFloat(w.ride_earnings),
            tipEarnings: parseFloat(w.tip_earnings),
            incentiveEarnings: parseFloat(w.incentive_earnings),
            grossEarnings: parseFloat(w.gross_earnings),
            totalDeductions: parseFloat(w.total_deductions),
            netEarnings: parseFloat(w.net_earnings),
            cashCollected: parseFloat(w.cash_collected),
            onlineEarnings: parseFloat(w.online_earnings),
            totalOnlineHours: parseFloat(w.total_online_hours),
            avgEarningPerRide: parseFloat(w.avg_earning_per_ride)
        }));
    } catch (error) {
        logger.error('Get weekly earnings service error:', error);
        throw error;
    }
};

// ─── Monthly earnings list ──────────────────────────────────────────────────
export const getMonthlyEarnings = async (userId, { limit = 12, offset = 0 }) => {
    try {
        const driver = await driverRepo.findDriverByUserId(userId);
        if (!driver) throw new NotFoundError('Driver profile');

        const months = await earningsRepo.findMonthlyEarnings(driver.id, { limit, offset });

        return months.map(m => ({
            month: m.month,
            year: m.year,
            totalRides: m.total_rides,
            completedRides: m.completed_rides,
            rideEarnings: parseFloat(m.ride_earnings),
            tipEarnings: parseFloat(m.tip_earnings),
            incentiveEarnings: parseFloat(m.incentive_earnings),
            grossEarnings: parseFloat(m.gross_earnings),
            totalDeductions: parseFloat(m.total_deductions),
            netEarnings: parseFloat(m.net_earnings),
            cashCollected: parseFloat(m.cash_collected),
            totalWithdrawals: parseFloat(m.total_withdrawals),
            avgRating: parseFloat(m.avg_rating),
            acceptanceRate: parseFloat(m.acceptance_rate)
        }));
    } catch (error) {
        logger.error('Get monthly earnings service error:', error);
        throw error;
    }
};

// ─── Current week live ──────────────────────────────────────────────────────
export const getCurrentWeekEarnings = async (userId) => {
    try {
        const driver = await driverRepo.findDriverByUserId(userId);
        if (!driver) throw new NotFoundError('Driver profile');

        return await earningsRepo.findCurrentWeekEarnings(driver.id);
    } catch (error) {
        logger.error('Get current week earnings service error:', error);
        throw error;
    }
};

// ─── Earnings statement (date range) ────────────────────────────────────────
export const getEarningsStatement = async (userId, fromDate, toDate) => {
    try {
        const driver = await driverRepo.findDriverByUserId(userId);
        if (!driver) throw new NotFoundError('Driver profile');

        return await earningsRepo.findEarningsByDateRange(driver.id, fromDate, toDate);
    } catch (error) {
        logger.error('Get earnings statement service error:', error);
        throw error;
    }
};
