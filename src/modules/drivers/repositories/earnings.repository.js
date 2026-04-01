import { db } from '../../../infrastructure/database/postgres.js';
import logger from '../../../core/logger/logger.js';

// ─── Weekly earnings fetch ──────────────────────────────────────────────────
export const findWeeklyEarnings = async (driverId, { limit = 10, offset = 0 }) => {
    try {
        const { rows } = await db.query(
            `SELECT * FROM driver_earnings_weekly
             WHERE driver_id = $1
             ORDER BY week_start DESC
             LIMIT $2 OFFSET $3`,
            [driverId, limit, offset]
        );
        return rows;
    } catch (error) {
        logger.error('Find weekly earnings repository error:', error);
        throw error;
    }
};

// ─── Monthly earnings fetch ─────────────────────────────────────────────────
export const findMonthlyEarnings = async (driverId, { limit = 12, offset = 0 }) => {
    try {
        const { rows } = await db.query(
            `SELECT * FROM driver_earnings_monthly
             WHERE driver_id = $1
             ORDER BY year DESC, month DESC
             LIMIT $2 OFFSET $3`,
            [driverId, limit, offset]
        );
        return rows;
    } catch (error) {
        logger.error('Find monthly earnings repository error:', error);
        throw error;
    }
};

// ─── Current week earnings (live calculate if cached row doesn't exist) ─────
export const findCurrentWeekEarnings = async (driverId) => {
    try {
        // Current week ka Monday nikalo
        const { rows } = await db.query(
            `SELECT * FROM driver_earnings_weekly
             WHERE driver_id = $1
               AND week_start = date_trunc('week', CURRENT_DATE)::date
             LIMIT 1`,
            [driverId]
        );

        if (rows[0]) return rows[0];

        // Agar cached nahi hai to live calculate karo
        const { rows: liveRows } = await db.query(
            `SELECT
                COUNT(*) FILTER (WHERE status = 'completed') AS completed_rides,
                COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_rides,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN actual_fare ELSE 0 END), 0) AS ride_earnings,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN tip_amount ELSE 0 END), 0) AS tip_earnings
             FROM rides
             WHERE driver_id = $1
               AND requested_at >= date_trunc('week', CURRENT_DATE)`,
            [driverId]
        );
        return liveRows[0];
    } catch (error) {
        logger.error('Find current week earnings repository error:', error);
        throw error;
    }
};

// ─── Custom date range earnings (statement download ke liye) ────────────────
export const findEarningsByDateRange = async (driverId, fromDate, toDate) => {
    try {
        const { rows } = await db.query(
            `SELECT
                COUNT(*) FILTER (WHERE status = 'completed') AS completed_rides,
                COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_rides,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN actual_fare ELSE 0 END), 0) AS ride_earnings,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN tip_amount ELSE 0 END), 0) AS tip_earnings,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN COALESCE(actual_fare, 0) ELSE 0 END), 0) AS gross_earnings
             FROM rides
             WHERE driver_id = $1
               AND requested_at >= $2
               AND requested_at <= $3`,
            [driverId, fromDate, toDate]
        );

        // Daily breakdown
        const { rows: daily } = await db.query(
            `SELECT
                DATE(completed_at) AS date,
                COUNT(*) AS rides,
                COALESCE(SUM(actual_fare), 0) AS earnings,
                COALESCE(SUM(tip_amount), 0) AS tips
             FROM rides
             WHERE driver_id = $1
               AND status = 'completed'
               AND completed_at >= $2
               AND completed_at <= $3
             GROUP BY DATE(completed_at)
             ORDER BY date`,
            [driverId, fromDate, toDate]
        );

        return { summary: rows[0], daily };
    } catch (error) {
        logger.error('Find earnings by date range repository error:', error);
        throw error;
    }
};
