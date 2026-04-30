import * as earningsRepo from '../repositories/earnings.repository.js';
import * as driverRepo from '../repositories/driver.repository.js';
import { creditWallet } from '../../wallet/repositories/wallet.Repository.js';
import { pool } from '../../../infrastructure/database/postgres.js';
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

// ─────────────────────────────────────────────────────────────────────────────
//  Credit driver earnings after ride payment (wallet/card/upi/cash/corporate)
//  Idempotent — safe to call multiple times for same ride
// ─────────────────────────────────────────────────────────────────────────────

export const creditDriverEarnings = async ({
    driverUserId,
    rideId,
    netEarnings,
    platformFee,
    paymentMethod,
    collectionMethodActual = null,
}) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Find driver
        const driver = await driverRepo.findDriverByUserId(driverUserId);
        if (!driver) throw new NotFoundError('Driver profile');

        // Idempotency check — already credited for this ride?
        const existingCredit = await client.query(
            `SELECT * FROM driver_earnings_transactions
             WHERE driver_id = $1 AND ride_id = $2 AND type = 'ride_earnings'`,
            [driver.id, rideId]
        );
        if (existingCredit.rows.length > 0) {
            await client.query('ROLLBACK');
            logger.warn(`[Earnings] Duplicate credit blocked | Driver: ${driver.id} | Ride: ${rideId}`);
            return {
                success: true,
                message: 'Earnings already credited for this ride',
                alreadyCredited: true,
                data: existingCredit.rows[0],
            };
        }

        // Credit driver wallet with net earnings
        const updatedWallet = await creditWallet(client, driverUserId, netEarnings);

        // Record the earnings transaction
        const earningsTxn = await client.query(
            `INSERT INTO driver_earnings_transactions (
                driver_id, ride_id, type, amount, platform_fee,
                payment_method, collection_method_actual, status,
                created_at, updated_at
            ) VALUES ($1, $2, 'ride_earnings', $3, $4, $5, $6, 'success', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING *`,
            [driver.id, rideId, netEarnings, platformFee, paymentMethod, collectionMethodActual]
        );

        // For cash collection — add platform fee to driver's cash_balance (driver owes platform)
        if (paymentMethod === 'cash') {
            await client.query(
                `UPDATE drivers
                 SET cash_balance = COALESCE(cash_balance, 0) + $1,
                     total_earnings = COALESCE(total_earnings, 0) + $2,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $3`,
                [platformFee, netEarnings, driver.id]
            );
        } else {
            // Online methods — just update total earnings
            await client.query(
                `UPDATE drivers
                 SET total_earnings = COALESCE(total_earnings, 0) + $1,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $2`,
                [netEarnings, driver.id]
            );
        }

        await client.query('COMMIT');

        logger.info(
            `[Earnings] Driver credited | Driver: ${driver.id} | Ride: ${rideId} | Net: ₹${netEarnings} | Method: ${paymentMethod}`
        );

        return {
            success: true,
            message: 'Driver earnings credited successfully',
            data: {
                earningsTransaction: earningsTxn.rows[0],
                walletBalance: parseFloat(updatedWallet.balance),
                netEarnings,
                platformFee,
                paymentMethod,
            },
        };
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error(`[Earnings] creditDriverEarnings error | Driver: ${driverUserId} | Ride: ${rideId}:`, error);
        throw error;
    } finally {
        client.release();
    }
};
